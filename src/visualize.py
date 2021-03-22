"""
Usage:
    python visualize.py <obj filepath>

FREECAD_LIB environment variable must be set.
"""
import os
import sys
sys.path.append(os.environ['FREECAD_LIB'])
import FreeCAD
from openafpm_cad_core import visualize
import json

with open('parameters.json') as f:
    parameters = json.loads(f.read())

magnafpm_parameters = parameters['magnafpm']
user_parameters = parameters['user']
furling_parameters = parameters['furling']

wind_turbine = visualize(magnafpm_parameters, user_parameters, furling_parameters)

obj_file_contents = wind_turbine.to_obj()

filepath = sys.argv[1]
with open(filepath, 'w') as f:
    f.write(obj_file_contents)
    print(filepath + ' created.')

path = os.path.dirname(filepath)
wind_turbine.save_to(path)
