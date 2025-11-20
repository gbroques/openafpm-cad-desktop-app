#!/usr/bin/env python3
"""
Test the specific concurrent scenario:
1. Start 3 concurrent requests (visualize, getcncoverview, getdimensiontables) with same parameters
2. While they're loading, start another visualize request with different assembly but same parameters
3. Verify load_all is shared but individual operations are separate
"""

import subprocess
import time
import threading
import requests
from concurrent.futures import ThreadPoolExecutor
import json

def test_sse_endpoint(url, name, results_dict):
    """Test an SSE endpoint and collect results."""
    try:
        print(f"[{name}] Starting request...")
        start_time = time.time()
        
        # Use curl to test SSE endpoint
        process = subprocess.Popen([
            "curl", "-N", "-m", "30", 
            "-H", "Accept: text/event-stream",
            url
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        stdout, stderr = process.communicate()
        end_time = time.time()
        
        # Parse events
        events = []
        for line in stdout.split('\n'):
            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])  # Remove 'data: ' prefix
                    events.append(data)
                except:
                    pass
        
        results_dict[name] = {
            'duration': end_time - start_time,
            'events': events,
            'success': 'error' not in stdout or 'complete' in stdout
        }
        
        print(f"[{name}] Completed in {end_time - start_time:.1f}s, {len(events)} events")
        
    except Exception as e:
        results_dict[name] = {'error': str(e)}
        print(f"[{name}] Failed: {e}")

def main():
    print("=== Testing Concurrent Multi-Endpoint Scenario ===")
    
    # Start API server
    print("Starting API server...")
    api_process = subprocess.Popen([
        "../squashfs-root/usr/bin/python", "api.py", "--port", "8007"
    ], 
    env={"FREECAD_LIB": "../squashfs-root/usr/lib", "PYTHONPATH": "../squashfs-root/usr/lib"},
    cwd="/home/g/Projects/openafpm-cad-desktop-app/backend",
    stdout=subprocess.PIPE, 
    stderr=subprocess.PIPE
    )
    
    # Wait for server to start
    time.sleep(5)
    
    try:
        # Test parameters (using valid preset parameters)
        base_url = "http://127.0.0.1:8007"
        params = (
            "magnafpm.RotorDiskRadius=150&"
            "magnafpm.DiskThickness=10&"
            "magnafpm.NumberMagnet=12&"
            "furling.Offset=125&"
            "user.EnableFurling=true"
        )
        
        # URLs for the 3 concurrent requests
        urls = {
            'visualize_wind': f"{base_url}/api/visualize/WindTurbine/stream?{params}",
            'cnc_overview': f"{base_url}/api/getcncoverview/stream?{params}",
            'dimensions': f"{base_url}/api/getdimensiontables/stream?{params}"
        }
        
        results = {}
        
        print(f"\n1. Starting 3 concurrent requests with same parameters...")
        print(f"   - Visualize WindTurbine")
        print(f"   - CNC Overview") 
        print(f"   - Dimension Tables")
        
        # Start 3 concurrent requests
        with ThreadPoolExecutor(max_workers=4) as executor:
            # Submit first 3 requests
            futures = []
            for name, url in urls.items():
                future = executor.submit(test_sse_endpoint, url, name, results)
                futures.append(future)
            
            # Wait 3 seconds, then start the 4th request with different assembly
            time.sleep(3)
            print(f"\n2. Starting 4th request (different assembly, same parameters)...")
            print(f"   - Visualize Stator (should reuse load_all cache)")
            
            blade_url = f"{base_url}/api/visualize/Stator/stream?{params}"
            future_blade = executor.submit(test_sse_endpoint, blade_url, 'visualize_stator', results)
            futures.append(future_blade)
            
            # Wait for all to complete
            for future in futures:
                future.result()
        
        print(f"\n=== Results Analysis ===")
        
        # Analyze results
        for name, result in results.items():
            if 'error' in result:
                print(f"❌ {name}: {result['error']}")
            else:
                duration = result['duration']
                events = result['events']
                success = result['success']
                
                progress_events = [e for e in events if 'progress' in e]
                max_progress = max([e.get('progress', 0) for e in progress_events]) if progress_events else 0
                
                status = "✅" if success else "⚠️"
                print(f"{status} {name}: {duration:.1f}s, {len(progress_events)} progress events, max progress: {max_progress}%")
        
        # Check if load_all was shared (first 3 should take longer, 4th should be faster)
        if all(name in results for name in ['visualize_wind', 'cnc_overview', 'dimensions', 'visualize_stator']):
            first_three_avg = sum(results[name]['duration'] for name in ['visualize_wind', 'cnc_overview', 'dimensions']) / 3
            fourth_duration = results['visualize_stator']['duration']
            
            print(f"\n=== Cache Behavior Analysis ===")
            print(f"First 3 requests average: {first_three_avg:.1f}s")
            print(f"4th request (different assembly): {fourth_duration:.1f}s")
            
            if fourth_duration < first_three_avg * 0.7:  # Should be significantly faster
                print("✅ Cache behavior: 4th request was faster (load_all cache hit)")
            else:
                print("⚠️ Cache behavior: 4th request wasn't significantly faster")
        
    except Exception as e:
        print(f"Test failed: {e}")
    
    finally:
        # Clean up
        print(f"\nCleaning up...")
        api_process.terminate()
        api_process.wait(timeout=5)

if __name__ == "__main__":
    main()
