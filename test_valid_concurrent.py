#!/usr/bin/env python3
"""
Test concurrent scenario with complete valid T Shape parameters
"""

import subprocess
import time
import threading

def test_sse_endpoint_simple(url, name):
    """Test an SSE endpoint and show basic results."""
    try:
        print(f"[{name}] Starting request...")
        start_time = time.time()
        
        # Use curl with timeout
        process = subprocess.Popen([
            "curl", "-N", "-m", "20", 
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
                    print(f"[{name}] Error: {error_data[:100]}...")
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
    print("=== Testing Concurrent Scenario with Complete Valid Parameters ===")
    
    # Start API server
    print("Starting API server...")
    api_process = subprocess.Popen([
        "../squashfs-root/usr/bin/python", "api.py", "--port", "8011"
    ], 
    env={"FREECAD_LIB": "../squashfs-root/usr/lib", "PYTHONPATH": "../squashfs-root/usr/lib"},
    cwd="/home/g/Projects/openafpm-cad-desktop-app/backend",
    stdout=subprocess.PIPE, 
    stderr=subprocess.PIPE
    )
    
    # Wait for server to start
    time.sleep(5)
    
    try:
        # Use complete valid T Shape parameters (key ones for testing)
        base_url = "http://127.0.0.1:8011"
        
        # Build parameter string with essential T Shape parameters
        magnafpm_params = [
            "magnafpm.RotorDiameter=2400",
            "magnafpm.RotorTopology=Double", 
            "magnafpm.RotorDiskRadius=150",
            "magnafpm.RotorDiskThickness=10",
            "magnafpm.NumberMagnet=12"
        ]
        
        furling_params = [
            "furling.Offset=125",
            "furling.BoomLength=1000"
        ]
        
        user_params = [
            "user.WindTurbineShape=Calculated",
            "user.BladeWidth=124"
        ]
        
        params = "&".join(magnafpm_params + furling_params + user_params)
        
        print(f"\n1. Testing single endpoint first...")
        test_url = f"{base_url}/api/visualize/WindTurbine/stream?{params}"
        result = test_sse_endpoint_simple(test_url, "single_test")
        
        if 'error' in result or not result.get('success', False):
            print(f"❌ Single test failed or had errors, but continuing with concurrent test...")
        
        print(f"\n2. Starting concurrent test scenario...")
        print("This tests the specific scenario you mentioned:")
        print("- 3 concurrent requests (visualize, cnc, dimensions) with same parameters")
        print("- Then a 4th request (different assembly) with same parameters")
        
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
        
        print("\nStarting 3 concurrent requests...")
        for url, name in urls:
            thread = threading.Thread(target=run_test, args=(url, name))
            thread.start()
            threads.append(thread)
            time.sleep(0.1)  # Small delay between starts
        
        # Wait 2 seconds, then start 4th request with different assembly
        time.sleep(2)
        print("Starting 4th request with different assembly (Stator)...")
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
        
        # Analyze cache behavior
        if all(name in results and 'duration' in results[name] for name in ['visualize_wind', 'cnc_overview', 'dimensions', 'visualize_stator']):
            first_three = [results[name]['duration'] for name in ['visualize_wind', 'cnc_overview', 'dimensions']]
            fourth = results['visualize_stator']['duration']
            
            print(f"\n=== Cache Analysis ===")
            print(f"First 3 requests: {[f'{d:.1f}s' for d in first_three]}")
            print(f"4th request (different assembly): {fourth:.1f}s")
            
            # The 4th request should potentially be faster if load_all cache is hit
            avg_first_three = sum(first_three) / len(first_three)
            if fourth < avg_first_three * 0.8:
                print("✅ Cache behavior: 4th request was faster (likely cache hit)")
            else:
                print("ℹ️ Cache behavior: 4th request similar speed (may indicate cache miss or fast execution)")
        
    except Exception as e:
        print(f"Test failed: {e}")
    
    finally:
        print(f"\nCleaning up...")
        api_process.terminate()
        api_process.wait(timeout=5)

if __name__ == "__main__":
    main()
