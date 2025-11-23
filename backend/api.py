"""
RESTful Web API exposing operations for FreeCAD wind turbine model.

FREECAD_LIB environment variable must be set to path where FreeCAD.so
is located relative to root of openafpm-cad-desktop-app.

Usage:

    python api.py [--port PORT]

Where port defaults to 8000.
"""

import os
import sys
from pathlib import Path
import logging
import time
import json
import asyncio
import ast
import threading
from functools import partial
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
import uvicorn

# Add FreeCAD lib directory to sys.path for importing FreeCAD.
root_path = Path(__file__).absolute().parent.parent
freecad_lib = str(root_path.joinpath(os.environ["FREECAD_LIB"]).resolve())
sys.path.insert(1, freecad_lib)

import FreeCAD as App
from openafpm_cad_core.app import (
    load_all,
    get_default_parameters,
    get_presets,
    get_parameters_schema,
    H_SHAPE_LOWER_BOUND,
    STAR_SHAPE_LOWER_BOUND,
    loadmat,
    map_magnafpm_parameters,
    map_rotor_disk_radius_to_wind_turbine_shape,
    Assembly,
    get_furl_transform,
    get_assembly_to_obj,
    get_dxf_as_svg,
    get_dimension_tables,
    get_dxf_archive,
    get_freecad_archive,
    hash_parameters,
    WindTurbineShape
)
from .cancelable_singleflight_cache import cancelable_singleflight_cache


app = FastAPI()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S%z'
)
logger = logging.getLogger(__name__)


# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"Incoming {request.method} {request.url.path}")
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"Completed {request.method} {request.url.path} in {process_time:.3f}s")
    return response


# Add GZip compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Pydantic models for request/response
class LoadMatRequest(BaseModel):
    path: str


class ParametersRequest(BaseModel):
    magnafpm: dict
    user: dict
    furling: dict


@app.get("/api/defaultparameters")
def get_default_parameters_endpoint() -> dict:
    first_five_presets = get_presets()[:5]
    first_five_default_parameters = [
        get_default_parameters(p) for p in first_five_presets
    ]
    return {k: v for (k, v) in zip(first_five_presets, first_five_default_parameters)}


@app.get("/api/parametersschema")
def get_parameters_schema_endpoint() -> dict:
    def get_parameters_schema_for_preset(preset: str):
        default_parameters = get_default_parameters(preset)
        wind_turbine_shape = default_parameters["user"]["WindTurbineShape"]
        if wind_turbine_shape == 'Calculated':
            wind_turbine_shape = map_rotor_disk_radius_to_wind_turbine_shape(default_parameters['magnafpm']['RotorDiskRadius'])
        else:
            wind_turbine_shape = WindTurbineShape.from_string(wind_turbine_shape)
        return get_parameters_schema(wind_turbine_shape)

    first_five_presets = get_presets()[:5]
    first_five_parameter_schemas = [
        get_parameters_schema_for_preset(p) for p in first_five_presets
    ]
    bounds = {
        "bounds": {
            "h_shape_lower_bound": H_SHAPE_LOWER_BOUND,
            "star_shape_lower_bound": STAR_SHAPE_LOWER_BOUND,
        }
    }
    schema_by_preset = {
        k: v for (k, v) in zip(first_five_presets, first_five_parameter_schemas)
    }
    return {**bounds, **schema_by_preset}


@app.post("/api/loadmat")
def load_mat(request: LoadMatRequest) -> dict:
    path = request.path
    magnafpm_parameters = map_magnafpm_parameters(loadmat(path))
    wind_turbine_shape = map_rotor_disk_radius_to_wind_turbine_shape(
        magnafpm_parameters["RotorDiskRadius"]
    )
    return {
        "preset": wind_turbine_shape.value,
        "magnafpm": magnafpm_parameters,
    }


@app.post("/api/archive")
def create_archive_endpoint(request: ParametersRequest):
    parameters = request.dict()
    magnafpm_parameters = parameters["magnafpm"]
    user_parameters = parameters["user"]
    furling_parameters = parameters["furling"]

    root_documents, spreadsheet_document = load_all_with_cache(
        magnafpm_parameters, furling_parameters, user_parameters
    )

    archive_bytes = get_freecad_archive(root_documents, spreadsheet_document)
    return Response(content=archive_bytes, media_type="application/octet-stream")


