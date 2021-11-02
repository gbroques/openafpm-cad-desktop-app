#!/bin/sh
# ----------------------------
# Remove auto-generated files.
# ----------------------------

# Print executed commands 
set -x

rm -rf public/documents

rm public/furl-transforms.json \
  public/wind-turbine.obj \
  public/WindTurbine.zip

rm src/parameters.json
