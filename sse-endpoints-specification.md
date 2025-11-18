# SSE Endpoints Specification

## Overview

Refactor existing HTTP endpoints (`/visualize`, `/getcncoverview`, `/getdimensiontables`) to Server-Sent Events (SSE) streams for real-time progress updates on long-running operations (~1 minute).

## Current State Analysis

- All three endpoints depend on expensive `load_all` function
- Use `@request_collapse` decorator for caching identical parameter requests
- Frontend uses `fetchJson` with loading states
- Operations can take up to 1 minute with no progress feedback

## New SSE Endpoints

### 1. Visualize Assembly Stream
```
GET /api/visualize/{assembly}/stream?magnafpm.RotorDiskRadius=0.2&magnafpm.DiskThickness=0.02&furling.Offset=0.1&user.EnableFurling=true
Accept: text/event-stream

Response: Server-Sent Events stream
```

### 2. CNC Overview Stream
```
GET /api/getcncoverview/stream?magnafpm.RotorDiskRadius=0.2&magnafpm.DiskThickness=0.02&furling.Offset=0.1&user.EnableFurling=true
Accept: text/event-stream

Response: Server-Sent Events stream
```

### 3. Dimension Tables Stream
```
GET /api/getdimensiontables/stream?magnafpm.RotorDiskRadius=0.2&magnafpm.DiskThickness=0.02&furling.Offset=0.1&user.EnableFurling=true
Accept: text/event-stream

Response: Server-Sent Events stream
```

## Query Parameter Format

### Parameter Prefixes
- `magnafpm.*` - MagnaFPM parameters
- `furling.*` - Furling parameters  
- `user.*` - User parameters

### Backend Parsing
```python
def parse_prefixed_parameters(query_params: dict) -> dict:
    """Parse query parameters with dot notation and convert types"""
    result = {}
    
    for key, value in query_params.items():
        # Convert string values to appropriate types
        converted_value = convert_query_param_type(value)
        
        if "." in key:
            prefix, param_name = key.split(".", 1)
            if prefix not in result:
                result[prefix] = {}
            result[prefix][param_name] = converted_value
        else:
            result[key] = converted_value
    
    return result

def convert_query_param_type(value: str):
    """Convert string query param to appropriate type"""
    # Try boolean
    if value.lower() in ('true', 'false'):
        return value.lower() == 'true'
    
    # Try int
    try:
        if '.' not in value:
            return int(value)
    except ValueError:
        pass
    
    # Try float
    try:
        return float(value)
    except ValueError:
        pass
    
    # Return as string
    return value
```

## SSE Event Types

### Progress Event
```
event: progress
data: {"progress": 25, "message": "Loading FreeCAD documents..."}
```

### Complete Event
```
event: complete
data: {"objText": "...", "furlTransform": {...}}  // Same structure as current endpoints
```

### Error Event
```
event: error
data: {"error": "Error message", "details": "Stack trace or additional info"}
```

### Cancelled Event
```
event: cancelled
data: {"message": "Operation cancelled"}
```

Sent when an operation is cancelled due to parameter changes or client disconnect.

## Cancellation & Race Condition Handling

### Parameter Change Cancellation

When parameters change, the old operation must be cancelled and a new one started:

```python
# Global state for cancellation
_current_cancel_event = None

@request_collapse_with_progress
def wrapper(magnafpm_parameters, furling_parameters, user_parameters, progress_callback=None):
    global _current_cancel_event
    cache_key = hash_parameters(magnafpm_parameters, furling_parameters, user_parameters)
    
    with _cache_lock:
        if _current_cache_key == cache_key:
            # Same parameters - join existing operation
            ...
        else:
            # Different parameters - cancel old operation
            if _current_cancel_event is not None:
                _current_cancel_event.set()  # Signal cancellation
            
            # Save old event to set after releasing lock
            old_event = None
            if _current_cache_entry is not None and "event" in _current_cache_entry:
                old_event = _current_cache_entry["event"]
            
            # Create new cache entry with new cancel event
            cancel_event = threading.Event()
            _current_cancel_event = cancel_event
            
            broadcaster = ProgressBroadcaster()
            if progress_callback:
                broadcaster.add_callback(progress_callback)
            
            event = threading.Event()
            _current_cache_key = cache_key
            _current_cache_entry = {
                "status": "loading",
                "event": event,
                "progress_broadcaster": broadcaster,
                "cancel_event": cancel_event,
                "result": None
            }
    
    # Set old event AFTER releasing lock so waiting threads can proceed
    if old_event is not None:
        old_event.set()
    
    # Execute with cancellation support
    try:
        result = func(magnafpm_parameters, furling_parameters, user_parameters, 
                     broadcast_progress_wrapper, cancel_event)
        ...
    except InterruptedError:
        # Operation was cancelled
        with _cache_lock:
            # Only clear cache if it's still our entry (not replaced by new operation)
            if _current_cache_key == cache_key and _current_cache_entry is not None:
                _current_cache_key = None
                _current_cache_entry = None
        event.set()
        raise
```

