# OpenAFPM CAD Desktop App

A desktop application for quickly testing the integration between [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core) and [openafpm-cad-visualization](https://github.com/gbroques/openafpm-cad-visualization).

## Prerequisites
1. Install [Node.js](https://nodejs.org/en/).
2. Install [Yarn](https://yarnpkg.com/).

       npm install yarn -g

3. Install dependencies.

       yarn install

4. Install [FreeCAD](https://github.com/FreeCAD/FreeCAD/releases/tag/0.20), [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core) module (plus dependencies), and create `.env` file.

       ./install.sh

## How to Run

    npm start

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
