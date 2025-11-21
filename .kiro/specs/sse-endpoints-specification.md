# SSE Endpoints Specification

## Overview

Server-Sent Events (SSE) streaming endpoints provide real-time progress updates for long-running CAD operations (~1 minute). All endpoints use the `@cancelable_singleflight_cache` decorator for caching and progress broadcasting to multiple concurrent clients.

## Architecture

### Request Collapsing with Progress
- Multiple identical requests share the same computation
- Progress updates broadcast to all waiting clients
- Automatic cancellation when parameters change mid-operation
- Thread-safe cache management with threading.Event for coordination

### Cancellation Handling
- Old operations cancelled when new request with different parameters arrives
- `cancelled` event sent to clients when operation is cancelled
- Client disconnect detection triggers cleanup

## Endpoints

### 1. Visualize Assembly Stream

**Endpoint:** `GET /api/visualize/{assembly}/stream`

**Path Parameters:**
- `assembly`: Assembly type (WindTurbine, StatorMold, RotorMold, MagnetJig, CoilWinder, BladeTemplate)

**Query Parameters:** (dot notation)
- `magnafpm.*` - MagnaFPM parameters (e.g., `magnafpm.RotorDiskRadius=0.2`)
- `furling.*` - Furling parameters (e.g., `furling.Offset=0.1`)
- `user.*` - User parameters (e.g., `user.BladeWidth=100`, `user.WindTurbineShape=T`)

**Response Events:**
- `progress`: `{"progress": 0-100, "message": "status text"}`
- `complete`: `{"objText": "...", "furlTransform": {...}}`
- `cancelled`: `{"message": "Operation cancelled"}`
- `error`: `{"error": "error message"}`

**Example:**
```
GET /api/visualize/WindTurbine/stream?magnafpm.RotorDiskRadius=0.2&user.BladeWidth=100
```

### 2. CNC Overview Stream

**Endpoint:** `GET /api/getcncoverview/stream`

**Query Parameters:** Same dot notation as visualize

**Response Events:**
- `progress`: `{"progress": 0-100, "message": "status text"}`
- `complete`: `"<svg>...</svg>"` (SVG string)
- `cancelled`: `{"message": "Operation cancelled"}`
- `error`: `{"error": "error message"}`

### 3. Dimension Tables Stream

**Endpoint:** `GET /api/getdimensiontables/stream`

**Query Parameters:** Same dot notation as visualize

**Response Events:**
- `progress`: `{"progress": 0-100, "message": "status text"}`
- `complete`: `[...]` (array of table elements)
- `cancelled`: `{"message": "Operation cancelled"}`
- `error`: `{"error": "error message"}`

## Frontend Integration

### SSEManager Class
Manages EventSource connections with automatic cleanup:

```javascript
class SSEManager {
  startSSE(endpoint, parameters, callbacks) {
    // callbacks: onProgress, onComplete, onCancelled, onError
  }
  
  closeEventSource(endpoint)
  closeEventSourceContaining(fragment)
  closeAllEventSources()
}
```

### Event Handling
- `progress` events update UI progress bars
- `complete` events update state with results
- `cancelled` events clear progress without error
- `error` events (custom) show error messages
- `onerror` (native) handles connection failures

### Parameter Changes
When parameters change:
1. Close existing EventSource for affected endpoints
2. Start new SSE stream with updated parameters
3. Backend automatically cancels old operation
4. Old clients receive `cancelled` event

## Backend Implementation

### Decorator Pattern
```python
@cancelable_singleflight_cache(key_generator=hash_parameters)
def load_all_with_cache(magnafpm_parameters, furling_parameters, user_parameters, 
                        progress_callback=None, cancel_event=None):
    # Long-running operation with progress updates
    return load_all(magnafpm_parameters, furling_parameters, user_parameters,
                   progress_callback, progress_range=(0, 80), cancel_event=cancel_event)
```

### Progress Broadcasting
- Thread-safe progress updates to all waiting clients
- Each client gets its own EventSource connection
- Progress callbacks invoked from worker thread
- Automatic cleanup on completion/error/cancellation

### Cache Management
- Cache key based on parameter hash
- Concurrent requests with same parameters share computation
- Cache entry includes result and threading.Event for coordination
- Old cache entries replaced when parameters change

## Error Handling

### Backend Errors
- Exceptions caught and sent as `error` events
- InterruptedError sent as `cancelled` events
- Connection errors trigger native EventSource `onerror`

### Frontend Errors
- Custom `error` events: display error message to user
- Native `onerror`: show "Connection error" message
- `cancelled` events: silently clear progress (expected behavior)

## Performance Characteristics

### Loading Times
All operations share the same `load_all` cache (~80% of total time), so they finish close to the same time:
- Visualize: Longest (OBJ conversion + furl transform calculation)
- CNC Overview: Medium (SVG generation from DXF)
- Dimension Tables: Shortest (table extraction from spreadsheet)

Total time: ~1 minute for initial load, subsequent operations with same parameters are instant (cached)

### Optimization
- All three operations share `load_all` cache
- Switching assemblies reuses cached data (no progress reset)
- Parameter changes invalidate cache and cancel old operations
- Progress updates every ~1-2 seconds
