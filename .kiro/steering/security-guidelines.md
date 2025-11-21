# Security Guidelines

## Electron Security
- Disable node integration in renderer process
- Renderer communicates with backend via HTTP (localhost only)
- Sanitize user inputs before passing to Python backend
- Validate all HTTP requests and responses

## Python Subprocess Security
- Validate all parameters before spawning Python processes
- Use proper subprocess management to prevent resource leaks
- Handle Python process termination gracefully
- Avoid executing arbitrary Python code from user input

## File System Access
- Restrict file operations to project directories
- Validate file paths to prevent directory traversal
- Use proper permissions for temporary files
- Clean up temporary files after operations

## Environment Variables
- Keep sensitive configuration in `.env` file
- Don't commit `.env` to version control
- Validate environment variables on startup
