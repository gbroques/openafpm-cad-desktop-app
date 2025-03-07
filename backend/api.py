"""
RESTful Web API exposing operations for FreeCAD wind turbine model.

FREECAD_LIB environment variable must be set to path where FreeCAD.so
is located relative to root of openafpm-cad-desktop-app.

Usage:

    python server.py [port]

Where port defaults to 8000.
"""
import itertools
import json
import os
import re
import sys
import threading
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from inspect import signature
from multiprocessing import Pipe, Pool, Process
from multiprocessing.connection import Connection
from pathlib import Path
from socketserver import ThreadingMixIn
from typing import Callable, Dict, List, Optional, Union

# Add FreeCAD lib directory to sys.path for importing FreeCAD.
# ------------------------------------------------------------------------
root_path = Path(__file__).absolute().parent.parent
freecad_lib = str(root_path.joinpath(os.environ['FREECAD_LIB']).resolve())
sys.path.insert(1, freecad_lib)
# ------------------------------------------------------------------------


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
        with StoppableThreadedHTTPServer((host, port), Handler) as httpd:
            httpd.run()

    def _route(self, path: str, method=str) -> Callable:
        def decorator(operation: Callable):
            method_and_path = method + ' ' + path
            self._operations_by_method_and_path[method_and_path] = operation
            return operation
        return decorator


def create_request_handler(operations_by_method_and_path: Dict[str, Callable], directory: Path) -> SimpleHTTPRequestHandler:
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def handle_request(self):
            self.log_request()
            if self.path.startswith('/api'):
                self.handle_api_request()
            elif self.command == 'GET':
                return SimpleHTTPRequestHandler.do_GET(self)

        def handle_api_request(self):
            for method_and_path, operation in operations_by_method_and_path.items():
                method, path = method_and_path.split(' ')
                path_variable_pattern = re.compile(r'<([A-Za-z-_]+)>')
                path_variable_match = re.search(
                    path_variable_pattern, path)
                path_matches = path == self.path
                path_variables_by_name = {}
                if path_variable_match:
                    path_variable_name = path_variable_match.group(1)
                    path_pattern = re.compile(path.replace(
                        path_variable_match.group(0), '([A-Za-z0-9-_]+)'))
                    path_value_match = path_pattern.match(self.path)
                    if path_value_match:
                        path_value = path_value_match.group(1)
                        path_variables_by_name[path_variable_name] = path_value
                        path_matches = True
                if method == self.command and path_matches:
                    request_body = self.get_request_body()

                    def execute(connection: Connection) -> None:
                        date_time = self.log_date_time_string()
                        sys.stderr.write(
                            f'{date_time} [PID {os.getpid()}] [PPID {os.getppid()}] {operation.__name__}\n')
                        try:
                            request = {
                                'body': request_body,
                                'path': path_variables_by_name
                            }
                            value = invoke_operation(operation, request)
                            has_exception = False
                        except Exception as exception:
                            sys.stderr.write(traceback.format_exc() + '\n')
                            value = exception
                            has_exception = True
                        connection.send(
                            {'value': value, 'has_exception': has_exception})
                        connection.close()
                    parent_connection, child_connection = Pipe(duplex=False)
                    process = Process(target=execute, args=(child_connection,))
                    process.start()
                    result = parent_connection.recv()
                    process.join()
                    if result['has_exception']:
                        http_status = HTTPStatus.INTERNAL_SERVER_ERROR
                        response = {'error': str(result['value'])}
                    else:
                        http_status = HTTPStatus.OK
                        response = result['value']
                    self.send_response_only(http_status)
                    self.write(response)
                    self.log_request(http_status)

        def write(self, response: Union[dict, bytes]):
            is_dict = type(response) == dict
            content_type = 'application/json' if is_dict else 'application/octet-stream'
            self.send_header('Content-Type', content_type)
            self.end_headers()
            try:
                self.wfile.write(dict_to_bytes(response)
                                 if is_dict else response)
            except BrokenPipeError:
                self.log_message('Connection closed.')

        def get_request_body(self) -> Optional[dict]:
            content_length = self.headers['Content-Length']
            if content_length and content_length != '0':
                input = self.rfile.read(int(content_length))
                request_body = json.loads(input)
            else:
                request_body = None
            return request_body

        def do_GET(self):
            self.handle_request()

        def do_POST(self):
            self.handle_request()

        # See https://github.com/python/cpython/blob/c5c12381b38494ebc2346bb01d3426160e068d35/Lib/http/server.py#L566-L595
        # https://en.wikipedia.org/wiki/List_of_Unicode_characters#Control_codes
        _control_char_table = str.maketrans(
            {c: fr'\x{c:02x}' for c in itertools.chain(range(0x20), range(0x7f, 0xa0))})
        _control_char_table[ord('\\')] = r'\\'

        def log_message(self, format, *args):
            message = format % args
            thread_name = threading.current_thread().name
            sys.stderr.write("%s [PID %s] %s %s\n" %
                             (self.log_date_time_string(),
                              os.getpid(),
                              thread_name,
                              message.translate(self._control_char_table)))

        def log_date_time_string(self):
            """Return the current time formatted for logging."""
            return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    return Handler


