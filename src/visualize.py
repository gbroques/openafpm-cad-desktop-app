"""
Usage:
    python visualize.py <obj filepath> <furl transforms filepath>.

FREECAD_LIB environment variable must be set.
"""
import os
import sys
sys.path.append(os.environ['FREECAD_LIB'])
import FreeCAD
from openafpm_cad_core.app import visualize
import json

with open('parameters.json') as f:
    parameters = json.loads(f.read())

magnafpm_parameters = parameters['magnafpm']
user_parameters = parameters['user']
furling_parameters = parameters['furling']

wind_turbine = visualize(magnafpm_parameters, user_parameters, furling_parameters)

obj_file_contents = wind_turbine.to_obj()

obj_filepath = sys.argv[1]
with open(obj_filepath, 'w') as f:
    f.write(obj_file_contents)
    print(obj_filepath + ' created.')

path = os.path.dirname(obj_filepath)
wind_turbine.save_to(path)

furl_transforms_filepath = sys.argv[2]
with open(furl_transforms_filepath, 'w') as f:
    furl_transforms = wind_turbine.get_furl_transforms()
    f.write(json.dumps(furl_transforms, indent=2))
    print(furl_transforms_filepath + ' created.')
