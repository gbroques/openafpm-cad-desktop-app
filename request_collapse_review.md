# Critical Review: `request_collapse_with_progress`

## Current State

**File:** `backend/request_collapse.py`
**Lines:** ~150 lines for the decorator
**Status:** ✅ Works correctly (confirmed by comprehensive manual testing)

## Complexity Analysis

### Issues Identified

1. **❌ Excessive Complexity** - ~150 lines with deeply nested conditionals
2. **❌ Multiple Responsibilities** - Handles caching, cancellation, progress broadcasting, and waiting
3. **❌ Global State Management** - 3 global variables with complex interactions:
   - `_current_cache_key`
   - `_current_cache_entry`
   - `_current_cancel_event`
4. **❌ Race Condition Handling** - Multiple checks for "was cache replaced?" scenarios
5. **❌ Lock Management** - Manual lock release/acquire is error-prone

### Core Logic Flow

```
1. Check if cache key matches current
   a. If complete → return cached result
   b. If error → re-raise cached error
   c. If loading → join existing operation and wait
   
2. If different key (parameters changed):
   a. Cancel old operation (set cancel_event)
   b. Wait for old operation to finish cancelling
   c. Check if another thread already created entry for our key
   d. If yes, join that operation
   e. If no, create new cache entry
   
3. Execute function with progress broadcasting
   
4. Handle errors and cleanup
```

## Scenarios Handled

1. ✅ **Necessary:** Multiple threads with same params → collapse into one execution
2. ✅ **Necessary:** Cache hit → return immediately  
3. ✅ **Necessary:** Progress broadcasting to multiple clients
4. ⚠️ **Complex:** Cancellation + blocking wait for old operation
5. ⚠️ **Complex:** Detecting if cache was replaced during wait
6. ⚠️ **Complex:** Checking if another thread created entry after cancellation

## Why It's Complex

The complexity comes from these requirements:
- Must handle concurrent requests efficiently
- Must support cancellation when parameters change
- Must wait for old operation to cancel before starting new (prevents race conditions)
- Must handle race where multiple threads request new params after cancellation
- Must preserve new operation's cache even if old operation fails
- Must broadcast progress to all waiting clients

## Simplification Attempts (Why They Don't Work)

### Option 1: Remove Cancellation
- ❌ Old operations continue wasting resources
- ❌ Multiple FreeCAD operations running simultaneously causes conflicts

### Option 2: Don't Wait for Cancellation
- ❌ Race conditions where multiple operations start
- ❌ FreeCAD global state corruption

### Option 3: Use Queue Instead of Events
- ❌ Still need same logic for cancellation and waiting
- ❌ Doesn't simplify the core problem

## Verdict

**The complexity is mostly justified** given the requirements.

**Rating: 6/10** - Works correctly but could be more maintainable.

## Improvement Ideas

### 1. Extract Helper Methods

Break the monolithic wrapper into smaller functions:

```python
def _check_cache_hit(cache_key, progress_callback):
    """Check if we have a cached result and return it."""
    # Extract lines 175-210
    pass

def _join_existing_operation(entry, progress_callback):
    """Join an existing loading operation."""
    # Extract lines 185-210
    pass

def _cancel_and_wait_for_old_operation(cache_key, progress_callback):
    """Cancel old operation and wait for it to complete."""
    # Extract lines 212-245
    pass

def _create_new_cache_entry(cache_key, progress_callback):
    """Create a new cache entry for this operation."""
    # Extract lines 247-265
    pass
```

### 2. Use Context Manager for Lock

Replace manual `_cache_lock.release()` / `_cache_lock.acquire()` with:

```python
from contextlib import contextmanager

@contextmanager
def cache_lock_with_release():
    """Context manager that releases lock during wait."""
    _cache_lock.acquire()
    try:
        yield
    finally:
        if _cache_lock.locked():
            _cache_lock.release()
```

### 3. Reduce Logging

Current: ~15 log statements
Suggested: ~5 key decision points only

### 4. Use Entry IDs Instead of Object Identity

Instead of:
```python
if _current_cache_entry is not waiting_for_entry:
```

Use:
```python
entry_id = id(waiting_for_entry)
if _current_cache_entry is None or id(_current_cache_entry) != entry_id:
```

More explicit about what we're checking.

### 5. Document State Machine

Add a state diagram showing transitions:
```
NONE → LOADING → COMPLETE
              → ERROR
              → CANCELLED (clears to NONE)
```

## Refactored Structure (Sketch)

```python
def request_collapse_with_progress(key_generator):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = key_generator(*args)
            progress_callback = kwargs.get('progress_callback')
            
            # Phase 1: Check cache
            cached_result = _check_cache_hit(cache_key, progress_callback)
            if cached_result is not None:
                return cached_result
            
            # Phase 2: Handle existing operation
            existing_entry = _get_existing_entry(cache_key)
            if existing_entry:
                return _join_existing_operation(existing_entry, progress_callback)
            
            # Phase 3: Cancel old and create new
            _cancel_old_operation_if_exists(cache_key)
            entry = _create_new_cache_entry(cache_key, progress_callback)
            
            # Phase 4: Execute
            return _execute_with_cache(func, args, kwargs, entry, cache_key)
        
        return wrapper
    return decorator
```

## Test Coverage

**File:** `tests/backend/test_request_collapse_with_progress.py`

Tests cover:
- ✅ Single request execution
- ✅ Concurrent requests collapse
- ✅ Sequential requests use cache
- ✅ Different params execute separately
- ✅ Progress broadcasting to multiple clients
- ✅ Error propagation
- ✅ Cancellation behavior

**Test quality:** Good coverage of main scenarios

## Recommendation

**Option A: Leave as-is**
- Pro: Works correctly, well-tested
- Pro: No risk of introducing bugs
- Con: Hard to maintain/understand

**Option B: Refactor with helper methods**
- Pro: More maintainable
- Pro: Easier to understand flow
- Con: Risk of introducing subtle bugs
- Con: Requires extensive re-testing

**Option C: Add documentation only**
- Pro: Low risk
- Pro: Improves understanding
- Con: Doesn't reduce complexity

**Suggested: Option C for now, Option B if touching this code in future**

## Related Files

- `backend/api.py` - Uses the decorator
- `backend/progress_broadcaster.py` - Progress broadcasting helper
- `tests/backend/test_request_collapse_with_progress.py` - Unit tests

## Notes

- The decorator is critical infrastructure for SSE real-time updates
- Any changes must be thoroughly tested with concurrent scenarios
- Manual testing confirmed it works correctly in production scenarios
- The complexity reflects the inherent difficulty of the problem, not poor design