@app.post("/api/dxfarchive")
def create_dxf_archive_endpoint(request: ParametersRequest):
    parameters = request.dict()
    magnafpm_parameters = parameters["magnafpm"]
    user_parameters = parameters["user"]
    furling_parameters = parameters["furling"]

    root_documents, _ = load_all_with_cache(
        magnafpm_parameters, furling_parameters, user_parameters
    )

    dxf_bytes = get_dxf_archive(root_documents, magnafpm_parameters)
    return Response(content=dxf_bytes, media_type="application/octet-stream")


@app.get("/api/visualize/{assembly}/stream")
async def visualize_stream(assembly: str, request: Request):
    """SSE endpoint for visualize with real-time progress updates."""
    parameters = parse_prefixed_parameters(dict(request.query_params))
    return await create_sse_stream(request, execute_visualize_with_progress, assembly, parameters)


@app.get("/api/getcncoverview/stream")
async def cnc_overview_stream(request: Request):
    """SSE endpoint for CNC overview with real-time progress updates."""
    parameters = parse_prefixed_parameters(dict(request.query_params))
    return await create_sse_stream(request, execute_cnc_overview_with_progress, parameters)


@app.get("/api/getdimensiontables/stream")
async def dimension_tables_stream(request: Request):
    """SSE endpoint for dimension tables with real-time progress updates."""
    parameters = parse_prefixed_parameters(dict(request.query_params))
    return await create_sse_stream(request, execute_dimension_tables_with_progress, parameters)


@cancelable_singleflight_cache(key_generator=hash_parameters)
def load_all_with_cache(
    magnafpm_parameters, furling_parameters, user_parameters, progress_callback=None, cancel_event=None
):
    return load_all(
        magnafpm_parameters, 
        furling_parameters, 
        user_parameters, 
        progress_callback,
        progress_range=(0, 80),
        cancel_event=cancel_event
    )


def parse_prefixed_parameters(query_params: Dict[str, str]) -> Dict[str, Any]:
    """Parse query parameters with dot notation and convert types.
    
    Converts flat query parameters with dot notation (e.g., 'magnafpm.RotorDiskRadius')
    into nested dictionaries with type conversion.
    
    Args:
        query_params: Dictionary of query parameter key-value pairs
        
    Returns:
        Nested dictionary with converted types. Example:
        {'magnafpm': {'RotorDiskRadius': 200.0}, 'user': {'EnableFurling': True}}
    """
    result: Dict[str, Any] = {}
    
    for key, value in query_params.items():
        # Convert string values to appropriate types
        converted_value: Any = convert_query_param_type(value)
        
        if "." in key:
            prefix: str
            param_name: str
            prefix, param_name = key.split(".", 1)
            if prefix not in result:
                result[prefix] = {}
            result[prefix][param_name] = converted_value
        else:
            result[key] = converted_value
    
    return result


def convert_query_param_type(value: str) -> Any:
    """Convert string query param to appropriate type.
    
    Args:
        value: String value from query parameter
        
    Returns:
        Converted value as bool, int, float, or str
    """
    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError):
        return value


def get_assembly_enum(assembly: str) -> Assembly:
    """Convert assembly string to Assembly enum.
    
    Args:
        assembly: Assembly name string (e.g., "WindTurbine")
        
    Returns:
        Assembly enum value
        
    Raises:
        HTTPException: If assembly name is invalid
    """
    mapping = {
        "WindTurbine": Assembly.WIND_TURBINE,
        "StatorMold": Assembly.STATOR_MOLD,
        "RotorMold": Assembly.ROTOR_MOLD,
        "MagnetJig": Assembly.MAGNET_JIG,
        "CoilWinder": Assembly.COIL_WINDER,
        "BladeTemplate": Assembly.BLADE_TEMPLATE,
    }
    result = mapping.get(assembly)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid assembly type")
    return result


