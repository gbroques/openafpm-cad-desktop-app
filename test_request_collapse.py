#!/usr/bin/env python3
"""
Test request collapse with progress functionality
"""

import os
import sys
from pathlib import Path
import threading
import time

# Add FreeCAD lib directory to sys.path for importing FreeCAD.
root_path = Path(__file__).absolute().parent.parent
freecad_lib = str(root_path.joinpath(os.environ["FREECAD_LIB"]).resolve())
sys.path.insert(1, freecad_lib)

import FreeCAD as App
from openafpm_cad_core.app import get_default_parameters, get_presets
from request_collapse import request_collapse_with_progress

print("Testing request collapse with progress...")

# Create a test function that simulates load_all with progress
@request_collapse_with_progress
def test_load_all_with_progress(magnafpm_params, furling_params, user_params, progress_callback=None):
    """Simulate load_all with progress updates."""
    print(f"[{threading.current_thread().ident}] Starting load_all simulation...")
    
    stages = [
        (10, "Initializing FreeCAD"),
        (25, "Loading documents"),
        (50, "Processing geometry"),
        (75, "Finalizing models"),
        (80, "Load complete")
    ]
    
    for progress, message in stages:
        if progress_callback:
            progress_callback(progress, message)
        time.sleep(0.5)  # Simulate work
    
    print(f"[{threading.current_thread().ident}] Completed load_all simulation")
    return {"documents": "mock_documents", "spreadsheet": "mock_spreadsheet"}

# Get test parameters
presets = get_presets()
first_preset = presets[0]
params = get_default_parameters(first_preset)

magnafpm_params = params["magnafpm"]
furling_params = params["furling"] 
user_params = params["user"]

print(f"Using preset: {first_preset}")

# Test single execution
print("\n=== Test 1: Single execution ===")
def progress_callback_1(progress, message):
    print(f"Client 1 - {progress}%: {message}")

result1 = test_load_all_with_progress(magnafpm_params, furling_params, user_params, progress_callback_1)
print(f"Result 1: {result1}")

# Test concurrent executions with same parameters
print("\n=== Test 2: Concurrent executions (same parameters) ===")
results = []
threads = []

def client_thread(client_id):
    def progress_callback(progress, message):
        print(f"Client {client_id} - {progress}%: {message}")
    
    result = test_load_all_with_progress(magnafpm_params, furling_params, user_params, progress_callback)
    results.append((client_id, result))
    print(f"Client {client_id} completed")

# Start 3 concurrent threads
for i in range(2, 5):
    thread = threading.Thread(target=client_thread, args=(i,))
    threads.append(thread)
    thread.start()
    time.sleep(0.1)  # Small delay to ensure they overlap

# Wait for all threads
for thread in threads:
    thread.join()

print(f"All concurrent results: {results}")

# Test cache hit
print("\n=== Test 3: Cache hit (same parameters) ===")
def progress_callback_cache(progress, message):
    print(f"Cache test - {progress}%: {message}")

result_cache = test_load_all_with_progress(magnafpm_params, furling_params, user_params, progress_callback_cache)
print(f"Cache result: {result_cache}")

print("\nAll request collapse tests completed!")
