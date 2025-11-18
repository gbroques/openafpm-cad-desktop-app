"""
Progress Broadcasting System for SSE Endpoints

Manages progress callbacks for multiple concurrent SSE clients sharing the same operation.
Thread-safe broadcasting with automatic cleanup of disconnected clients.
"""

import threading
from typing import List, Callable
import logging

logger = logging.getLogger(__name__)

class ProgressBroadcaster:
    """Thread-safe progress broadcaster for multiple SSE clients."""
    
    def __init__(self):
        self.callbacks: List[Callable] = []
        self.lock = threading.Lock()
    
    def add_callback(self, callback: Callable[[int, str], None]):
        """Add a progress callback for an SSE client."""
        with self.lock:
            self.callbacks.append(callback)
            logger.info(f"Added progress callback, total: {len(self.callbacks)}")
    
    def broadcast(self, message: str, progress: int):
        """Broadcast progress to all connected clients."""
        with self.lock:
            failed_callbacks = []
            for callback in self.callbacks[:]:  # Copy to avoid modification during iteration
                try:
                    callback(message, progress)
                except Exception as e:
                    logger.warning(f"Progress callback failed: {e}")
                except Exception as e:
                    logger.warning(f"Progress callback failed: {e}")
                    failed_callbacks.append(callback)
            
            # Remove failed callbacks (disconnected clients)
            for failed_callback in failed_callbacks:
                if failed_callback in self.callbacks:
                    self.callbacks.remove(failed_callback)
                    logger.info(f"Removed failed callback, remaining: {len(self.callbacks)}")
    
    def get_callback_count(self) -> int:
        """Get number of active callbacks."""
        with self.lock:
            return len(self.callbacks)