class StoppableThreadedHTTPServer(ThreadingMixIn, HTTPServer):
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
    import FreeCAD

    from openafpm_cad_core.app import get_default_parameters, get_presets
    first_five_presets = get_presets()[:5]
    first_five_default_parameters = [get_default_parameters(p) for p in first_five_presets]
    return {k: v for (k, v) in zip(first_five_presets, first_five_default_parameters)}


@api.get('/api/parametersschema')
def handle_get_parameters_schema() -> dict:
    import FreeCAD

    from openafpm_cad_core.app import (get_default_parameters,
                                       get_parameters_schema, get_presets)

    def get_parameters_schema_for_preset(preset: str):
        default_parameters = get_default_parameters(preset)
        default_rotor_disk_radius = default_parameters['magnafpm']['RotorDiskRadius']
        return get_parameters_schema(default_rotor_disk_radius)
    first_five_presets = get_presets()[:5]
    first_five_parameter_schemas = [get_parameters_schema_for_preset(p) for p in first_five_presets]
    return {k: v for (k, v) in zip(first_five_presets, first_five_parameter_schemas)}


def load_furl_transform_from_parameters(parameters: dict) -> List[dict]:
    import FreeCAD

    from openafpm_cad_core.app import load_furl_transform
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']
    return load_furl_transform(magnafpm_parameters,
                               user_parameters,
                               furling_parameters)


def visualize_from_parameters(parameters: dict, assembly) -> str:
    from openafpm_cad_core.app import assembly_to_obj
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']
    return assembly_to_obj(
        assembly,
        magnafpm_parameters,
        user_parameters,
        furling_parameters)


@api.post('/api/loadmat')
def load_mat(request: dict) -> dict:
    import FreeCAD

    from openafpm_cad_core.app import (
        loadmat, map_magnafpm_parameters,
        map_rotor_disk_radius_to_wind_turbine_shape)
    path = request['body']['path']
    magnafpm_parameters = map_magnafpm_parameters(loadmat(path))
    wind_turbine_shape = map_rotor_disk_radius_to_wind_turbine_shape(magnafpm_parameters['RotorDiskRadius'])
    return {
        'preset': wind_turbine_shape.value,
        'magnafpm': map_magnafpm_parameters(loadmat(path))
    }


@api.post('/api/visualize/<assembly>')
def visualize(request: dict) -> dict:
    import FreeCAD

    from openafpm_cad_core.app import Assembly
    parameters = request['body']
    assembly_path_parameter = request['path']['assembly']
    assembly = {
        'WindTurbine': Assembly.WIND_TURBINE,
        'StatorMold': Assembly.STATOR_MOLD,
        'RotorMold': Assembly.ROTOR_MOLD,
        'MagnetJig': Assembly.MAGNET_JIG,
        'CoilWinder': Assembly.COIL_WINDER,
        'BladeTemplate': Assembly.BLADE_TEMPLATE
    }[assembly_path_parameter]
    if assembly == Assembly.WIND_TURBINE:
        with Pool(processes=2) as pool:
            furl_transform_result = pool.apply_async(
                load_furl_transform_from_parameters, (parameters,))
            visualize_result = pool.apply_async(
                visualize_from_parameters, (parameters, assembly))
            furl_transform = furl_transform_result.get()
            obj_text = visualize_result.get()
    else:
        obj_text = visualize_from_parameters(parameters, assembly)
        furl_transform = None
    return {
        'objText': obj_text,
        'furlTransform': furl_transform
    }


@api.post('/api/archive')
def handle_create_archive(request: dict) -> bytes:
    import FreeCAD

    from openafpm_cad_core.app import create_archive
    parameters = request['body']
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']

    return create_archive(magnafpm_parameters,
                          user_parameters,
                          furling_parameters)


@api.post('/api/getcncoverview')
def get_cnc_overview(request: dict) -> dict:
    import FreeCAD

    from openafpm_cad_core.app import preview_dxf_as_svg
    parameters = request['body']
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']

    svg = preview_dxf_as_svg(magnafpm_parameters,
                             user_parameters,
                             furling_parameters)
    return {'svg': svg}


@api.post('/api/dxfarchive')
def handle_create_dxf_archive(request: dict) -> bytes:
    import FreeCAD

    from openafpm_cad_core.app import export_to_dxf
    parameters = request['body']
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']

    return export_to_dxf(magnafpm_parameters,
                         user_parameters,
                         furling_parameters)


@api.post('/api/getdimensiontables')
def handle_get_dimension_tables(request: dict) -> dict:
    import FreeCAD

    from openafpm_cad_core.app import get_dimension_tables
    parameters = request['body']
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']

    tables = get_dimension_tables(magnafpm_parameters,
                                  user_parameters,
                                  furling_parameters,
                                  img_path_prefix = '/squashfs-root/usr/Mod/openafpm-cad-core/openafpm_cad_core/img/')
    return {'tables': tables}


if __name__ == '__main__':
    port = 8000 if len(sys.argv) == 1 else int(sys.argv[1])
    print('Server listening for requests on port ' + str(port))
    api.run(host='', port=port)