async def create_sse_stream(request: Request, execute_func, *args, **kwargs) -> StreamingResponse:
    """Generic SSE stream handler for progress updates.
    
    Creates a Server-Sent Events stream that executes a long-running function
    and broadcasts progress updates to the client in real-time.
    
    Args:
        request: FastAPI Request object for disconnect detection
        execute_func: Async function to execute (must accept progress_callback kwarg)
        *args: Positional arguments to pass to execute_func
        **kwargs: Keyword arguments to pass to execute_func
        
    Returns:
        StreamingResponse with text/event-stream media type
        
    Events:
        progress: {"progress": int, "message": str} - Progress update (0-100)
        complete: any - Operation completed successfully with result (dict, str, list, etc.)
        cancelled: {"message": str} - Operation was cancelled
        error: {"error": str} - Operation failed with error
    """
    async def event_stream():
        try:
            if await request.is_disconnected():
                return
                
            progress_queue = asyncio.Queue()
            stream_active = threading.Event()
            stream_active.set()
            loop = asyncio.get_event_loop()
        
            def progress_callback(message: str, progress: int):
                if not stream_active.is_set():
                    return
                try:
                    asyncio.run_coroutine_threadsafe(
                        progress_queue.put({
                            "progress": progress, 
                            "message": message
                        }),
                        loop
                    )
                except Exception:
                    pass
            
            task = asyncio.create_task(
                execute_func(*args, progress_callback=progress_callback, **kwargs)
            )
            
            try:
                while not task.done():
                    if await request.is_disconnected():
                        task.cancel()
                        return
                    
                    try:
                        progress_data = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                        try:
                            yield f"event: progress\ndata: {json.dumps(progress_data)}\n\n"
                        except Exception:
                            task.cancel()
                            return
                    except asyncio.TimeoutError:
                        try:
                            yield ": keepalive\n\n"
                        except Exception:
                            task.cancel()
                            return
                
                # Drain remaining progress updates
                while not progress_queue.empty():
                    try:
                        progress_data = progress_queue.get_nowait()
                        yield f"event: progress\ndata: {json.dumps(progress_data)}\n\n"
                    except asyncio.QueueEmpty:
                        break
                
                result = await task
                
                if result is not None:
                    yield f"event: complete\ndata: {json.dumps(result)}\n\n"
                else:
                    yield f"event: cancelled\ndata: {json.dumps({'message': 'Operation cancelled'})}\n\n"
                
            except asyncio.CancelledError:
                return
            except InterruptedError:
                yield f"event: cancelled\ndata: {json.dumps({'message': 'Operation cancelled'})}\n\n"
            except Exception as e:
                logger.error(f"SSE stream error: {e}")
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            logger.debug(f"SSE stream ended: {e}")
        finally:
            stream_active.clear()
    
    return StreamingResponse(event_stream(), media_type="text/event-stream")


async def execute_visualize_with_progress(assembly: str, parameters: dict, progress_callback) -> dict | None:
    """Execute visualize operation with progress updates."""
    try:
        loop = asyncio.get_event_loop()
        
        # Phase 1: load_all (0-80%)
        magnafpm_parameters = parameters["magnafpm"]
        furling_parameters = parameters["furling"] 
        user_parameters = parameters["user"]
        
        root_documents, spreadsheet_document = await loop.run_in_executor(
            None, 
            partial(load_all_with_cache, progress_callback=progress_callback),
            magnafpm_parameters, furling_parameters, user_parameters
        )
        
        # Phase 2: Assembly processing (80-100%)
        try:
            progress_callback(f"Processing {assembly} assembly...", 90)
        except Exception as e:
            logger.warning(f"Progress callback failed (likely cancelled): {e}")
    except InterruptedError:
        logger.info(f"Visualize operation cancelled")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in execute_visualize_with_progress: {e}")
        raise
    
    assembly_enum = get_assembly_enum(assembly)
    
    assembly_index = list(Assembly).index(assembly_enum)
    assembly_document = root_documents[assembly_index]
    
    try:
        progress_callback(f"Converting {assembly} to OBJ...", 95)
    except Exception as e:
        logger.warning(f"Progress callback failed (likely cancelled): {e}")
    
    obj_text = await loop.run_in_executor(
        None, get_assembly_to_obj, assembly_enum, assembly_document
    )
    
    furl_transform = None
    if assembly_enum == Assembly.WIND_TURBINE:
        furl_transform = await loop.run_in_executor(
            None, get_furl_transform, assembly_document, spreadsheet_document
        )
    
    try:
        progress_callback(f"Completed {assembly} visualization", 100)
    except Exception as e:
        logger.warning(f"Final progress callback failed (likely cancelled): {e}")
    
    return {"objText": obj_text, "furlTransform": furl_transform}


