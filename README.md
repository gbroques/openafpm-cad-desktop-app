# OpenAFPM CAD Desktop App

A desktop application for quickly testing the integration between [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core) and [openafpm-cad-visualization](https://github.com/gbroques/openafpm-cad-visualization).

## Prerequisites
1. Install [Node.js](https://nodejs.org/en/).
2. Install dependencies.

       npm install

3. Install [FreeCAD](https://github.com/FreeCAD/FreeCAD/releases/tag/0.20), [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core) module (plus dependencies), and create `.env` file.

       ./install.sh

    Currently the [`install.sh`](./install.sh) script only supports Linux and Windows (via [Git for Windows](https://gitforwindows.org/)). A contribution to support MacOS is welcomed.

## How to Run

    npm start

## Application Data

Application data is stored in the user's application data directory depending upon the operating system.

| Operating System | Directory                                                |
| ---------------- | -------------------------------------------------------- |
| Linux            | `~/.local/share/openafpm-cad-desktop-app`                |
| MacOS            | `~/Library/Application Support/openafpm-cad-desktop-app` |
| Windows          | `%APPDATA%\openafpm-cad-desktop-app`                     |

Currently this directory consists of `wind-turbine.obj` and `WindTurbine.zip` files.

## Packaging & Distributing

[electron-builder](https://www.electron.build/) is used to package and distribute the application.

1. To generate the package directory (`dist`), run:

       npm run pack

2. Then package the application for distribution, run:

       npm run dist

Configuration for electron-builder is found under the `build` key in [`package.json`](./package.json).

`asar` is set to `false` to spawn Python child processes from Node.js via a bundled Python interpreter.

## Related Repositories

* [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core)
* [openafpm-cad-visualization](https://github.com/gbroques/openafpm-cad-visualization)
