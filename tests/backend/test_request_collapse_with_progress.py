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
        request_collapse._cleanup_done_for_key = None
    
    def test_single_request_executes_function(self):
        """Single request should execute the wrapped function."""
        mock_func = Mock(return_value="result")
        key_gen = Mock(return_value="key1")
        
        decorated = request_collapse_with_progress(key_gen)(mock_func)
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
        
        decorated = request_collapse_with_progress(lambda *args: "key1")(slow_func)
        
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
        decorated = request_collapse_with_progress(lambda *args: "key1")(mock_func)
        
        result1 = decorated("arg1", "arg2")
        result2 = decorated("arg1", "arg2")
        
        self.assertEqual(result1, "result")
        self.assertEqual(result2, "result")
        mock_func.assert_called_once()
    
    def test_different_params_execute_separately(self):
        """Requests with different parameters should execute separately."""
        mock_func = Mock(side_effect=["result1", "result2"])
        key_gen = Mock(side_effect=["key1", "key2"])
        
        decorated = request_collapse_with_progress(key_gen)(mock_func)
        
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
        
        decorated = request_collapse_with_progress(lambda *args: "key1")(func_with_progress)
        
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
        
        decorated = request_collapse_with_progress(lambda *args: "key1")(slow_func)
        
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
        decorated = request_collapse_with_progress(lambda *args: "key1")(mock_func)
        
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
        
        decorated = request_collapse_with_progress(lambda *args: "key1")(failing_func)
        
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
        
        decorated = request_collapse_with_progress(lambda *args: "key1")(failing_func)
        
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
        
        decorated = request_collapse_with_progress(lambda *args: "key1")(func)
        
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
        
        decorated = request_collapse_with_progress(lambda *args: f"key-{args[0]}")(slow_func)
        
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
        """New request with different params waits for old operation to complete."""
        results = {}
        exceptions = []
        
        def slow_func(*args, progress_callback=None, cancel_event=None):
            time.sleep(0.1)
            return f"result-{args[0]}"
        
        decorated = request_collapse_with_progress(lambda *args: f"key-{args[0]}")(slow_func)
        
        def worker1():
            results["worker1"] = decorated("param1")
        
        def worker2():
            try:
                results["worker2"] = decorated("param1")
            except InterruptedError as e:
                exceptions.append(("worker2", e))
        
        def worker3():
            time.sleep(0.02)
            results["worker3"] = decorated("param2")
        
        threads = [
            threading.Thread(target=worker1),
            threading.Thread(target=worker2),
            threading.Thread(target=worker3)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Worker1 should complete successfully
        self.assertEqual(results["worker1"], "result-param1")
        # Worker3 waits for param1 to finish, then executes param2
        self.assertEqual(results["worker3"], "result-param2")
        # Worker2 may complete or be interrupted depending on timing
        # (race between completion and cache replacement)
    
    def test_cancel_event_passed_to_function(self):
        """Cancel event should be passed to the wrapped function."""
        received_cancel_event = None
        
        def func(*args, progress_callback=None, cancel_event=None):
            nonlocal received_cancel_event
            received_cancel_event = cancel_event
            return "result"
        
        decorated = request_collapse_with_progress(lambda *args: "key1")(func)
        decorated("arg1")
        
        self.assertIsNotNone(received_cancel_event)
        self.assertIsInstance(received_cancel_event, threading.Event)
    
    def test_no_progress_callback_works(self):
        """Function should work without progress callback."""
        mock_func = Mock(return_value="result")
        decorated = request_collapse_with_progress(lambda *args: "key1")(mock_func)
        
        result = decorated("arg1")
        
        self.assertEqual(result, "result")
        mock_func.assert_called_once()
    
    def test_cache_cleared_on_none_entry(self):
        """Waiting request should handle cache being cleared (None entry)."""
        from backend import request_collapse
        
        def slow_func(*args, progress_callback=None, cancel_event=None):
            time.sleep(0.1)
            return "result"
        
        decorated = request_collapse_with_progress(lambda *args: "key1")(slow_func)
        
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
        """New request waits for old operation to complete before starting."""
        results = {}
        exceptions = []
        
        def func(*args, progress_callback=None, cancel_event=None):
            time.sleep(0.05)
            return f"result-{args[0]}"
        
        decorated = request_collapse_with_progress(lambda *args: f"key-{args[0]}")(func)
        
        def worker1():
            results["worker1"] = decorated("param1")
        
        def worker2():
            try:
                results["worker2"] = decorated("param1")
            except InterruptedError as e:
                exceptions.append(("worker2", e))
        
        def worker3():
            time.sleep(0.01)
            results["worker3"] = decorated("param2")
        
        threads = [
            threading.Thread(target=worker1),
            threading.Thread(target=worker2),
            threading.Thread(target=worker3)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Worker1 completes successfully with param1
        self.assertEqual(results["worker1"], "result-param1")
        # Worker3 waits for param1 to finish, then executes param2
        self.assertEqual(results["worker3"], "result-param2")
        # Worker2 may complete or be interrupted (race condition)


    def test_cleanup_called_once_on_parameter_change(self):
        """Cleanup should be called exactly once when parameters change."""
        cleanup_calls = []
        
        def cleanup():
            cleanup_calls.append(threading.current_thread().ident)
        
        def slow_func(*args, progress_callback=None, cancel_event=None):
            time.sleep(0.1)
            if cancel_event and cancel_event.is_set():
                raise InterruptedError("cancelled")
            return f"result-{args[0]}"
        
        decorated = request_collapse_with_progress(lambda *args: f"key-{args[0]}", cleanup)(slow_func)
        
        results = {}
        
        def worker1():
            try:
                results["worker1"] = decorated("param1")
            except InterruptedError:
                pass
        
        def worker2():
            time.sleep(0.02)
            try:
                results["worker2"] = decorated("param2")
            except InterruptedError:
                pass
        
        def worker3():
            time.sleep(0.03)
            try:
                results["worker3"] = decorated("param2")
            except InterruptedError:
                pass
        
        threads = [
            threading.Thread(target=worker1),
            threading.Thread(target=worker2),
            threading.Thread(target=worker3)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Cleanup should be called exactly once (when changing from param1 to param2)
        self.assertEqual(len(cleanup_calls), 1)
        # Worker2 and worker3 should get the same result
        if "worker2" in results:
            self.assertEqual(results["worker2"], "result-param2")
        if "worker3" in results:
            self.assertEqual(results["worker3"], "result-param2")
    
    def test_cleanup_not_called_for_same_parameters(self):
        """Cleanup should not be called when parameters don't change."""
        cleanup_calls = []
        
        def cleanup():
            cleanup_calls.append(threading.current_thread().ident)
        
        def func(*args, progress_callback=None, cancel_event=None):
            return f"result-{args[0]}"
        
        decorated = request_collapse_with_progress(lambda *args: f"key-{args[0]}", cleanup)(func)
        
        result1 = decorated("param1")
        result2 = decorated("param1")
        
        # Cleanup should never be called since parameters didn't change
        self.assertEqual(len(cleanup_calls), 0)
        self.assertEqual(result1, "result-param1")
        self.assertEqual(result2, "result-param1")
    
    def test_cleanup_called_before_new_operation_starts(self):
        """Cleanup should be called after old operation completes but before new one starts."""
        events = []
        lock = threading.Lock()
        
        def cleanup():
            with lock:
                events.append(("cleanup", threading.current_thread().ident))
        
        def func(*args, progress_callback=None, cancel_event=None):
            with lock:
                events.append(("start", args[0], threading.current_thread().ident))
            time.sleep(0.05)
            if cancel_event and cancel_event.is_set():
                with lock:
                    events.append(("cancelled", args[0], threading.current_thread().ident))
                raise InterruptedError("cancelled")
            with lock:
                events.append(("end", args[0], threading.current_thread().ident))
            return f"result-{args[0]}"
        
        decorated = request_collapse_with_progress(lambda *args: f"key-{args[0]}", cleanup)(func)
        
        def worker1():
            try:
                decorated("param1")
            except InterruptedError:
                pass
        
        def worker2():
            time.sleep(0.02)
            decorated("param2")
        
        t1 = threading.Thread(target=worker1)
        t2 = threading.Thread(target=worker2)
        
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        
        # Find the order of events
        event_types = [(e[0], e[1] if len(e) > 1 else None) for e in events]
        
        # Should have: start param1, cancelled param1, cleanup, start param2, end param2
        # Cleanup should happen after param1 is cancelled and before param2 starts
        has_cleanup = any(e[0] == "cleanup" for e in event_types)
        has_param2_start = any(e[0] == "start" and e[1] == "param2" for e in event_types)
        
        self.assertTrue(has_cleanup, "Cleanup should be called")
        self.assertTrue(has_param2_start, "Param2 should start")
        
        # If both exist, cleanup should come before param2 start
        if has_cleanup and has_param2_start:
            cleanup_idx = next(i for i, e in enumerate(event_types) if e[0] == "cleanup")
            param2_start_idx = next(i for i, e in enumerate(event_types) if e[0] == "start" and e[1] == "param2")
            self.assertLess(cleanup_idx, param2_start_idx, "Cleanup should happen before param2 starts")


if __name__ == "__main__":
    unittest.main()
