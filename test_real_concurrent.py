#!/usr/bin/env python3
"""
Test concurrent scenario with real T Shape parameters
"""

import subprocess
import time
import threading
import json

def test_sse_endpoint_simple(url, name):
    """Test an SSE endpoint and show basic results."""
    try:
        print(f"[{name}] Starting request...")
        start_time = time.time()
        
        # Use curl with shorter timeout for testing
        process = subprocess.Popen([
            "curl", "-N", "-m", "15", 
            "-H", "Accept: text/event-stream",
            url
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        stdout, stderr = process.communicate()
        end_time = time.time()
        
        # Count events
        progress_events = stdout.count('event: progress')
        complete_events = stdout.count('event: complete')
        error_events = stdout.count('event: error')
        
        print(f"[{name}] Completed in {end_time - start_time:.1f}s")
        print(f"[{name}] Events: {progress_events} progress, {complete_events} complete, {error_events} error")
        
        if error_events > 0:
            # Show first error
            lines = stdout.split('\n')
            for i, line in enumerate(lines):
                if 'event: error' in line and i+1 < len(lines):
                    error_data = lines[i+1].replace('data: ', '')
                    print(f"[{name}] Error: {error_data}")
                    break
        
        return {
            'duration': end_time - start_time,
            'progress_events': progress_events,
            'success': complete_events > 0
        }
        
    except Exception as e:
        print(f"[{name}] Failed: {e}")
        return {'error': str(e)}

def main():
    print("=== Testing Concurrent Scenario with Valid Parameters ===")
    
    # Start API server
    print("Starting API server...")
    api_process = subprocess.Popen([
        "../squashfs-root/usr/bin/python", "api.py", "--port", "8009"
    ], 
    env={"FREECAD_LIB": "../squashfs-root/usr/lib", "PYTHONPATH": "../squashfs-root/usr/lib"},
    cwd="/home/g/Projects/openafpm-cad-desktop-app/backend",
    stdout=subprocess.PIPE, 
    stderr=subprocess.PIPE
    )
    
    # Wait for server to start
    time.sleep(5)
    
    try:
        # Use valid T Shape parameters (subset for testing)
        base_url = "http://127.0.0.1:8009"
        params = (
            "magnafpm.RotorDiskRadius=150&"
            "magnafpm.RotorDiskThickness=10&"
            "magnafpm.NumberMagnet=12&"
            "magnafpm.MagnetLength=46&"
            "magnafpm.MagnetWidth=30&"
            "furling.Offset=125&"
            "user.EnableFurling=true"
        )
        
        print(f"\n1. Testing single endpoint first...")
        test_url = f"{base_url}/api/visualize/WindTurbine/stream?{params}"
        result = test_sse_endpoint_simple(test_url, "single_test")
        
        if 'error' in result:
            print(f"❌ Single test failed, skipping concurrent test")
            return
        
        print(f"\n2. Starting concurrent test...")
        
        # Test the concurrent scenario
        urls = [
            (f"{base_url}/api/visualize/WindTurbine/stream?{params}", "visualize_wind"),
            (f"{base_url}/api/getcncoverview/stream?{params}", "cnc_overview"),
            (f"{base_url}/api/getdimensiontables/stream?{params}", "dimensions")
        ]
        
        # Start first 3 concurrently
        threads = []
        results = {}
        
        def run_test(url, name):
            results[name] = test_sse_endpoint_simple(url, name)
        
        print("Starting 3 concurrent requests...")
        for url, name in urls:
            thread = threading.Thread(target=run_test, args=(url, name))
            thread.start()
            threads.append(thread)
            time.sleep(0.2)  # Small delay between starts
        
        # Wait 3 seconds, then start 4th request
        time.sleep(3)
        print("Starting 4th request with different assembly...")
        stator_url = f"{base_url}/api/visualize/Stator/stream?{params}"
        stator_thread = threading.Thread(target=run_test, args=(stator_url, "visualize_stator"))
        stator_thread.start()
        threads.append(stator_thread)
        
        # Wait for all to complete
        for thread in threads:
            thread.join()
        
        print(f"\n=== Results Summary ===")
        for name, result in results.items():
            if 'error' in result:
                print(f"❌ {name}: {result['error']}")
            else:
                duration = result['duration']
                progress = result['progress_events']
                success = "✅" if result['success'] else "⚠️"
                print(f"{success} {name}: {duration:.1f}s, {progress} progress events")
        
    except Exception as e:
        print(f"Test failed: {e}")
    
    finally:
        print(f"\nCleaning up...")
        api_process.terminate()
        api_process.wait(timeout=5)

if __name__ == "__main__":
    main()
