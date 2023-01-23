"""
Usage:
    python get_parameters_schema.py

FREECAD_LIB environment variable must be set.
"""
import os
import sys
from pathlib import Path
root_path = Path(__file__).parent.parent
freecad_lib = str(root_path.joinpath(os.environ['FREECAD_LIB']).resolve())
sys.path.append(freecad_lib)
import json

import FreeCAD
from openafpm_cad_core.app import get_parameters_schema

print(json.dumps(get_parameters_schema(), indent=2))
