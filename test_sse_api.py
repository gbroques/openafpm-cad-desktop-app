#!/usr/bin/env python3
"""
Test SSE API endpoints
"""

import os
import sys
from pathlib import Path
import json
import asyncio
from typing import Dict, Any

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import uvicorn

# Add FreeCAD lib directory to sys.path for importing FreeCAD.
root_path = Path(__file__).absolute().parent.parent
freecad_lib = str(root_path.joinpath(os.environ["FREECAD_LIB"]).resolve())
sys.path.insert(1, freecad_lib)

import FreeCAD as App
from openafpm_cad_core.app import get_default_parameters, get_presets
from request_collapse import request_collapse_with_progress

app = FastAPI()

def parse_prefixed_parameters(query_params: Dict[str, str]) -> Dict[str, Any]:
    """Parse query parameters with dot notation and convert types."""
    result = {}
    
    for key, value in query_params.items():
        # Convert string values to appropriate types
        converted_value = convert_query_param_type(value)
        
        if "." in key:
            prefix, param_name = key.split(".", 1)
            if prefix not in result:
                result[prefix] = {}
            result[prefix][param_name] = converted_value
        else:
            result[key] = converted_value
    
    return result

def convert_query_param_type(value: str):
    """Convert string query param to appropriate type."""
    # Try boolean
    if value.lower() in ('true', 'false'):
        return value.lower() == 'true'
    
    # Try int
    try:
        if '.' not in value:
            return int(value)
    except ValueError:
        pass
    
    # Try float
    try:
        return float(value)
    except ValueError:
        pass
    
    # Return as string
    return value

@request_collapse_with_progress
def test_load_all_with_progress(magnafpm_params, furling_params, user_params, progress_callback=None):
    """Test version of load_all with progress."""
    import time
    import threading
    
    print(f"[{threading.current_thread().ident}] Starting test load_all...")
    
    stages = [
        (10, "Initializing FreeCAD"),
        (25, "Loading documents"),
        (40, "Processing geometry"),
        (60, "Building assemblies"),
        (80, "Load complete")
    ]
    
    for progress, message in stages:
        if progress_callback:
            progress_callback(progress, message)
        time.sleep(1)  # Simulate work
    
    print(f"[{threading.current_thread().ident}] Completed test load_all")
    return {"documents": "test_documents", "spreadsheet": "test_spreadsheet"}

@app.get("/api/test/stream")
async def test_stream(request: Request):
    """Test SSE endpoint."""
    query_params = dict(request.query_params)
    parameters = parse_prefixed_parameters(query_params)
    
    # Use default parameters if none provided
    if not parameters:
        presets = get_presets()
        first_preset = presets[0]
        default_params = get_default_parameters(first_preset)
        parameters = default_params
    
    async def event_stream():
        progress_queue = asyncio.Queue()
        
        def progress_callback(progress: int, message: str):
            try:
                asyncio.create_task(progress_queue.put({
                    "progress": progress, 
                    "message": message
                }))
            except:
                pass
        
        # Start background task
        task = asyncio.create_task(
            execute_test_with_progress(parameters, progress_callback)
        )
        
        try:
            while not task.done():
                try:
                    progress_data = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                    yield f"event: progress\ndata: {json.dumps(progress_data)}\n\n"
                except asyncio.TimeoutError:
                    continue
            
            result = await task
            yield f"event: complete\ndata: {json.dumps(result)}\n\n"
            
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(event_stream(), media_type="text/event-stream")

async def execute_test_with_progress(parameters: dict, progress_callback):
    """Execute test operation with progress updates."""
    loop = asyncio.get_event_loop()
    
    magnafpm_parameters = parameters["magnafpm"]
    furling_parameters = parameters["furling"] 
    user_parameters = parameters["user"]
    
    # Phase 1: load_all (0-80%)
    result = await loop.run_in_executor(
        None, 
        test_load_all_with_progress,
        magnafpm_parameters, furling_parameters, user_parameters, progress_callback
    )
    
    # Phase 2: Processing (80-100%)
    progress_callback(90, "Processing results...")
    await asyncio.sleep(1)  # Simulate processing
    
    progress_callback(100, "Completed test operation")
    return {"result": result, "status": "success"}

if __name__ == "__main__":
    print("Starting test SSE API server on port 8002...")
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="info")
