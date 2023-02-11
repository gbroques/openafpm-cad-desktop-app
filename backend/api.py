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
import sys
import threading
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from inspect import signature
from multiprocessing import Pool, Process, Queue
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
            method_and_path = method + path
            self._operations_by_method_and_path[method_and_path] = operation
            return operation
        return decorator


def create_request_handler(operations_by_method_and_path: Dict[str, Callable], directory: Path) -> SimpleHTTPRequestHandler:
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def handle_request(self):
            self.log_request()
            method_and_path = self.command + self.path
            operation = operations_by_method_and_path[method_and_path]
            if operation:
                request_body = self.get_request_body()

                def execute(queue: Queue):
                    try:
                        date_time = self.log_date_time_string()
                        sys.stderr.write(
                            f'{date_time} [PID {os.getpid()}] [PPID {os.getppid()}] {operation.__name__}\n')
                        value = invoke_operation(operation, request_body)
                        has_exception = False
                    except Exception as exception:
                        print(traceback.format_exc())
                        value = exception
                        has_exception = True
                    queue.put({'value': value, 'has_exception': has_exception})
                queue = Queue()
                process = Process(target=execute, args=(queue,))
                process.start()
                result = queue.get()
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
            elif self.command == 'GET':
                return SimpleHTTPRequestHandler.do_GET(self)

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
    from openafpm_cad_core.app import WindTurbine, get_default_parameters
    return {
        WindTurbine.T_SHAPE.value: get_default_parameters(WindTurbine.T_SHAPE),
        WindTurbine.H_SHAPE.value: get_default_parameters(WindTurbine.H_SHAPE),
        WindTurbine.STAR_SHAPE.value: get_default_parameters(WindTurbine.STAR_SHAPE),
        WindTurbine.T_SHAPE_2F.value: get_default_parameters(
            WindTurbine.T_SHAPE_2F)
    }


@api.get('/api/parametersschema')
def handle_get_parameters_schema() -> dict:
    import FreeCAD
    from openafpm_cad_core.app import get_parameters_schema
    return get_parameters_schema()


def load_furl_transforms_from_parameters(parameters: dict) -> List[dict]:
    import FreeCAD
    from openafpm_cad_core.app import load_furl_transforms
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']
    return load_furl_transforms(magnafpm_parameters,
                                user_parameters,
                                furling_parameters)


def visualize_wind_turbine_from_parameters(parameters: dict) -> str:
    import FreeCAD
    from openafpm_cad_core.app import Assembly, assembly_to_obj
    magnafpm_parameters = parameters['magnafpm']
    user_parameters = parameters['user']
    furling_parameters = parameters['furling']
    return assembly_to_obj(
        Assembly.WIND_TURBINE,
        magnafpm_parameters,
        user_parameters,
        furling_parameters)


@api.post('/api/visualize')
def visualize(parameters: dict) -> dict:
    with Pool(processes=2) as pool:
        furl_transforms_result = pool.apply_async(
            load_furl_transforms_from_parameters, (parameters,))
        visualize_result = pool.apply_async(
            visualize_wind_turbine_from_parameters, (parameters,))
        furl_transforms = furl_transforms_result.get()
        obj_text = visualize_result.get()
    return {
        'objText': obj_text,
        'furlTransforms': furl_transforms
    }


@api.post('/api/archive')
def handle_create_archive(parameters: dict) -> bytes:
    import FreeCAD
    from openafpm_cad_core.app import create_archive
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
