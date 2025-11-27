# OpenAFPM CAD Desktop App

A desktop application for quickly testing the integration between [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core) and [openafpm-cad-visualization](https://github.com/gbroques/openafpm-cad-visualization).

## Automatic FreeCAD Installation

The application automatically downloads and installs FreeCAD on first run. No manual FreeCAD installation is required for end users.

On first launch, the app will detect if FreeCAD is already installed. If not found, it will download FreeCAD to:
- Linux: `~/.config/openafpm-cad-desktop-app/freecad/<version>/`
- macOS: `~/Library/Application Support/openafpm-cad-desktop-app/freecad/<version>/`
- Windows: `%APPDATA%\openafpm-cad-desktop-app\freecad\<version>\`

This only happens once. Subsequent launches will use the downloaded FreeCAD installation.

## Prerequisites
1. Install [Node.js](https://nodejs.org/en/).
2. Install [Yarn](https://yarnpkg.com/).

       npm install yarn -g

3. Install dependencies.

       yarn install

   This will also install Python dependencies ([openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core), [freecad-to-obj](https://github.com/gbroques/freecad-to-obj), fastapi, uvicorn) to `site-packages/` and download FreeCAD if not already present.

## How to Run

    npm start

## Related Repositories

* [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core)
* [openafpm-cad-visualization](https://github.com/gbroques/openafpm-cad-visualization)
