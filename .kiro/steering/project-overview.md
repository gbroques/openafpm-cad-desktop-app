# OpenAFPM CAD Desktop App - Project Overview

This is an Electron desktop application that integrates openafpm-cad-core and openafpm-cad-visualization for wind turbine CAD modeling.

## Key Technologies
- Electron for desktop app framework
- Node.js/JavaScript for main process
- Python integration for CAD operations via openafpm-cad-core
- FreeCAD for 3D modeling backend
- Yarn for package management

## Project Structure
- `backend/` - Python backend code
- `frontend/` - Frontend JavaScript/HTML
- `site-packages/` - Python dependencies and cloned repos
- `index.html` - Main application entry point
- `package.json` - Node.js dependencies and build config
- `install-python-dependencies.sh` - Setup script for Python dependencies

## Build Process
- Uses electron-builder for packaging
- `asar: false` to allow Python child processes
- FreeCAD automatically downloaded on first run (not bundled)
- Bundles site-packages with Python dependencies for distribution