### Waiting Thread Detection

Threads waiting on an old operation must detect when it's been replaced:

```python
with _cache_lock:
    if entry["status"] == "loading":
        if progress_callback:
            entry["progress_broadcaster"].add_callback(progress_callback)
        event = entry["event"]
        # Save reference to detect replacement
        waiting_for_entry = entry
        _cache_lock.release()
        event.wait()
        _cache_lock.acquire()
        
        # Check if the entry we were waiting for was replaced
        if _current_cache_entry is not waiting_for_entry:
            raise InterruptedError("Operation was cancelled")
        
        # Check status for errors
        if _current_cache_entry["status"] == "error":
            raise _current_cache_entry["error"]
        
        return _current_cache_entry["result"]
```

### Cache Preservation on Cancellation

When an old operation fails, it must not clear the new operation's cache:

```python
except Exception as e:
    with _cache_lock:
        # Only clear/update cache if it's still our entry
        if _current_cache_key == cache_key and _current_cache_entry is not None:
            if isinstance(e, InterruptedError):
                _current_cache_key = None
                _current_cache_entry = None
            else:
                _current_cache_entry["status"] = "error"
                _current_cache_entry["error"] = e
        else:
            # Cache already replaced by new operation - don't touch it
            logger.info("Cache already replaced, not clearing")
    event.set()
    raise
```

### Client Disconnect Detection

SSE streams must detect client disconnects and cancel operations:

```python
async def event_stream():
    progress_queue = queue.Queue()
    client_disconnected = False
    
    def progress_callback(message: str, progress: int):
        if client_disconnected:
            return
        try:
            progress_queue.put({"progress": progress, "message": message}, block=False)
        except queue.Full:
            pass
    
    task = asyncio.create_task(execute_with_progress(parameters, progress_callback))
    
    try:
        while not task.done():
            # Check for client disconnect
            if await request.is_disconnected():
                client_disconnected = True
                task.cancel()
                return
            
            try:
                progress_data = progress_queue.get(block=False)
                yield f"event: progress\ndata: {json.dumps(progress_data)}\n\n"
            except queue.Empty:
                await asyncio.sleep(0.1)
        
        result = await task
        
        if result is not None:
            yield f"event: complete\ndata: {json.dumps(result)}\n\n"
        else:
            yield f"event: cancelled\ndata: {json.dumps({'message': 'Operation cancelled'})}\n\n"
            
    except asyncio.CancelledError:
        logger.info("SSE stream cancelled by client disconnect")
```

### Frontend Cancellation Handling

```javascript
eventSource.addEventListener('cancelled', (event) => {
  console.log('Operation cancelled by backend');
  // Don't retry - frontend already handles parameter changes
});

eventSource.addEventListener('error', (event) => {
  // Check if event has data (actual error) vs connection close
  if (event.data) {
    try {
      const error = JSON.parse(event.data);
      handleError(error.error);
    } catch (e) {
      console.warn('Failed to parse error data');
    }
  } else {
    // Connection closed without error data - likely normal close
    console.log('Connection closed');
  }
  closeEventSource('visualize');
});
```

### Race Condition Summary

**Problem**: When parameters change mid-operation:
1. Old operation (T Shape) running with 3 waiting threads
2. New operation (H Shape) starts, replaces cache, sets old event
3. Old operation gets cancelled, tries to clear cache
4. If old operation clears cache, new operation's progress broadcaster is destroyed

**Solution**: 
- Old event set **after** new cache entry created (waiting threads wake up safely)
- Waiting threads check if cache entry was **replaced** (not just cleared)
- Failed operations only clear cache if it's **still their entry**
- Progress broadcaster preserved for new operation

## Two-Phase Processing Architecture

### Phase 1: `load_all` (Expensive, ~60s, 0-80%)
- **Cache key**: `hash_parameters(magnafpm, furling, user)` (assembly-independent)
- **Cached result**: `(root_documents, spreadsheet_document)`
- **Shared across all assemblies** with same parameters
- **Progress updates**: Real progress from `load_all(progress_callback, progress_range=(0, 80))`

