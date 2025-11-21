# Requirements

## Functional Requirements

### Wind Turbine CAD Generation
- Generate 3D CAD models for Axial Flux Permanent Magnet (AFPM) wind turbines
- Support multiple turbine presets/configurations
- Allow parameter customization for turbine specifications
- Export CAD files in standard formats

### User Interface
- Tabbed interface with 4 main sections: Inputs, Visualize, CNC, Dimensions
- Parameter input forms with validation
- Real-time 3D visualization of generated models
- Real-time progress updates via Server-Sent Events (SSE)
- CNC machining overview with SVG diagrams
- Dimension tables for manufacturing specifications

### File Operations
- Generate and download zip archive of FreeCAD model files
- Export DXF files for CNC machining
- Save/load parameter configurations

## Technical Requirements

### System Dependencies
- FreeCAD 1.0+ for CAD operations
- Python environment with openafpm-cad-core module
- Node.js and Yarn for frontend dependencies
- FastAPI for SSE streaming endpoints

### Performance
- Non-blocking UI - users never blocked from performing any action
- Background processing for computationally intensive tasks
- Real-time progress indicators via SSE streams (~1 minute for full model)
- Performance optimization via @cancelable_singleflight_cache decorator for caching results
- Loading times: Visualize (longest) > CNC (medium) > Dimensions (shortest)
- Automatic cancellation of old operations when parameters change

### Cross-Platform Support
- Windows, macOS, and Linux compatibility
- Electron-based desktop application
- Bundles Python interpreter from FreeCAD installation for distribution

### Backend Architecture
- All 3D operations (Visualize, CNC, Dimensions) depend on `load_all` function in `backend/api.py`
- `@cancelable_singleflight_cache` decorator provides caching and progress broadcasting
- Server-Sent Events (SSE) for real-time progress updates
- Thread-safe progress broadcasting to multiple concurrent clients
- Asynchronous processing prevents UI blocking
- Automatic cancellation when parameters change mid-operation

### SSE Implementation
- Three SSE endpoints: `/api/visualize/{assembly}/stream`, `/api/getcncoverview/stream`, `/api/getdimensiontables/stream`
- Event types: `progress`, `complete`, `cancelled`, `error`
- Query parameters use dot notation: `magnafpm.*`, `furling.*`, `user.*`
- Client disconnect detection and cleanup
- Race condition handling for parameter changes during operations
