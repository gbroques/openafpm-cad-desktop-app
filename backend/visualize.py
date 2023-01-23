"""
Usage:
    python visualize.py <base path> <obj filename> <parameters>

FREECAD_LIB environment variable must be set.
"""
import os
import sys
from pathlib import Path
root_path = Path(__file__).parent.parent
freecad_lib = str(root_path.joinpath(os.environ['FREECAD_LIB']).resolve())
sys.path.append(freecad_lib)
import FreeCAD
from openafpm_cad_core.app import Assembly, assembly_to_obj
import json

parameters = json.loads(sys.argv[3])
magnafpm_parameters = parameters['magnafpm']
user_parameters = parameters['user']
furling_parameters = parameters['furling']

obj_file_contents = assembly_to_obj(
    Assembly.WIND_TURBINE,
    magnafpm_parameters,
    user_parameters,
    furling_parameters)

base_path = sys.argv[1]
obj_filename = sys.argv[2]
obj_filepath = os.path.join(base_path, obj_filename)
with open(obj_filepath, 'w') as f:
    f.write(obj_file_contents)
    print(obj_filepath + ' created.')
