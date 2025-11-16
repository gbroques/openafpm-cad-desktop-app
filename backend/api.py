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

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
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
)
from request_collapse import request_collapse


@request_collapse
def request_collapsed_load_all(
    magnafpm_parameters, furling_parameters, user_parameters
):
    return load_all(magnafpm_parameters, furling_parameters, user_parameters)


app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
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
        default_rotor_disk_radius = default_parameters["magnafpm"]["RotorDiskRadius"]
        return get_parameters_schema(default_rotor_disk_radius)

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


@app.post("/api/visualize/{assembly}")
def visualize(assembly: str, request: ParametersRequest) -> dict:
    parameters = request.dict()
    magnafpm_parameters = parameters["magnafpm"]
    furling_parameters = parameters["furling"]
    user_parameters = parameters["user"]

    assembly_enum = {
        "WindTurbine": Assembly.WIND_TURBINE,
        "StatorMold": Assembly.STATOR_MOLD,
        "RotorMold": Assembly.ROTOR_MOLD,
        "MagnetJig": Assembly.MAGNET_JIG,
        "CoilWinder": Assembly.COIL_WINDER,
        "BladeTemplate": Assembly.BLADE_TEMPLATE,
    }.get(assembly)

    if not assembly_enum:
        raise HTTPException(status_code=400, detail="Invalid assembly type")

    root_documents, spreadsheet_document = request_collapsed_load_all(
        magnafpm_parameters, furling_parameters, user_parameters
    )

    assembly_index = list(Assembly).index(assembly_enum)
    assembly_document = root_documents[assembly_index]
    obj_text = get_assembly_to_obj(assembly_enum, assembly_document)

    if assembly_enum == Assembly.WIND_TURBINE:
        furl_transform = get_furl_transform(assembly_document, spreadsheet_document)
    else:
        furl_transform = None
    return {"objText": obj_text, "furlTransform": furl_transform}


@app.post("/api/archive")
def create_archive_endpoint(request: ParametersRequest):
    parameters = request.dict()
    magnafpm_parameters = parameters["magnafpm"]
    user_parameters = parameters["user"]
    furling_parameters = parameters["furling"]

    root_documents, spreadsheet_document = request_collapsed_load_all(
        magnafpm_parameters, furling_parameters, user_parameters
    )

    archive_bytes = get_freecad_archive(root_documents, spreadsheet_document)
    return Response(content=archive_bytes, media_type="application/octet-stream")


@app.post("/api/getcncoverview")
def get_cnc_overview(request: ParametersRequest) -> dict:
    parameters = request.dict()
    magnafpm_parameters = parameters["magnafpm"]
    furling_parameters = parameters["furling"]
    user_parameters = parameters["user"]

    root_documents, spreadsheet_document = request_collapsed_load_all(
        magnafpm_parameters, furling_parameters, user_parameters
    )

    svg = get_dxf_as_svg(root_documents, magnafpm_parameters)
    return {"svg": svg}


@app.post("/api/dxfarchive")
def create_dxf_archive_endpoint(request: ParametersRequest):
    parameters = request.dict()
    magnafpm_parameters = parameters["magnafpm"]
    user_parameters = parameters["user"]
    furling_parameters = parameters["furling"]

    root_documents, _ = request_collapsed_load_all(
        magnafpm_parameters, furling_parameters, user_parameters
    )

    dxf_bytes = get_dxf_archive(root_documents, magnafpm_parameters)
    return Response(content=dxf_bytes, media_type="application/octet-stream")


@app.post("/api/getdimensiontables")
def get_dimension_tables_endpoint(request: ParametersRequest) -> dict:
    parameters = request.dict()
    magnafpm_parameters = parameters["magnafpm"]
    furling_parameters = parameters["furling"]
    user_parameters = parameters["user"]

    root_documents, spreadsheet_document = request_collapsed_load_all(
        magnafpm_parameters, furling_parameters, user_parameters
    )

    img_base_path_prefix = (
        "/squashfs-root" if sys.platform == "darwin" else "/squashfs-root/usr"
    )
    tables = get_dimension_tables(
        spreadsheet_document,
        App.listDocuments()["Alternator"],
        img_path_prefix=f"{img_base_path_prefix}/Mod/openafpm-cad-core/openafpm_cad_core/img/",
    )
    return {"tables": tables}


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
