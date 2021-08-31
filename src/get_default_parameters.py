"""
Usage:
    python get_default_parameters.py

FREECAD_LIB environment variable must be set.
"""
import os
import sys

sys.path.append(os.environ['FREECAD_LIB'])
import json

import FreeCAD
from openafpm_cad_core.app import WindTurbine, get_default_parameters

print(json.dumps({
    WindTurbine.T_SHAPE.value: get_default_parameters(WindTurbine.T_SHAPE),
    WindTurbine.H_SHAPE.value: get_default_parameters(WindTurbine.H_SHAPE),
    WindTurbine.STAR_SHAPE.value: get_default_parameters(WindTurbine.STAR_SHAPE)
}, indent=2))
