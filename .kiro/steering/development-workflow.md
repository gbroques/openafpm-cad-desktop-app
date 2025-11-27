# Development Workflow

## Setup Commands
- `yarn install` - Install Node.js dependencies
- `./install-python-dependencies.sh` - Install Python dependencies
- `npm start` - Run development server

## Build Commands
- `npm run pack` - Generate package directory
- `npm run dist` - Package for distribution

## Testing & Quality
- Use `.flake8` for Python linting
- Use `.mypy.ini` for Python type checking
- Test Python integration with FreeCAD before commits

## Dependencies
- FreeCAD 1.0+ automatically downloaded on first run
- openafpm-cad-core and freecad-to-obj cloned to site-packages/
- Python dependencies (fastapi, uvicorn) installed to site-packages/
- Environment variables configured in `.env` file

## Common Issues
- Python subprocess spawning requires `asar: false`
- `FREECAD_LIB` environment variable must point to FreeCAD library path
- PYTHONPATH must include both site-packages/ and cloned repo directories (site-packages/openafpm-cad-core, site-packages/freecad-to-obj)
- FreeCAD downloads to app data directory on first run (~800MB)
