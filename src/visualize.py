"""
Usage:
    python visualize.py <obj filepath>
"""
import sys
sys.path.append('/home/g/Desktop/squashfs-root/usr/lib/')
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
