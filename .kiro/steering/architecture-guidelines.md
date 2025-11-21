# Architecture Guidelines

## Electron Process Architecture
- Main process handles system integration and Python subprocess management
- Renderer process handles UI and user interactions
- Python FastAPI backend runs as child process spawned by main process
- Communication via HTTP requests to FastAPI backend (not IPC)

## Python Integration
- Python backend runs as child process from main Electron process
- FastAPI server started with `python -m backend.api --port <port>`
- Communication via HTTP/SSE to localhost
- Handle Python process lifecycle (start, stop, error recovery)

## FreeCAD Integration
- FreeCAD operations run in Python backend (headless mode)
- Only import `FreeCAD`, not `FreeCADGui` (no GUI components)
- Handle FreeCAD import errors gracefully

## Data Flow
1. User input in renderer process
2. HTTP request to FastAPI backend (localhost)
3. FastAPI executes CAD operations via openafpm-cad-core
4. Results returned via HTTP response or SSE stream
5. Renderer updates UI with results

## SSE Architecture
- FastAPI backend with Server-Sent Events for real-time progress
- Three SSE endpoints: visualize, CNC overview, dimension tables
- Thread-safe progress broadcasting to multiple concurrent clients
- Automatic cancellation when parameters change
- Client disconnect detection and cleanup

## Cancellation Patterns
- Use threading.Event for cancellation signals
- Check cancel_event in long-running operations
- Preserve new operation's cache when old operation fails
- Detect cache entry replacement for waiting threads
- Set old event after releasing lock to avoid deadlocks

## Error Handling
- Validate inputs before sending to Python backend
- Handle Python subprocess crashes gracefully
- Provide meaningful error messages to users
- Log errors for debugging
- Propagate InterruptedError for cancelled operations
