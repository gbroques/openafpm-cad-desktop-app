# OpenAFPM CAD Desktop App

## Prerequisites
1. Install [Node.js](https://nodejs.org/en/).
2. Install [FreeCAD 18.4](https://github.com/FreeCAD/FreeCAD/releases/tag/0.18.4).
3. Install [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core).

## How to Run
1. Install dependencies.

       npm install

2. Create a `.env` file in the root of this repository with the following environment variables:

    1. `PYTHON` - Path to Python executable. **Must** be compatible with version of `python` FreeCAD uses.
    2. `FREECAD_LIB` - Path to FreeCAD lib directory.

    An example `.env` file may look like:
    ```
    PYTHON=/home/g/Desktop/squashfs-root/usr/bin/python
    FREECAD_LIB=/home/g/Desktop/squashfs-root/usr/lib/
    ```

    See `.env.example`.

3. Start application.

       npm start

## Related Repositories

* [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core)
* [openafpm-cad-visualization](https://github.com/gbroques/openafpm-cad-visualization)
