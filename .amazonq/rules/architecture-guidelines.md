# Architecture Guidelines

## Electron Process Architecture
- Main process handles system integration and Python subprocess management
- Renderer process handles UI and user interactions
- Use contextBridge for secure IPC communication

## Python Integration
- Python backend runs as child process from main Electron process
- Communication via stdin/stdout or file-based messaging
- Handle Python process lifecycle (start, stop, error recovery)

## FreeCAD Integration
- FreeCAD operations must run in Python backend
- Isolate FreeCAD operations to prevent GUI conflicts
- Handle FreeCAD import errors gracefully

## Data Flow
1. User input in renderer process
2. IPC message to main process
3. Main process spawns Python subprocess
4. Python executes CAD operations via openafpm-cad-core
5. Results returned through IPC to renderer

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
