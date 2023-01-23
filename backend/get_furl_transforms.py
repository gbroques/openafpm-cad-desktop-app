"""
Usage:
    python get_furl_tranforms.py <parameters>

FREECAD_LIB environment variable must be set.
"""
import os
import sys
from pathlib import Path
root_path = Path(__file__).parent.parent
freecad_lib = str(root_path.joinpath(os.environ['FREECAD_LIB']).resolve())
sys.path.append(freecad_lib)
import FreeCAD
from openafpm_cad_core.app import load_furl_transforms
import json

parameters = json.loads(sys.argv[1])
magnafpm_parameters = parameters['magnafpm']
user_parameters = parameters['user']
furling_parameters = parameters['furling']

furl_transforms = load_furl_transforms(magnafpm_parameters,
                                        user_parameters,
                                        furling_parameters)
print(json.dumps(furl_transforms))
