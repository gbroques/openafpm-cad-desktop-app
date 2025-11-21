# Coding Standards

## Python Code (Backend)
- Follow PEP 8 style guidelines
- Use type hints for function parameters and return values
- Use `.flake8` configuration for linting
- Use `.mypy.ini` for type checking
- Keep Python code in `backend/` directory

## JavaScript/Node.js Code
- Use modern ES6+ syntax
- Follow consistent indentation (2 spaces)
- Use meaningful variable and function names
- Handle errors appropriately in async operations

## Electron-Specific
- Keep main process code minimal
- Renderer communicates with FastAPI backend via HTTP/SSE (not IPC)
- Handle Python subprocess spawning carefully due to `asar: false` requirement

## File Organization
- Frontend code goes in `frontend/` directory
- Backend Python code goes in `backend/` directory
- Main Electron entry point is `index.html`
- Configuration files at project root
