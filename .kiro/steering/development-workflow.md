# Development Workflow

## Setup Commands
- `yarn install` - Install Node.js dependencies
- `./install.sh` - Install FreeCAD and Python dependencies
- `npm start` - Run development server

## Build Commands
- `npm run pack` - Generate package directory
- `npm run dist` - Package for distribution

## Testing & Quality
- Use `.flake8` for Python linting
- Use `.mypy.ini` for Python type checking
- Test Python integration with FreeCAD before commits

## Dependencies
- FreeCAD 1.0+ required for CAD operations
- openafpm-cad-core module must be installed
- Environment variables configured in `.env` file

## Common Issues
- Python subprocess spawning requires `asar: false`
- `FREECAD_LIB` environment variable must point to FreeCAD library path (e.g., `squashfs-root/usr/lib`)
- Python dependencies installed to bundled FreeCAD Python via: `squashfs-root/usr/bin/python -m pip install --target squashfs-root/usr/lib/python*/site-packages/ <package>` using `python -m pip`
