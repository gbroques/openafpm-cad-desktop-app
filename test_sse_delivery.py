#!/usr/bin/env python3
"""
Test script to reproduce SSE delivery issue when switching between T Shape and H Shape parameters.
This simulates the exact scenario from the logs where operations complete successfully 
but results don't reach the frontend.
"""

import os
import sys
import asyncio
import aiohttp
import json
import time
from urllib.parse import urlencode

# Set up environment for FreeCAD
os.environ['FREECAD_LIB'] = '/home/g/Projects/openafpm-cad-desktop-app/squashfs-root/usr/lib'
sys.path.insert(0, '/home/g/Projects/openafpm-cad-desktop-app/squashfs-root/usr/Mod')

# Import after setting up paths
try:
    from openafpm_cad_core import get_default_parameters
    print("✅ Successfully imported openafpm_cad_core")
except ImportError as e:
    print(f"❌ Failed to import openafpm_cad_core: {e}")
    sys.exit(1)

# Test parameters
T_SHAPE_PARAMS = get_default_parameters()['T Shape']
H_SHAPE_PARAMS = get_default_parameters()['H Shape']

API_BASE_URL = 'http://127.0.0.1:8001'

def build_query_params(parameters):
    """Build query parameters from parameter dict"""
    params = []
    for group_name, group_params in parameters.items():
        for key, value in group_params.items():
            params.append((f"{group_name}.{key}", str(value)))
    return urlencode(params)

async def test_sse_endpoint(session, endpoint, parameters, test_name):
    """Test a single SSE endpoint and track its lifecycle"""
    query_params = build_query_params(parameters)
    url = f"{API_BASE_URL}{endpoint}?{query_params}"
    
    print(f"\n🔄 Starting {test_name}")
    print(f"URL: {endpoint}")
    
    try:
        async with session.get(url) as response:
            print(f"📡 Connected to SSE stream (status: {response.status})")
            
            async for line in response.content:
                line = line.decode('utf-8').strip()
                if not line:
                    continue
                    
                if line.startswith('data: '):
                    data_str = line[6:]  # Remove 'data: ' prefix
                    try:
                        data = json.loads(data_str)
                        if 'progress' in data:
                            print(f"📊 Progress: {data['progress']}% - {data.get('message', '')}")
                        elif 'objText' in data or 'svg' in data or 'tables' in data:
                            print(f"✅ {test_name} completed successfully!")
                            print(f"📦 Result keys: {list(data.keys())}")
                            return True
                        elif 'error' in data:
                            print(f"❌ {test_name} failed: {data['error']}")
                            return False
                    except json.JSONDecodeError:
                        print(f"⚠️  Could not parse SSE data: {data_str}")
                        
    except Exception as e:
        print(f"❌ {test_name} connection failed: {e}")
        return False
    
    print(f"⚠️  {test_name} ended without completion")
    return False

async def test_rapid_parameter_switching():
    """Test the exact scenario from logs: rapid switching between T Shape and H Shape"""
    print("🧪 Testing rapid parameter switching scenario")
    print("This reproduces the issue where operations complete but results don't reach frontend")
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Start T Shape operation
        print("\n" + "="*60)
        print("TEST 1: T Shape Operation")
        print("="*60)
        
        t_shape_task = asyncio.create_task(
            test_sse_endpoint(session, '/api/visualize/WindTurbine/stream', T_SHAPE_PARAMS, 'T Shape Visualize')
        )
        
        # Wait a bit for T Shape to start
        await asyncio.sleep(2)
        
        # Test 2: Start H Shape operation (should cancel T Shape)
        print("\n" + "="*60)
        print("TEST 2: H Shape Operation (should cancel T Shape)")
        print("="*60)
        
        h_shape_task = asyncio.create_task(
            test_sse_endpoint(session, '/api/visualize/BladeTemplate/stream', H_SHAPE_PARAMS, 'H Shape Visualize')
        )
        
        # Wait for both operations
        print("\n⏳ Waiting for operations to complete...")
        t_result, h_result = await asyncio.gather(t_shape_task, h_shape_task, return_exceptions=True)
        
        print(f"\n📊 Results:")
        print(f"  T Shape result: {t_result}")
        print(f"  H Shape result: {h_result}")
        
        # Test 3: Test multiple endpoints simultaneously (like in logs)
        print("\n" + "="*60)
        print("TEST 3: Multiple Endpoints Simultaneously")
        print("="*60)
        
        tasks = [
            asyncio.create_task(test_sse_endpoint(session, '/api/visualize/WindTurbine/stream', H_SHAPE_PARAMS, 'H Shape Visualize')),
            asyncio.create_task(test_sse_endpoint(session, '/api/getcncoverview/stream', H_SHAPE_PARAMS, 'H Shape CNC')),
            asyncio.create_task(test_sse_endpoint(session, '/api/getdimensiontables/stream', H_SHAPE_PARAMS, 'H Shape Dimensions')),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        print(f"\n📊 Multi-endpoint Results:")
        for i, result in enumerate(results):
            endpoint_names = ['Visualize', 'CNC', 'Dimensions']
            print(f"  {endpoint_names[i]}: {result}")

async def test_single_operation():
    """Test a single operation to ensure basic functionality works"""
    print("\n🧪 Testing single operation (baseline)")
    
    async with aiohttp.ClientSession() as session:
        result = await test_sse_endpoint(session, '/api/visualize/WindTurbine/stream', T_SHAPE_PARAMS, 'Single T Shape')
        print(f"Single operation result: {result}")
        return result

async def main():
    """Main test runner"""
    print("🚀 Starting SSE Delivery Test Suite")
    print("This tests the scenario where operations complete but results don't reach frontend")
    
    # Test 1: Single operation (baseline)
    await test_single_operation()
    
    # Test 2: Rapid parameter switching (the problematic scenario)
    await test_rapid_parameter_switching()
    
    print("\n🏁 Test suite completed")

if __name__ == "__main__":
    asyncio.run(main())