### Phase 2: Individual Operations (Fast, ~5s, 80-100%)
- **Input**: Cached `load_all` result + operation type
- **Operations**: 
  - `get_assembly_obj()` for visualize endpoint
  - `get_dxf_as_svg()` for CNC endpoint  
  - `get_dimension_tables()` for dimensions endpoint
- **Not cached separately** - handled by existing `@request_collapse` on full endpoint
- **Progress updates**: Manual progress events at 90% before operation, 100% after completion

### Processing Flow
```python
async def visualize_with_progress(assembly, parameters, progress_callback):
    # Phase 1: Get load_all result (cached or fresh) - 0-80%
    root_documents, spreadsheet = await get_load_all_with_progress(
        parameters, 
        progress_callback,
        progress_range=(0, 80)  # Scale load_all progress to 0-80%
    )
    
    # Phase 2: Process individual operation - 80-100%
    progress_callback(90, f"Processing {assembly} assembly...")
    obj_text = get_assembly_to_obj(assembly_enum, assembly_document)
    
    if assembly_enum == Assembly.WIND_TURBINE:
        furl_transform = get_furl_transform(assembly_document, spreadsheet)
    else:
        furl_transform = None
    
    progress_callback(100, f"Completed {assembly} visualization")
    return {"objText": obj_text, "furlTransform": furl_transform}

async def cnc_overview_with_progress(parameters, progress_callback):
    # Phase 1: Get load_all result - 0-80%
    root_documents, spreadsheet = await get_load_all_with_progress(
        parameters, 
        progress_callback,
        progress_range=(0, 80)
    )
    
    # Phase 2: Generate DXF/SVG - 80-100%
    progress_callback(90, "Generating CNC overview...")
    svg_content = get_dxf_as_svg(root_documents, spreadsheet)
    
    progress_callback(100, "Completed CNC overview")
    return {"svg": svg_content}

async def dimension_tables_with_progress(parameters, progress_callback):
    # Phase 1: Get load_all result - 0-80%
    root_documents, spreadsheet = await get_load_all_with_progress(
        parameters, 
        progress_callback,
        progress_range=(0, 80)
    )
    
    # Phase 2: Generate dimension tables - 80-100%
    progress_callback(90, "Generating dimension tables...")
    tables = get_dimension_tables(root_documents, spreadsheet)
    
    progress_callback(100, "Completed dimension tables")
    return {"tables": tables}
```

### Performance Scenarios
- **Same parameters, different operation**: Phase 1 cached (instant to 80%), Phase 2 executed (80-100%, ~5s)
- **Different parameters**: Both phases executed (0-100%, ~65s total)  
- **Same parameters, same operation**: Both phases cached via existing `@request_collapse` (instant to 100%)

## Threading Architecture

### Progress Broadcasting System
```python
import threading
from typing import List, Callable

class ProgressBroadcaster:
    def __init__(self):
        self.callbacks: List[Callable] = []
        self.lock = threading.Lock()
    
    def add_callback(self, callback):
        with self.lock:
            self.callbacks.append(callback)
    
    def broadcast(self, progress, message):
        with self.lock:
            for callback in self.callbacks[:]:  # Copy to avoid modification during iteration
                try:
                    callback(progress, message)
                except Exception:
                    # Remove failed callbacks (disconnected clients)
                    self.callbacks.remove(callback)
```

