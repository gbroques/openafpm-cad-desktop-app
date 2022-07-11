"""
Usage:
    python visualize.py <base path> <obj filename> <furl transforms filename>.

FREECAD_LIB environment variable must be set.
"""
import os
import sys
sys.path.append(os.environ['FREECAD_LIB'])
import FreeCAD
from openafpm_cad_core.app import (Assembly, assembly_to_obj,
                                   close_all_documents, create_archive,
                                   load_furl_transforms)
import json

with open('parameters.json') as f:
    parameters = json.loads(f.read())

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
close_all_documents()

path = os.path.dirname(obj_filepath)
zip_bytes = create_archive(magnafpm_parameters,
                           user_parameters,
                           furling_parameters)
archive_path = os.path.join(base_path, 'WindTurbine.zip')
with open(archive_path, 'wb') as f:
    f.write(zip_bytes)
close_all_documents()

furl_transforms_filename = sys.argv[3]
furl_transforms_filepath = os.path.join(base_path, furl_transforms_filename)
with open(furl_transforms_filepath, 'w') as f:
    furl_transforms = load_furl_transforms(magnafpm_parameters,
                                           user_parameters,
                                           furling_parameters)
    f.write(json.dumps(furl_transforms, indent=2))
    print(furl_transforms_filepath + ' created.')
