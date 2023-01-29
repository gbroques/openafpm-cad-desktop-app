"""
RESTful Web API exposing operations for FreeCAD wind turbine model.

FREECAD_LIB environment variable must be set to path where FreeCAD.so
is located relative to root of openafpm-cad-desktop-app.

Usage:

    python server.py [port]

Where port defaults to 8000.
"""
import json
import os
import sys
from collections import defaultdict
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from inspect import signature
from multiprocessing import Process, Queue
from pathlib import Path
from typing import Callable, Dict, Optional, Union

# Add FreeCAD lib directory to sys.path for importing FreeCAD.
# ------------------------------------------------------------------------
root_path = Path(__file__).parent.parent
freecad_lib = str(root_path.joinpath(os.environ['FREECAD_LIB']).resolve())
sys.path.append(freecad_lib)
# ------------------------------------------------------------------------

import FreeCAD
from openafpm_cad_core.app import (Assembly, WindTurbine, assembly_to_obj,
                                   create_archive, get_default_parameters,
                                   get_parameters_schema, load_furl_transforms)


class Api:
    """Loosely inspired by Flask's App class."""

    def __init__(self) -> None:
        self._operations_by_method_and_path = defaultdict(dict)

    def get(self, path: str) -> Callable:
        return self._route(path, 'GET')

    def post(self, path: str) -> Callable:
        return self._route(path, 'POST')

    def run(self, host, port):
        Handler = create_request_handler(
            self._operations_by_method_and_path, root_path)
        with StoppableHTTPServer((host, port), Handler) as httpd:
            httpd.run()

    def _route(self, path: str, method=str) -> Callable:
        def decorator(operation: Callable):
            method_and_path = method + path
            self._operations_by_method_and_path[method_and_path] = operation
            return operation
        return decorator


def create_request_handler(operations_by_method_and_path: Dict[str, Callable], directory: Path) -> SimpleHTTPRequestHandler:
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)

        def handle_request(self):
            method_and_path = self.command + self.path
            operation = operations_by_method_and_path[method_and_path]
            if operation:
                request_body = self.get_request_body()
                try:
                    response = invoke_operation(operation, request_body)
                    http_status = HTTPStatus.OK
                except Exception as exception:
                    response = {'error': str(exception)}
                    http_status = HTTPStatus.INTERNAL_SERVER_ERROR
                self.send_response(http_status)
                self.write(response)
            elif self.command == 'GET':
                return SimpleHTTPRequestHandler.do_GET(self)

        def write(self, response: Union[dict, bytes]):
            is_dict = type(response) == dict
            content_type = 'application/json' if is_dict else 'application/octet-stream'
            self.send_header('Content-Type', content_type)
            self.end_headers()
            self.wfile.write(dict_to_bytes(response) if is_dict else response)

        def get_request_body(self) -> Optional[dict]:
            content_length = self.headers['Content-Length']
            if content_length:
                input = self.rfile.read(int(content_length))
                request_body = json.loads(input)
            else:
                request_body = None
            return request_body

        def do_GET(self):
            self.handle_request()

        def do_POST(self):
            self.handle_request()

    return Handler


class StoppableHTTPServer(HTTPServer):
    """https://stackoverflow.com/a/35576127"""

    def run(self):
        try:
            self.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            self.server_close()


def dict_to_bytes(dictionary: dict) -> bytes:
    return bytes(json.dumps(dictionary).encode('utf-8'))


def invoke_operation(operation: Callable, request_body: Optional[dict]) -> Union[dict, bytes]:
    if len(signature(operation).parameters):
        response = operation(request_body)
    else:
        response = operation()
    return response


api = Api()


@api.get('/api/defaultparameters')
def handle_get_default_parameters() -> dict:
    return {
        WindTurbine.T_SHAPE.value: get_default_parameters(WindTurbine.T_SHAPE),
        WindTurbine.H_SHAPE.value: get_default_parameters(WindTurbine.H_SHAPE),
        WindTurbine.STAR_SHAPE.value: get_default_parameters(WindTurbine.STAR_SHAPE),
        WindTurbine.T_SHAPE_2F.value: get_default_parameters(
            WindTurbine.T_SHAPE_2F)
    }


@api.get('/api/parametersschema')
def handle_get_parameters_schema() -> dict:
    return get_parameters_schema()


def load_furl_transforms_from_parameters(parameters: dict, queue: Queue) -> None:
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']
    queue.put(load_furl_transforms(magnafpm_parameters,
                                   user_parameters,
                                   furling_parameters))


def visualize_wind_turbine_from_parameters(parameters: dict, queue: Queue) -> None:
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']
    queue.put(assembly_to_obj(
        Assembly.WIND_TURBINE,
        magnafpm_parameters,
        user_parameters,
        furling_parameters))


@api.post('/api/visualize')
def visualize(parameters: dict) -> dict:
    furl_transforms_queue = Queue()
    furl_transforms_process = Process(
        target=load_furl_transforms_from_parameters, args=(parameters, furl_transforms_queue))
    visualize_queue = Queue()
    visualize_process = Process(
        target=visualize_wind_turbine_from_parameters, args=(parameters, visualize_queue))
    furl_transforms_process.start()
    visualize_process.start()
    furl_transforms = furl_transforms_queue.get()
    obj_text = visualize_queue.get()
    furl_transforms_process.join()
    visualize_process.join()
    return {
        'objText': obj_text,
        'furlTransforms': furl_transforms
    }


@api.post('/api/archive')
def handle_create_archive(parameters: dict) -> bytes:
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']

    return create_archive(magnafpm_parameters,
                          user_parameters,
                          furling_parameters)


if __name__ == '__main__':
    port = 8000 if len(sys.argv) == 1 else int(sys.argv[1])
    print('Server listening for requests on port ' + str(port))
    api.run(host='', port=port)