### Modified Request Collapse Decorator
```python
# Enhanced cache entry structure
_current_cache_entry = {
    "status": "loading",           # "loading", "complete", "error"
    "event": threading.Event(),    # For thread synchronization
    "result": None,               # Cached result
    "progress_broadcaster": ProgressBroadcaster()  # Progress distribution
}

@request_collapse_with_progress
def request_collapsed_load_all_with_progress(
    magnafpm_parameters, furling_parameters, user_parameters, progress_callback=None
):
    cache_key = hash_parameters(magnafpm_parameters, furling_parameters, user_parameters)
    
    with _cache_lock:
        if _current_cache_key == cache_key and _current_cache_entry is not None:
            entry = _current_cache_entry
            if entry["status"] == "complete":
                # Immediate return for cached results
                if progress_callback:
                    progress_callback(100, "Using cached result")
                return entry["result"]
            elif entry["status"] == "loading":
                # Add callback to existing broadcaster
                if progress_callback:
                    entry["progress_broadcaster"].add_callback(progress_callback)
                # Wait for completion
                event = entry["event"]
                _cache_lock.release()
                event.wait()
                _cache_lock.acquire()
                return _current_cache_entry["result"]
        else:
            # New execution - create broadcaster
            broadcaster = ProgressBroadcaster()
            if progress_callback:
                broadcaster.add_callback(progress_callback)
            _current_cache_key = cache_key
            _current_cache_entry = {
                "status": "loading",
                "event": threading.Event(),
                "progress_broadcaster": broadcaster,
                "result": None
            }
    
    # Execute with progress broadcasting
    def broadcast_progress_wrapper(stage_name: str, percent: int):
        message = f"{stage_name}..."
        _current_cache_entry["progress_broadcaster"].broadcast(percent, message)
    
    try:
        # load_all supports progress_callback(stage_name: str, percent: int)
        result = load_all(magnafpm_parameters, furling_parameters, user_parameters, broadcast_progress_wrapper)
        with _cache_lock:
            _current_cache_entry["status"] = "complete"
            _current_cache_entry["result"] = result
        _current_cache_entry["event"].set()
        return result
    except Exception as e:
        with _cache_lock:
            _current_cache_entry["status"] = "error"
            _current_cache_entry["error"] = e
        _current_cache_entry["event"].set()
        raise
```

## Implementation Considerations

### Resolved Issues
1. **Real Progress Updates** ✅ - `load_all` supports `progress_callback(stage_name: str, percent: int)`
2. **Two-Phase Architecture** ✅ - Separate caching for `load_all` vs full endpoint results
3. **Assembly Independence** ✅ - Different assemblies reuse same `load_all` cache

### Critical Remaining Issues
1. **Async/Sync Bridge** - Need `asyncio.run_in_executor()` for sync `load_all` in async SSE
2. **Memory Management** - Clean up disconnected SSE client callbacks
3. **Error Isolation** - Prevent callback failures from breaking main execution
4. **URL Length Limits** - Complex parameters might exceed query string limits
5. **Type Conversion Edge Cases** - Handle ambiguous values like `"1.0"`, `"True"`

### Race Condition Fix
```python
# Prevent race between lock release and event.wait()
with _cache_lock:
    if entry["status"] == "loading":
        entry["progress_broadcaster"].add_callback(progress_callback)
        event = entry["event"]
        # Check status again before waiting (double-check pattern)
        if entry["status"] == "loading":
            _cache_lock.release()
            event.wait()
            _cache_lock.acquire()
        # If status changed to complete while we held the lock, return immediately
        return _current_cache_entry["result"]
```

## FastAPI Implementation

### SSE Endpoint Structure
```python
from fastapi import Request
from fastapi.responses import StreamingResponse
import json
import asyncio

@app.get("/api/visualize/{assembly}/stream")
async def visualize_stream(assembly: str, request: Request):
    # Parse prefixed query parameters
    query_params = dict(request.query_params)
    parameters = parse_prefixed_parameters(query_params)
    
    async def event_stream():
        progress_queue = asyncio.Queue()
        
        def progress_callback(progress, message):
            try:
                asyncio.create_task(progress_queue.put({
                    "progress": progress, 
                    "message": message
                }))
            except:
                pass  # Handle disconnected clients
        
        # Start background task
        task = asyncio.create_task(
            execute_visualize_with_progress(assembly, parameters, progress_callback)
        )
        
        try:
            while not task.done():
                try:
                    # Wait for progress update with timeout
                    progress_data = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                    yield f"event: progress\ndata: {json.dumps(progress_data)}\n\n"
                except asyncio.TimeoutError:
                    continue
            
            # Get final result
            result = await task
            yield f"event: complete\ndata: {json.dumps(result)}\n\n"
            
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

## Frontend Integration

### URL Construction
```javascript
function buildSSEUrl(endpoint, parameters) {
    const params = new URLSearchParams();
    
    // Add magnafpm parameters
    Object.entries(parameters.magnafpm).forEach(([key, value]) => {
        params.append(`magnafpm.${key}`, value);
    });
    
    // Add furling parameters  
    Object.entries(parameters.furling).forEach(([key, value]) => {
        params.append(`furling.${key}`, value);
    });
    
    // Add user parameters
    Object.entries(parameters.user).forEach(([key, value]) => {
        params.append(`user.${key}`, value);
    });
    
    return `${endpoint}?${params.toString()}`;
}
```

### SSE Client Implementation
```javascript
const eventSources = {
  visualize: null,
  cncoverview: null, 
  dimensiontables: null
};

