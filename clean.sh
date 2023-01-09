#!/bin/sh
# ----------------------------
# Remove auto-generated files.
# ----------------------------

# Print executed commands 
set -x

rm frontend/furl-transforms.json \
  frontend/wind-turbine.obj \
  frontend/WindTurbine.zip

rm backend/parameters.json
