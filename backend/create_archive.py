"""
Usage:
    python create_archive.py <base path> <parameters>

FREECAD_LIB environment variable must be set.
"""
import os
import sys
from pathlib import Path
root_path = Path(__file__).parent.parent
freecad_lib = str(root_path.joinpath(os.environ['FREECAD_LIB']).resolve())
sys.path.append(freecad_lib)
import FreeCAD
from openafpm_cad_core.app import create_archive
import json

parameters = json.loads(sys.argv[2])
magnafpm_parameters = parameters['magnafpm']
user_parameters = parameters['user']
furling_parameters = parameters['furling']

zip_bytes = create_archive(magnafpm_parameters,
                           user_parameters,
                           furling_parameters)
base_path = sys.argv[1]
archive_path = os.path.join(base_path, 'WindTurbine.zip')
with open(archive_path, 'wb') as f:
    f.write(zip_bytes)
    print(archive_path + ' created.')
