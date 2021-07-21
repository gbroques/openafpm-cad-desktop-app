"""
Usage:
    python get_default_parameters.py

FREECAD_LIB environment variable must be set.
"""
import os
import sys

sys.path.append(os.environ['FREECAD_LIB'])
import json
from enum import Enum, unique

import FreeCAD
from openafpm_cad_core.app import get_default_parameters


@unique
class WindTurbine(Enum):
    T_SHAPE = 'T Shape'
    H_SHAPE = 'H Shape'
    STAR_SHAPE = 'Star Shape'

print(json.dumps({
    WindTurbine.T_SHAPE.value: get_default_parameters(WindTurbine.T_SHAPE.value),
    WindTurbine.H_SHAPE.value: get_default_parameters(WindTurbine.H_SHAPE.value),
    WindTurbine.STAR_SHAPE.value: get_default_parameters(WindTurbine.STAR_SHAPE.value)
}, indent=2))
