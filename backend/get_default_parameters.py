"""
Usage:
    python get_default_parameters.py

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
from openafpm_cad_core.app import WindTurbine, get_default_parameters

print(json.dumps({
    WindTurbine.T_SHAPE.value: get_default_parameters(WindTurbine.T_SHAPE),
    WindTurbine.H_SHAPE.value: get_default_parameters(WindTurbine.H_SHAPE),
    WindTurbine.STAR_SHAPE.value: get_default_parameters(WindTurbine.STAR_SHAPE),
    WindTurbine.T_SHAPE_2F.value: get_default_parameters(WindTurbine.T_SHAPE_2F)
}, indent=2))
