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
- FreeCAD 0.20 required for CAD operations
- openafpm-cad-core module must be installed
- Environment variables configured in `.env` file

## Common Issues
- Python subprocess spawning requires `asar: false`
- FreeCAD path must be correctly configured
- Ensure Python dependencies are in correct virtual environment
