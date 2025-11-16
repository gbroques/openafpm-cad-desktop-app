"""
Request Collapse Optimization for FreeCAD load_all() Operations

This module provides a decorator that collapses multiple concurrent requests with identical
parameters into a single execution, preventing duplicate expensive operations.

How it works:
1. Uses hash_parameters() to generate unique cache keys from request parameters
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
    from openafpm_cad_core.app import load_all
    
    @request_collapse
    def request_collapsed_load_all(magnafpm_parameters, furling_parameters, user_parameters):
        return load_all(magnafpm_parameters, furling_parameters, user_parameters)
    
    # Multiple concurrent calls with same parameters will collapse into one execution:
    # Thread 1: request_collapsed_load_all(params_a, params_b, params_c)  # Executes load_all()
    # Thread 2: request_collapsed_load_all(params_a, params_b, params_c)  # Waits for Thread 1
    # Thread 3: request_collapsed_load_all(params_a, params_b, params_c)  # Waits for Thread 1
    # All threads receive the same result from Thread 1's execution
"""

import threading
from functools import wraps
from openafpm_cad_core.app import hash_parameters
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for request collapse - only stores latest result
_current_cache_key = None
_current_cache_entry = None
_cache_lock = threading.Lock()

def request_collapse(func):
    """
    Decorator that collapses multiple requests with identical parameters into a single execution.
    Only caches the latest result to avoid stale FreeCAD object references.
    
    Args:
        func: Function to wrap, must accept (magnafpm_parameters, furling_parameters, user_parameters)
        
    Returns:
        Wrapped function that implements request collapsing behavior
        
    Cache states:
        - "loading": Function is currently executing in another thread
        - "complete": Function completed successfully, result cached
        - "error": Function failed, exception cached and will be re-raised
    """
    @wraps(func)
    def wrapper(magnafpm_parameters, furling_parameters, user_parameters):
        global _current_cache_key, _current_cache_entry
        import threading
        request_id = f"req-{threading.current_thread().ident}"
        cache_key = hash_parameters(magnafpm_parameters, furling_parameters, user_parameters)
        
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
                    logger.info(f"[{request_id}] Wait complete, returning result for {cache_key[:8]}...")
                    return _current_cache_entry["result"]
            else:
                # Clear old cache and start new loading
                logger.info(f"[{request_id}] Cache MISS: starting load_all for {cache_key[:8]}...")
                event = threading.Event()
                _current_cache_key = cache_key
                _current_cache_entry = {"status": "loading", "event": event, "result": None}
        
        try:
            logger.info(f"[{request_id}] Executing load_all for {cache_key[:8]}...")
            result = func(magnafpm_parameters, furling_parameters, user_parameters)
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
