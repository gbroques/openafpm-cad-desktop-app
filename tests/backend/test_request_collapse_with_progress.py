"""
Comprehensive unit tests for request_collapse_with_progress decorator.
"""

import unittest
import threading
import time
from unittest.mock import Mock, call

from backend.request_collapse import request_collapse_with_progress


class TestRequestCollapseWithProgress(unittest.TestCase):
    
    def setUp(self):
        """Reset global cache state before each test."""
        from backend import request_collapse
        request_collapse._current_cache_key = None
        request_collapse._current_cache_entry = None
        request_collapse._current_cancel_event = None
    
    def test_single_request_executes_function(self):
        """Single request should execute the wrapped function."""
        mock_func = Mock(return_value="result")
        key_gen = Mock(return_value="key1")
        
        decorated = request_collapse_with_progress(mock_func, key_gen)
        result = decorated("arg1", "arg2")
        
        self.assertEqual(result, "result")
        mock_func.assert_called_once()
        key_gen.assert_called_once_with("arg1", "arg2")
    
    def test_concurrent_requests_same_params_collapse(self):
        """Concurrent requests with same parameters should collapse into one execution."""
        call_count = 0
        call_lock = threading.Lock()
        
        def slow_func(*args, progress_callback=None, cancel_event=None):
            nonlocal call_count
            with call_lock:
                call_count += 1
            time.sleep(0.1)
            return "result"
        
        decorated = request_collapse_with_progress(slow_func, lambda *args: "key1")
        
        results = []
        def worker():
            results.append(decorated("arg1", "arg2"))
        
        threads = [threading.Thread(target=worker) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        self.assertEqual(call_count, 1)
        self.assertEqual(results, ["result", "result", "result"])
    
    def test_sequential_requests_same_params_use_cache(self):
        """Sequential requests with same parameters should use cached result."""
        mock_func = Mock(return_value="result")
        decorated = request_collapse_with_progress(mock_func, lambda *args: "key1")
        
        result1 = decorated("arg1", "arg2")
        result2 = decorated("arg1", "arg2")
        
        self.assertEqual(result1, "result")
        self.assertEqual(result2, "result")
        mock_func.assert_called_once()
    
    def test_different_params_execute_separately(self):
        """Requests with different parameters should execute separately."""
        mock_func = Mock(side_effect=["result1", "result2"])
        key_gen = Mock(side_effect=["key1", "key2"])
        
        decorated = request_collapse_with_progress(mock_func, key_gen)
        
        result1 = decorated("arg1")
        result2 = decorated("arg2")
        
        self.assertEqual(result1, "result1")
        self.assertEqual(result2, "result2")
        self.assertEqual(mock_func.call_count, 2)
    
    def test_progress_callback_receives_updates(self):
        """Progress callback should receive updates from wrapped function."""
        def func_with_progress(*args, progress_callback=None, cancel_event=None):
            if progress_callback:
                progress_callback("step1", 25)
                progress_callback("step2", 50)
                progress_callback("step3", 100)
            return "result"
        
        decorated = request_collapse_with_progress(func_with_progress, lambda *args: "key1")
        
        callback = Mock()
        result = decorated("arg1", progress_callback=callback)
        
        self.assertEqual(result, "result")
        self.assertEqual(callback.call_count, 3)
        callback.assert_has_calls([
            call("step1", 25),
            call("step2", 50),
            call("step3", 100)
        ])
    
    def test_multiple_callbacks_receive_progress(self):
        """Multiple concurrent requests should all receive progress updates."""
        def slow_func(*args, progress_callback=None, cancel_event=None):
            if progress_callback:
                progress_callback("start", 0)
                time.sleep(0.05)
                progress_callback("middle", 50)
                time.sleep(0.05)
                progress_callback("end", 100)
            return "result"
        
        decorated = request_collapse_with_progress(slow_func, lambda *args: "key1")
        
        callbacks = [Mock(), Mock(), Mock()]
        results = []
        
        def worker(cb):
            results.append(decorated("arg1", progress_callback=cb))
        
        threads = [threading.Thread(target=worker, args=(cb,)) for cb in callbacks]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        self.assertEqual(results, ["result", "result", "result"])
        for cb in callbacks:
            self.assertGreaterEqual(cb.call_count, 1)
    
    def test_cached_result_sends_immediate_progress(self):
        """Cached result should send immediate 100% progress."""
        mock_func = Mock(return_value="result")
        decorated = request_collapse_with_progress(mock_func, lambda *args: "key1")
        
        # First call to populate cache
        decorated("arg1")
        
        # Second call should use cache
        callback = Mock()
        result = decorated("arg1", progress_callback=callback)
        
        self.assertEqual(result, "result")
        callback.assert_called_once_with(100, "Using cached result")
    
    def test_exception_propagates_to_all_waiters(self):
        """Exception in wrapped function should propagate to all waiting requests."""
        def failing_func(*args, progress_callback=None, cancel_event=None):
            time.sleep(0.05)
            raise ValueError("test error")
        
        decorated = request_collapse_with_progress(failing_func, lambda *args: "key1")
        
        exceptions = []
        
        def worker():
            try:
                decorated("arg1")
            except ValueError as e:
                exceptions.append(e)
        
        threads = [threading.Thread(target=worker) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        self.assertEqual(len(exceptions), 3)
        for exc in exceptions:
            self.assertEqual(str(exc), "test error")
    
    def test_exception_not_cached_for_non_interrupted_errors(self):
        """Non-InterruptedError exceptions should be cached and re-raised."""
        call_count = 0
        
        def failing_func(*args, progress_callback=None, cancel_event=None):
            nonlocal call_count
            call_count += 1
            raise ValueError("test error")
        
        decorated = request_collapse_with_progress(failing_func, lambda *args: "key1")
        
        with self.assertRaises(ValueError):
            decorated("arg1")
        
        with self.assertRaises(ValueError):
            decorated("arg1")
        
        # Should only execute once, second call uses cached error
        self.assertEqual(call_count, 1)
    
    def test_interrupted_error_clears_cache(self):
        """InterruptedError should clear cache allowing new requests."""
        call_count = 0
        
        def func(*args, progress_callback=None, cancel_event=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise InterruptedError("cancelled")
            return "result"
        
        decorated = request_collapse_with_progress(func, lambda *args: "key1")
        
        with self.assertRaises(InterruptedError):
            decorated("arg1")
        
        # Second call should execute again (cache was cleared)
        result = decorated("arg1")
        self.assertEqual(result, "result")
        self.assertEqual(call_count, 2)
    
    def test_parameter_change_cancels_previous_operation(self):
        """Changing parameters should cancel the previous operation."""
        cancel_events = []
        
        def slow_func(*args, progress_callback=None, cancel_event=None):
            if cancel_event:
                cancel_events.append(cancel_event)
            time.sleep(0.1)
            if cancel_event and cancel_event.is_set():
                raise InterruptedError("cancelled")
            return f"result-{args[0]}"
        
        decorated = request_collapse_with_progress(slow_func, lambda *args: f"key-{args[0]}")
        
        results = []
        exceptions = []
        
        def worker1():
            try:
                results.append(decorated("param1"))
            except InterruptedError as e:
                exceptions.append(e)
        
        def worker2():
            time.sleep(0.02)  # Start slightly after worker1
            try:
                results.append(decorated("param2"))
            except InterruptedError as e:
                exceptions.append(e)
        
        t1 = threading.Thread(target=worker1)
        t2 = threading.Thread(target=worker2)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        
        # First operation's cancel event should be set
        self.assertGreater(len(cancel_events), 0)
        self.assertTrue(cancel_events[0].is_set())
    
    def test_waiting_request_detects_cache_replacement(self):
        """Waiting request should detect when cache entry is replaced."""
        def slow_func(*args, progress_callback=None, cancel_event=None):
            time.sleep(0.1)
            return f"result-{args[0]}"
        
        decorated = request_collapse_with_progress(slow_func, lambda *args: f"key-{args[0]}")
        
        exceptions = []
        
        def worker1():
            try:
                decorated("param1")
            except InterruptedError as e:
                exceptions.append(("worker1", e))
        
        def worker2():
            try:
                decorated("param1")
            except InterruptedError as e:
                exceptions.append(("worker2", e))
        
        def worker3():
            time.sleep(0.02)
            try:
                decorated("param2")
            except InterruptedError as e:
                exceptions.append(("worker3", e))
        
        threads = [
            threading.Thread(target=worker1),
            threading.Thread(target=worker2),
            threading.Thread(target=worker3)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Worker1 and Worker2 should detect cache replacement
        exception_sources = [src for src, _ in exceptions]
        self.assertIn("worker2", exception_sources)
    
    def test_cancel_event_passed_to_function(self):
        """Cancel event should be passed to the wrapped function."""
        received_cancel_event = None
        
        def func(*args, progress_callback=None, cancel_event=None):
            nonlocal received_cancel_event
            received_cancel_event = cancel_event
            return "result"
        
        decorated = request_collapse_with_progress(func, lambda *args: "key1")
        decorated("arg1")
        
        self.assertIsNotNone(received_cancel_event)
        self.assertIsInstance(received_cancel_event, threading.Event)
    
    def test_no_progress_callback_works(self):
        """Function should work without progress callback."""
        mock_func = Mock(return_value="result")
        decorated = request_collapse_with_progress(mock_func, lambda *args: "key1")
        
        result = decorated("arg1")
        
        self.assertEqual(result, "result")
        mock_func.assert_called_once()
    
    def test_cache_cleared_on_none_entry(self):
        """Waiting request should handle cache being cleared (None entry)."""
        from backend import request_collapse
        
        def slow_func(*args, progress_callback=None, cancel_event=None):
            time.sleep(0.1)
            return "result"
        
        decorated = request_collapse_with_progress(slow_func, lambda *args: "key1")
        
        exception_caught = False
        
        def worker1():
            decorated("arg1")
        
        def worker2():
            nonlocal exception_caught
            try:
                decorated("arg1")
            except InterruptedError:
                exception_caught = True
        
        def clear_cache():
            time.sleep(0.02)
            with request_collapse._cache_lock:
                request_collapse._current_cache_entry = None
                if request_collapse._current_cache_entry is not None:
                    request_collapse._current_cache_entry["event"].set()
        
        t1 = threading.Thread(target=worker1)
        t2 = threading.Thread(target=worker2)
        t3 = threading.Thread(target=clear_cache)
        
        t1.start()
        t2.start()
        t3.start()
        
        t1.join()
        t2.join()
        t3.join()
        
        self.assertTrue(exception_caught)
    
    def test_old_event_set_after_lock_release(self):
        """Old cache entry's event should be set after lock is released."""
        events_set = []
        
        def func(*args, progress_callback=None, cancel_event=None):
            time.sleep(0.05)
            return f"result-{args[0]}"
        
        decorated = request_collapse_with_progress(func, lambda *args: f"key-{args[0]}")
        
        def worker1():
            try:
                decorated("param1")
            except InterruptedError:
                pass
        
        def worker2():
            try:
                decorated("param1")
            except InterruptedError:
                events_set.append("worker2-interrupted")
        
        def worker3():
            time.sleep(0.01)
            decorated("param2")
        
        threads = [
            threading.Thread(target=worker1),
            threading.Thread(target=worker2),
            threading.Thread(target=worker3)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Worker2 should be interrupted when cache is replaced
        self.assertIn("worker2-interrupted", events_set)


if __name__ == "__main__":
    unittest.main()
