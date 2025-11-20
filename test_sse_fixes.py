#!/usr/bin/env python3
"""
Test script to verify SSE fixes for cancellation and progress updates.
"""

import subprocess
import time
import threading
import signal
import sys

def test_sse_with_cancellation(url, name, cancel_after_seconds=3):
    """Test an SSE endpoint and cancel it after a few seconds."""
    try:
        print(f"[{name}] Starting request...")
        start_time = time.time()
        
        process = subprocess.Popen([
            "curl", "-N", "-m", "30", 
            "-H", "Accept: text/event-stream",
            url
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Wait for specified time then cancel
        time.sleep(cancel_after_seconds)
        print(f"[{name}] Cancelling after {cancel_after_seconds}s...")
        process.terminate()
        
        stdout, stderr = process.communicate(timeout=5)
        end_time = time.time()
        
        # Count events
        progress_events = stdout.count('event: progress')
        complete_events = stdout.count('event: complete')
        cancelled_events = stdout.count('event: cancelled')
        error_events = stdout.count('event: error')
        
        print(f"[{name}] Stopped after {end_time - start_time:.1f}s")
        print(f"[{name}] Events: {progress_events} progress, {complete_events} complete, {cancelled_events} cancelled, {error_events} error")
        
        return {
            'duration': end_time - start_time,
            'progress_events': progress_events,
            'cancelled_events': cancelled_events,
            'complete_events': complete_events
        }
        
    except Exception as e:
        print(f"[{name}] Failed: {e}")
        return {'error': str(e)}

def test_parameter_switch():
    """Test switching parameters mid-operation (should trigger cancellation)."""
    base_url = "http://127.0.0.1:8000"
    
    # T Shape parameters
    t_params = [
        "magnafpm.RotorDiameter=2400",
        "magnafpm.RotorDiskRadius=150",
        "furling.Offset=125",
        "user.WindTurbineShape=T"
    ]
    
    # H Shape parameters (different)
    h_params = [
        "magnafpm.RotorDiameter=4200",
        "magnafpm.RotorDiskRadius=250",
        "furling.Offset=200",
        "user.WindTurbineShape=H"
    ]
    
    t_url = f"{base_url}/api/visualize/WindTurbine/stream?{'&'.join(t_params)}"
    h_url = f"{base_url}/api/visualize/WindTurbine/stream?{'&'.join(h_params)}"
    
    print("\n=== Test 1: Parameter Switch Scenario ===")
    print("Starting T Shape request...")
    
    # Start T Shape in background
    t_result = {}
    def run_t_shape():
        t_result.update(test_sse_with_cancellation(t_url, "T_Shape", cancel_after_seconds=999))
    
    t_thread = threading.Thread(target=run_t_shape)
    t_thread.start()
    
    # Wait 2 seconds, then start H Shape (should cancel T Shape)
    time.sleep(2)
    print("\nStarting H Shape request (should cancel T Shape)...")
    h_result = test_sse_with_cancellation(h_url, "H_Shape", cancel_after_seconds=999)
    
    # Wait for T Shape thread to finish
    t_thread.join(timeout=5)
    
    print("\n=== Results ===")
    print(f"T Shape: {t_result}")
    print(f"H Shape: {h_result}")
    
    # Check if T Shape was cancelled
    if t_result.get('cancelled_events', 0) > 0:
        print("✅ T Shape was properly cancelled")
    else:
        print("⚠️  T Shape cancellation event not detected")

def main():
    print("=== SSE Fixes Test ===")
    print("Make sure the API server is running on port 8000")
    print("Press Ctrl+C to stop\n")
    
    try:
        # Test 1: Simple cancellation
        print("=== Test 1: Simple Cancellation ===")
        base_url = "http://127.0.0.1:8000"
        params = [
            "magnafpm.RotorDiameter=2400",
            "magnafpm.RotorDiskRadius=150",
            "furling.Offset=125",
            "user.WindTurbineShape=T"
        ]
        url = f"{base_url}/api/visualize/WindTurbine/stream?{'&'.join(params)}"
        
        result = test_sse_with_cancellation(url, "simple_cancel", cancel_after_seconds=3)
        
        if result.get('progress_events', 0) > 0:
            print("✅ Progress events received")
        else:
            print("⚠️  No progress events received")
        
        # Test 2: Parameter switch
        time.sleep(2)
        test_parameter_switch()
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(0)

if __name__ == "__main__":
    main()