async def execute_cnc_overview_with_progress(parameters: dict, progress_callback) -> str | None:
    """Execute CNC overview operation with progress updates."""
    try:
        loop = asyncio.get_event_loop()
        
        # Phase 1: load_all (0-80%)
        magnafpm_parameters = parameters["magnafpm"]
        furling_parameters = parameters["furling"]
        user_parameters = parameters["user"]
        
        root_documents, spreadsheet_document = await loop.run_in_executor(
            None,
            partial(load_all_with_cache, progress_callback=progress_callback),
            
            magnafpm_parameters, furling_parameters, user_parameters
        )
        
        # Phase 2: Generate DXF/SVG (80-100%)
        try:
            progress_callback("Generating CNC overview...", 90)
        except Exception as e:
            logger.warning(f"Progress callback failed (likely cancelled): {e}")
        
        svg_content = await loop.run_in_executor(
            None, get_dxf_as_svg, root_documents, magnafpm_parameters
        )
        
        try:
            progress_callback("Completed CNC overview", 100)
        except Exception as e:
            logger.warning(f"Final progress callback failed (likely cancelled): {e}")
        
        return svg_content
    except InterruptedError:
        logger.info("CNC overview operation cancelled")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in execute_cnc_overview_with_progress: {e}")
        raise


async def execute_dimension_tables_with_progress(parameters: dict, progress_callback) -> dict | None:
    """Execute dimension tables operation with progress updates."""
    try:
        logger.info("Starting execute_dimension_tables_with_progress")
        loop = asyncio.get_event_loop()
        
        # Phase 1: load_all (0-80%)
        magnafpm_parameters = parameters["magnafpm"]
        furling_parameters = parameters["furling"]
        user_parameters = parameters["user"]
        
        root_documents, spreadsheet_document = await loop.run_in_executor(
            None,
            partial(load_all_with_cache, progress_callback=progress_callback),
            
            magnafpm_parameters, furling_parameters, user_parameters
        )
        
        # Phase 2: Generate dimension tables (80-100%)
        try:
            progress_callback("Generating dimension tables...", 90)
        except Exception as e:
            logger.warning(f"Progress callback failed (likely cancelled): {e}")
        
        img_base_path_prefix = (
            "/squashfs-root" if sys.platform == "darwin" else "/squashfs-root/usr"
        )
        
        tables = await loop.run_in_executor(
            None,
            get_dimension_tables,
            spreadsheet_document,
            App.listDocuments()["Alternator"],
            f"{img_base_path_prefix}/Mod/openafpm-cad-core/openafpm_cad_core/img/"
        )
        
        try:
            progress_callback("Completed dimension tables", 100)
        except Exception as e:
            logger.warning(f"Final progress callback failed (likely cancelled): {e}")
        
        return tables
    except InterruptedError:
        logger.info("Dimension tables operation cancelled")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in execute_dimension_tables_with_progress: {e}")
        raise


# Mount static file directories after API routes
project_root = Path(__file__).parent.parent
app.mount(
    "/squashfs-root",
    StaticFiles(
        directory=str(project_root / "squashfs-root"), html=True, follow_symlink=True
    ),
    name="squashfs-root",
)
app.mount(
    "/node_modules",
    StaticFiles(directory=str(project_root / "node_modules")),
    name="node_modules",
)
app.mount("/", StaticFiles(directory=str(project_root), html=True), name="static")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="debug")
