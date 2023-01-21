"""
Usage:
    python get_parameters_schema.py

FREECAD_LIB environment variable must be set.
"""
import os
import sys

sys.path.append(os.environ['FREECAD_LIB'])
import json

import FreeCAD
from openafpm_cad_core.app import get_parameters_schema

print(json.dumps(get_parameters_schema(), indent=2))
