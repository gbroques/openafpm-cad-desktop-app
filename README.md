# OpenAFPM CAD Desktop App

A desktop application for quickly testing the integration between [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core) and [openafpm-cad-visualization](https://github.com/gbroques/openafpm-cad-visualization).

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

    On Linux, you can download and extract [the latest AppImage](https://github.com/FreeCAD/FreeCAD/releases/tag/0.20) for the `squashfs-root` directory seen in the above example.

    ```
    chmod +x ./FreeCAD-0.20.0-Linux-x86_64.AppImage
    ./FreeCAD-0.20.0-Linux-x86_64.AppImage --appimage-extract
    ```

    Clone or symlink `openafpm-cad-core` and [`freecad-to-obj`](https://github.com/gbroques/freecad-to-obj) to FreeCAD Mod directory. See [Installing more workbenches](https://wiki.freecadweb.org/Installing_more_workbenches#Installing_for_a_single_user) for additional information.

3. Start application.

       npm start

## Related Repositories

* [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core)
* [openafpm-cad-visualization](https://github.com/gbroques/openafpm-cad-visualization)
