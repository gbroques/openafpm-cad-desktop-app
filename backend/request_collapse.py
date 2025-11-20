"""
Request Collapse Optimization for FreeCAD load_all() Operations

This module provides a decorator that collapses multiple concurrent requests with identical
parameters into a single execution, preventing duplicate expensive operations.

How it works:
1. Uses a key_generator function to generate unique cache keys from request parameters
2. First request with new parameters executes the wrapped function
3. Concurrent requests with same parameters wait for the first to complete
4. All requests receive the same result from the first execution

Key characteristics:
- In-memory cache: Results stored in process memory, lost on restart
- Thread-safe: Uses threading.Lock for concurrent access protection  
- Multi-threaded: Supports multiple simultaneous requests via threading.Event
- Single-entry cache: Only caches latest result due to FreeCAD's shared global state
- Requests don't need to be simultaneous: Later requests with same parameters get cached results
- Error propagation: Exceptions are cached and re-raised for waiting requests
- Progress broadcasting: Multiple clients can receive progress updates from single execution

FreeCAD Global State Issue:
- FreeCAD uses shared global document state that gets mutated by each load_all() call
- Caching multiple results would mean old cached references point to the same objects
  that were mutated by newer load_all() calls, making them incorrect
- Single-entry cache ensures only the latest valid result is available
- Avoids memory overhead and complexity of deep copying FreeCAD documents

Performance benefits:
- Eliminates duplicate FreeCAD document loading for identical parameters
- Reduces memory usage and processing time for repeated requests
- Prevents FreeCAD alias conflicts from concurrent document creation

Usage:
    from openafpm_cad_core.app import load_all, hash_parameters
    
    @request_collapse_with_progress(key_generator=hash_parameters)
    def request_collapsed_load_all_with_progress(magnafpm_parameters, furling_parameters, user_parameters, progress_callback=None, cancel_event=None):
        return load_all(magnafpm_parameters, furling_parameters, user_parameters, progress_callback, cancel_event)
    
    # Multiple concurrent calls with same parameters will collapse into one execution:
    # Thread 1: request_collapsed_load_all_with_progress(params_a, params_b, params_c, callback1)  # Executes load_all()
    # Thread 2: request_collapsed_load_all_with_progress(params_a, params_b, params_c, callback2)  # Waits for Thread 1
    # Thread 3: request_collapsed_load_all_with_progress(params_a, params_b, params_c, callback3)  # Waits for Thread 1
    # All threads receive the same result, and all callbacks receive progress updates
"""

import threading
import uuid
from functools import wraps
import logging

from .progress_broadcaster import ProgressBroadcaster

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for request collapse - only stores latest result
_current_cache_key = None
_current_cache_entry = None
_current_cancel_event = None  # Track cancel event for active operation
_cache_lock = threading.Lock()

