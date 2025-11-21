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
- `index.html` - Main application entry point
- `package.json` - Node.js dependencies and build config
- `install.sh` - Setup script for FreeCAD and dependencies

## Build Process
- Uses electron-builder for packaging
- `asar: false` to allow Python child processes
- Bundles Python interpreter from FreeCAD installation for distribution