function closeEventSource(type) {
  if (eventSources[type]) {
    eventSources[type].close();
    eventSources[type] = null;
  }
}

function handleVisualize() {
  const body = buildRequestBody(app.form, app.parametersByPreset[app.preset]);
  const assemblyChanged = app.assembly !== previousAssembly;
  const parametersChanged = previousBody !== body;
  
  if (parametersChanged) {
    // Parameters changed - close ALL event sources
    closeEventSource('visualize');
    closeEventSource('cncoverview'); 
    closeEventSource('dimensiontables');
    
    // Add delay to ensure backend cancellation completes before starting new requests
    // This prevents race conditions where new requests start before old ones are fully cancelled
    setTimeout(() => {
      // Start all 3 SSE connections
      startVisualizationSSE(app.assembly, body);
      startCNCOverviewSSE(body);
      startDimensionTablesSSE(body);
    }, 500);
    
  } else if (assemblyChanged) {
    // Only assembly changed - close only visualize
    closeEventSource('visualize');
    
    // Start only visualization SSE
    startVisualizationSSE(app.assembly, body);
  }
  
  previousBody = body;
  previousAssembly = app.assembly;
}

function startVisualizationSSE(assembly, parameters) {
  const url = buildSSEUrl(`/api/visualize/${assembly}/stream`, parameters);
  const eventSource = new EventSource(url);
  eventSources.visualize = eventSource;
  
  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    updateProgressUI(data.progress, data.message);
  });
  
  eventSource.addEventListener('complete', (event) => {
    const result = JSON.parse(event.data);
    handleVisualizationComplete(result);
    closeEventSource('visualize');
  });
  
  eventSource.addEventListener('cancelled', (event) => {
    console.log('Visualization cancelled by backend');
    closeEventSource('visualize');
  });
  
  eventSource.addEventListener('error', (event) => {
    // Check if this is a proper error event with data
    if (event.data) {
      try {
        const error = JSON.parse(event.data);
        handleVisualizationError(error);
      } catch (e) {
        console.warn('Failed to parse error data');
      }
    } else {
      // Connection closed without error data - likely normal close
      console.log('Connection closed');
    }
    closeEventSource('visualize');
  });
}

function startCNCOverviewSSE(parameters) {
  const url = buildSSEUrl('/api/getcncoverview/stream', parameters);
  const eventSource = new EventSource(url);
  eventSources.cncoverview = eventSource;
  
  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    updateCNCProgressUI(data.progress, data.message);
  });
  
  eventSource.addEventListener('complete', (event) => {
    const result = JSON.parse(event.data);
    setState({ cncOverviewSvg: result.svg });
    closeEventSource('cncoverview');
  });
  
  eventSource.addEventListener('error', (event) => {
    const error = JSON.parse(event.data);
    setState({ cncOverviewSvgErrorMessage: error.error });
    closeEventSource('cncoverview');
  });
}

