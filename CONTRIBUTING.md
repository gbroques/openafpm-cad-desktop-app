# Contributing to OpenAFPM CAD Desktop App

## Development Setup

See [README.md](./README.md) for prerequisites and installation instructions.

## Running Tests

### Unit Tests

The tests use the bundled Python interpreter from the FreeCAD installation.

Run all unit tests:

```bash
find squashfs-root/ -type f -name python | xargs -I {} {} -m unittest discover -s tests/
```

Run tests with verbose output:

```bash
find squashfs-root/ -type f -name python | xargs -I {} {} -m unittest discover -s tests/ -v
```

Run a specific test file:

```bash
find squashfs-root/ -type f -name python | xargs -I {} {} -m unittest tests.backend.test_cancelable_singleflight_cache
```

Run a specific test:

```bash
find squashfs-root/ -type f -name python | xargs -I {} {} -m unittest tests.backend.test_cancelable_singleflight_cache.TestCancelableSingleflightCache.test_concurrent_requests_collapse
```

**Note:** All tests should pass before opening a pull request.

## Packaging & Distributing

[electron-builder](https://www.electron.build/) is used to package and distribute the application.

1. To generate the package directory (`dist`), run:

       npm run pack

2. Then package the application for distribution, run:

       npm run dist

Configuration for electron-builder is found under the `build` key in [`package.json`](./package.json).

`asar` is set to `false` to spawn Python child processes from Node.js via a bundled Python interpreter.

## Builds & Releases

The project uses GitHub Actions for automated builds ([`.github/workflows/build.yml`](.github/workflows/build.yml)):

- **Branch pushes (master):** Builds Linux AppImage only, uploads as artifact (7 day retention)
- **Tagged releases (v*):** Builds all platforms (Linux, Windows, macOS) and creates GitHub release

To create a release:

```bash
./release.sh 1.0.0
git push --follow-tags
```