def request_collapse(key_generator):
    """
    Decorator factory that collapses multiple requests with identical parameters into a single execution.
    Only caches the latest result to avoid stale FreeCAD object references.
    
    Args:
        key_generator: Function that takes *args (positional arguments only) and returns a cache key string
        
    Returns:
        Decorator function that wraps the target function
        
    Cache states:
        - "loading": Function is currently executing in another thread
        - "complete": Function completed successfully, result cached
        - "error": Function failed, exception cached and will be re-raised
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            global _current_cache_key, _current_cache_entry
            import threading
            request_id = f"req-{threading.current_thread().ident}"
            cache_key = key_generator(*args)
            
            logger.info(f"[{request_id}] Request collapse: cache_key={cache_key[:8]}...")
            
            with _cache_lock:
                # Check if we have a cached result for this exact key
                if _current_cache_key == cache_key and _current_cache_entry is not None:
                    entry = _current_cache_entry
                    if entry["status"] == "complete":
                        logger.info(f"[{request_id}] Cache HIT: returning cached result for {cache_key[:8]}...")
                        return entry["result"]
                    elif entry["status"] == "loading":
                        logger.info(f"[{request_id}] Cache WAIT: waiting for loading to complete for {cache_key[:8]}...")
                        event = entry["event"]
                        # Release lock and wait for the other thread to complete
                        _cache_lock.release()
                        event.wait()
                        _cache_lock.acquire()
                        logger.info(f"[{request_id}] Wait complete, checking result for {cache_key[:8]}...")
                        
                        # Check if cache was already cleared (cancelled operation)
                        if _current_cache_entry is None:
                            logger.info(f"[{request_id}] Cache was cleared, operation was cancelled")
                            raise InterruptedError("Operation was cancelled")
                        
                        # Check if the operation failed and re-raise the exception
                        if _current_cache_entry["status"] == "error":
                            error = _current_cache_entry["error"]
                            logger.info(f"[{request_id}] Re-raising error from completed operation: {error}")
                            # Clear cache if it was cancelled so new requests can start fresh
                            if isinstance(error, InterruptedError):
                                logger.info(f"[{request_id}] Clearing cache entry for cancelled operation")
                                _current_cache_key = None
                                _current_cache_entry = None
                            raise error
                        
                        return _current_cache_entry["result"]
                else:
                    # Clear old cache and start new loading
                    logger.info(f"[{request_id}] Cache MISS: starting load_all for {cache_key[:8]}...")
                    event = threading.Event()
                    _current_cache_key = cache_key
                    _current_cache_entry = {"status": "loading", "event": event, "result": None}
            
            try:
                logger.info(f"[{request_id}] Executing load_all for {cache_key[:8]}...")
                result = func(*args, **kwargs)
                logger.info(f"[{request_id}] load_all completed for {cache_key[:8]}...")
                with _cache_lock:
                    _current_cache_entry = {"status": "complete", "result": result}
                event.set()
                return result
            except Exception as e:
                logger.error(f"[{request_id}] load_all failed for {cache_key[:8]}...: {e}")
                with _cache_lock:
                    _current_cache_entry = {"status": "error", "error": e}
                event.set()
                raise
        
        return wrapper
    return decorator

def request_collapse_with_progress(key_generator):
    """
    Decorator factory that collapses multiple requests with progress broadcasting support.
    
    Args:
        key_generator: Function that takes *args (positional arguments only) and returns a cache key string
        
    Returns:
        Decorator function that wraps the target function (must accept progress_callback and cancel_event as kwargs)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            global _current_cache_key, _current_cache_entry
            import threading
            request_id = f"req-{threading.current_thread().ident}"
            cache_key = key_generator(*args)
            old_event = None
            event = None
            progress_callback = kwargs.get('progress_callback')
            
            logger.info(f"[{request_id}] Request collapse with progress: cache_key={cache_key[:8]}... (current_key: {_current_cache_key[:8] if _current_cache_key else 'None'})")
            
            with _cache_lock:
                # Check if we have a cached result for this exact key
                if _current_cache_key == cache_key and _current_cache_entry is not None:
                    entry = _current_cache_entry
                    if entry["status"] == "complete":
                        logger.info(f"[{request_id}] Cache HIT: returning cached result for {cache_key[:8]}...")
                        if progress_callback:
                            progress_callback("Using cached result", 100)
                        return entry["result"]
                    elif entry["status"] == "error":
                        logger.info(f"[{request_id}] Cache HIT: re-raising cached error for {cache_key[:8]}...")
                        raise entry["error"]
                    elif entry["status"] == "loading":
                        logger.info(f"[{request_id}] Cache WAIT: joining existing load for {cache_key[:8]}...")
                        # Add callback to existing broadcaster
                        if progress_callback:
                            entry["progress_broadcaster"].add_callback(progress_callback)
                        # Wait for completion
                        event = entry["event"]
                        # Save ID of this specific entry to detect if it was replaced
                        waiting_for_id = entry["id"]
                        _cache_lock.release()
                        event.wait()
                        _cache_lock.acquire()
                        logger.info(f"[{request_id}] Wait complete, checking result for {cache_key[:8]}...")
                        
                        # Check if the entry we were waiting for was replaced (cancelled operation)
                        # This happens when parameters change and a new operation starts
                        if _current_cache_entry is None or _current_cache_entry.get("id") != waiting_for_id:
                            logger.info(f"[{request_id}] Cache entry was replaced, operation was cancelled")
                            raise InterruptedError("Operation was cancelled")
                        
                        # Check if the operation failed and re-raise the exception
                        if _current_cache_entry["status"] == "error":
                            error = _current_cache_entry["error"]
                            logger.info(f"[{request_id}] Re-raising error from completed operation: {error}")
                            # Clear cache if it was cancelled so new requests can start fresh
                            if isinstance(error, InterruptedError):
                                logger.info(f"[{request_id}] Clearing cache entry for cancelled operation")
                                _current_cache_key = None
                                _current_cache_entry = None
                            raise error
                        
                        return _current_cache_entry["result"]
                else:
                    # Cancel any existing operation when parameters change
                    global _current_cancel_event
                    
                    if _current_cancel_event is not None:
                        logger.info(f"[{request_id}] Cancelling previous operation for new parameters {cache_key[:8]}...")
                        _current_cancel_event.set()
                        
                        # Wait for old operation to actually finish cancelling
                        old_event = _current_cache_entry.get("event") if _current_cache_entry else None
                        if old_event is not None:
                            logger.info(f"[{request_id}] Waiting for previous operation to cancel...")
                            _cache_lock.release()
                            old_event.wait()
                            _cache_lock.acquire()
                            logger.info(f"[{request_id}] Previous operation cancelled, proceeding...")
                            
                            # After waiting, check if another thread already created a cache entry for our key
                            if _current_cache_key == cache_key and _current_cache_entry is not None:
                                logger.info(f"[{request_id}] Another thread created cache entry, joining...")
                                entry = _current_cache_entry
                                if entry["status"] == "loading":
                                    if progress_callback:
                                        entry["progress_broadcaster"].add_callback(progress_callback)
                                    event = entry["event"]
                                    waiting_for_id = entry["id"]
                                    _cache_lock.release()
                                    event.wait()
                                    _cache_lock.acquire()
                                    
                                    if _current_cache_entry is None or _current_cache_entry.get("id") != waiting_for_id:
                                        raise InterruptedError("Operation was cancelled")
                                    if _current_cache_entry["status"] == "error":
                                        raise _current_cache_entry["error"]
                                    return _current_cache_entry["result"]
                                elif entry["status"] == "complete":
                                    if progress_callback:
                                        progress_callback("Using cached result", 100)
                                    return entry["result"]
                                elif entry["status"] == "error":
                                    raise entry["error"]
                    
                    # Save old event to set after releasing lock
                    old_event = None
                    if _current_cache_entry is not None and "event" in _current_cache_entry:
                        old_event = _current_cache_entry["event"]
                    
                    # Clear old cache and start new loading
                    logger.info(f"[{request_id}] Cache MISS: starting load_all for {cache_key[:8]}...")
                    
                    # Create new cancel event for this operation
                    logger.info(f"[{request_id}] Creating new cancel event...")
                    cancel_event = threading.Event()
                    _current_cancel_event = cancel_event
                    
                    # New execution - create broadcaster
                    logger.info(f"[{request_id}] Creating broadcaster...")
                    broadcaster = ProgressBroadcaster()
                    if progress_callback:
                        broadcaster.add_callback(progress_callback)
                        logger.info(f"[{request_id}] Added progress callback to broadcaster")
                    
                    logger.info(f"[{request_id}] Setting up cache entry...")
                    event = threading.Event()
                    entry_id = str(uuid.uuid4())
                    _current_cache_key = cache_key
                    _current_cache_entry = {
                        "id": entry_id,
                        "status": "loading",
                        "event": event,
                        "progress_broadcaster": broadcaster,
                        "cancel_event": cancel_event,
                        "result": None
                    }
                    logger.info(f"[{request_id}] Cache entry created successfully")
            
            # Execute with progress broadcasting
            def broadcast_progress_wrapper(message: str, progress: int):
                # Check if cache entry still exists (might be cleared during cancellation)
                with _cache_lock:
                    if _current_cache_entry is not None and "progress_broadcaster" in _current_cache_entry:
                        _current_cache_entry["progress_broadcaster"].broadcast(message, progress)
            
            # Capture cancel_event before execution (it might be cleared during cancellation)
            cancel_event = _current_cache_entry["cancel_event"]
            
            try:
                logger.info(f"[{request_id}] Executing load_all with progress for {cache_key[:8]}...")
                logger.info(f"[{request_id}] Getting cancel event from cache entry...")
                logger.info(f"[{request_id}] About to call load_all function...")
                try:
                    # Override kwargs with broadcast wrapper and cancel event
                    func_kwargs = {**kwargs, 'progress_callback': broadcast_progress_wrapper, 'cancel_event': cancel_event}
                    result = func(*args, **func_kwargs)
                    logger.info(f"[{request_id}] load_all completed successfully for {cache_key[:8]}...")
                except Exception as load_error:
                    logger.error(f"[{request_id}] Error during load_all execution: {load_error}")
                    logger.error(f"[{request_id}] Load error type: {type(load_error)}")
                    import traceback
                    logger.error(f"[{request_id}] Load traceback: {traceback.format_exc()}")
                    raise
                with _cache_lock:
                    # Only set status if cache entry still exists (might be cleared by another thread)
                    if _current_cache_entry is not None:
                        _current_cache_entry["status"] = "complete"
                        _current_cache_entry["result"] = result
                if event:
                    event.set()
                return result
            except Exception as e:
                logger.error(f"[{request_id}] load_all failed for {cache_key[:8]}...: {e}")
                with _cache_lock:
                    # Only clear/update cache if it's still our entry (not replaced by new operation)
                    if _current_cache_key == cache_key and _current_cache_entry is not None:
                        if isinstance(e, InterruptedError):
                            logger.info(f"[{request_id}] Clearing cache for cancelled operation")
                            _current_cache_key = None
                            _current_cache_entry = None
                        else:
                            # Only set error status for non-cancelled operations
                            _current_cache_entry["status"] = "error"
                            _current_cache_entry["error"] = e
                    else:
                        logger.info(f"[{request_id}] Cache already replaced, not clearing")
                if event:
                    event.set()
                raise
        
        return wrapper
    return decorator