function startDimensionTablesSSE(parameters) {
  const url = buildSSEUrl('/api/getdimensiontables/stream', parameters);
  const eventSource = new EventSource(url);
  eventSources.dimensiontables = eventSource;
  
  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    updateDimensionsProgressUI(data.progress, data.message);
  });
  
  eventSource.addEventListener('complete', (event) => {
    const result = JSON.parse(event.data);
    setState({ dimensionTables: result.tables });
    closeEventSource('dimensiontables');
  });
  
  eventSource.addEventListener('error', (event) => {
    const error = JSON.parse(event.data);
    setState({ dimensionTablesErrorMessage: error.error });
    closeEventSource('dimensiontables');
  });
}
```

## Implementation Requirements

### Must Preserve
1. **Request Collapse Caching**: Maintain performance benefits for identical parameters
2. **Existing API Compatibility**: Keep current endpoints during transition
3. **Error Handling**: Propagate errors through SSE stream
4. **Parameter Validation**: Same validation as current endpoints

### New Features
1. **Real-time Progress**: Sub-second progress updates during long operations
2. **Multiple Client Support**: Multiple SSE clients can share progress from single execution
3. **Connection Management**: Handle client disconnections gracefully
4. **Thread Safety**: All progress broadcasting must be thread-safe

### Performance Considerations
1. **Non-blocking Progress**: Progress updates shouldn't slow down main execution
2. **Memory Management**: Clean up disconnected client callbacks
3. **Error Isolation**: Failed progress callbacks shouldn't affect operation
4. **Minimal Overhead**: Progress broadcasting should have minimal performance impact

## Migration Strategy

### Phase 1: Backend Implementation
1. Implement `ProgressBroadcaster` class
2. Modify `@request_collapse` decorator for progress support
3. Add SSE endpoints alongside existing ones
4. **Test Cases**:
   - **Test A**: 3 concurrent connections to same endpoint/parameters
   - **Test B**: Connection with different parameters (full cache miss)
   - **Test C**: Connection after cache hit (immediate completion)

### Phase 2: Frontend Integration
1. **Update Dependencies**: Update package.json to use local openafpm-cad-visualization with setProgress method
   ```json
   "openafpm-cad-visualization": "file:../openafpm-cad-visualization"
   ```
2. Add SSE client utilities with connection management
3. Implement parameter vs assembly change detection logic
3. **Update UI components to handle progress events**:
   
   **CNC & Dimensions Tabs (Similar Implementation)**:
   - Replace existing `x-circular-progress` spinner with progress bar component
   - Add progress percentage display (0-100%)
   - Add progress message text below progress bar
   - Maintain existing loading state structure in app state
   - Progress UI structure:
     ```html
     <div class="loading-container">
       <md-linear-progress value="75" max="100"></md-linear-progress>
       <div class="progress-text">75% - Processing assembly...</div>
     </div>
     ```
   - State integration:
     ```javascript
     // CNC Tab state
     cncOverviewLoading: true,
     cncOverviewProgress: 75,
     cncOverviewProgressMessage: "Processing assembly...",
     
     // Dimensions Tab state  
     dimensionTablesLoading: true,
     dimensionTablesProgress: 45,
     dimensionTablesProgressMessage: "Loading FreeCAD documents..."
     ```
   
   **Visualize Tab (Different Implementation)**:
   - Progress handled internally by `openafpmCadVisualization` component from openafpm-cad-visualization library
   - Component has `setProgress(step, progress)` method for external progress updates
   - Use `setProgress()` method to update component's internal loading screen:
     ```javascript
     const visualizationComponent = document.querySelector('openafpm-cad-visualization');
     visualizationComponent.setProgress("Loading FreeCAD documents", 75);
     ```
   - Component manages its own loading screen display
   - No direct UI changes needed in main app - component handles progress display internally
4. **Connection Management**:
   - **Parameters changed**: Close all 3 SSE connections, start all 3 new ones
   - **Assembly changed only**: Close visualize SSE only, start new visualize SSE
   - **No changes**: No new connections
5. **Progress Integration**:
   
   **CNC & Dimensions Tabs (Direct State Updates)**:
   ```javascript
   // Progress event handlers
   function updateCNCProgressUI(progress, message) {
     setState({
       cncOverviewProgress: progress,
       cncOverviewProgressMessage: message,
       cncOverviewLoading: progress < 100
     });
   }
   
   function updateDimensionsProgressUI(progress, message) {
     setState({
       dimensionTablesProgress: progress, 
       dimensionTablesProgressMessage: message,
       dimensionTablesLoading: progress < 100
     });
   }
   ```
   
   **Visualize Tab (Component Integration)**:
   ```javascript
   // Progress passed to openafpm-cad-visualization component
   function updateVisualizationProgressUI(progress, message) {
     const visualizationComponent = document.querySelector('openafpm-cad-visualization');
     if (visualizationComponent && visualizationComponent.setProgress) {
       // Use component's setProgress(step, progress) method
       visualizationComponent.setProgress(message, progress);
     }
     
     // Also update app state for consistency
     setState({
       visualizeProgress: progress,
       visualizeProgressMessage: message,
       visualizeLoading: progress < 100
     });
   }
   ```
6. Test user experience improvements

### Phase 3: Cleanup
1. Monitor SSE endpoint usage
2. Remove old endpoints when stable
3. Performance optimization

## Testing Requirements

### Unit Tests
- Progress broadcaster thread safety
- Request collapse with multiple callbacks
- Parameter parsing with prefixes
- Error propagation through SSE

### Integration Tests
- **Test A**: Multiple concurrent SSE clients (same endpoint/parameters)
- **Test B**: Full cache miss scenario (different parameters)
- **Test C**: Cache hit scenario (same parameters, immediate completion)
- Client disconnection handling
- Long-running operation cancellation

### Performance Tests
- Memory usage with many concurrent clients
- Progress update frequency impact
- Cache effectiveness with SSE endpoints
- Network bandwidth usage
