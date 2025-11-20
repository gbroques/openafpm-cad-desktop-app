#!/usr/bin/env python3
"""
Simple test script for the API functionality
"""

import os
import sys
from pathlib import Path

# Add FreeCAD lib directory to sys.path for importing FreeCAD.
root_path = Path(__file__).absolute().parent.parent
freecad_lib = str(root_path.joinpath(os.environ["FREECAD_LIB"]).resolve())
sys.path.insert(1, freecad_lib)

import FreeCAD as App
from openafpm_cad_core.app import (
    get_default_parameters,
    get_presets,
)

print("Testing basic imports...")
print("FreeCAD imported successfully")
print("openafpm_cad_core imported successfully")

print("\nTesting get_presets...")
presets = get_presets()
print(f"Found {len(presets)} presets")

print("\nTesting get_default_parameters...")
presets = get_presets()
first_preset = presets[0]
default_params = get_default_parameters(first_preset)
print(f"Default parameters for '{first_preset}': {list(default_params.keys())}")

print("\nTesting progress broadcaster...")
from progress_broadcaster import ProgressBroadcaster

broadcaster = ProgressBroadcaster()
print(f"Initial callback count: {broadcaster.get_callback_count()}")

def test_callback(progress, message):
    print(f"Progress: {progress}% - {message}")

broadcaster.add_callback(test_callback)
print(f"After adding callback: {broadcaster.get_callback_count()}")

broadcaster.broadcast(50, "Test message")

print("\nAll tests passed!")
