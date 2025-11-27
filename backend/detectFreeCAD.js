const { app } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Detects FreeCAD installation by checking .env cache and app data directory.
 * @param {string} rootPath - Root path of the application
 * @param {Function} onProgress - Progress callback function(message, value, max)
 * @returns {Promise<{python: string, freecadLib: string}|null>} FreeCAD paths or null if not found
 */
async function detectFreeCAD(rootPath, onProgress) {
  // Send progress event
  if (onProgress) {
    onProgress('Detecting FreeCAD installation...', 0, 1);
  }
  
  // 1. Check .env cache
  const cached = checkEnvCache(rootPath);
  if (cached) return cached;
  
  // 2. Check app data directory
  const appDataLocation = checkAppDataDirectory();
  if (appDataLocation) {
    const paths = resolveFreeCADPaths(appDataLocation);
    if (paths) {
      const version = getFreeCADVersion(appDataLocation);
      if (version && isCompatibleVersion(version)) {
        updateEnvFile(rootPath, paths.python, paths.freecadLib);
        return paths;
      }
    }
  }
  
  // Not found or incompatible
  return null;
}

/**
 * Checks .env file for cached FreeCAD paths and validates they exist.
 * @param {string} rootPath - Root path of the application
 * @returns {{python: string, freecadLib: string}|null} Cached paths or null if invalid
 */
function checkEnvCache(rootPath) {
  const envPath = path.join(rootPath, '.env');
  if (!fs.existsSync(envPath)) return null;
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  let pythonPath = null;
  let freecadLibPath = null;
  
  for (const line of lines) {
    if (line.startsWith('PYTHON=')) {
      pythonPath = line.substring('PYTHON='.length).trim();
    } else if (line.startsWith('FREECAD_LIB=')) {
      freecadLibPath = line.substring('FREECAD_LIB='.length).trim();
    }
  }
  
  if (!pythonPath || !freecadLibPath) return null;
  if (!fs.existsSync(pythonPath) || !fs.existsSync(freecadLibPath)) return null;
  
  return { python: pythonPath, freecadLib: freecadLibPath };
}

/**
 * Checks app data directory for downloaded FreeCAD installations.
 * @returns {string|null} Path to latest compatible FreeCAD version or null
 */
function checkAppDataDirectory() {
  const freecadDir = path.join(app.getPath('userData'), 'freecad');
  if (!fs.existsSync(freecadDir)) return null;
  
  const versions = fs.readdirSync(freecadDir).filter(name => {
    const fullPath = path.join(freecadDir, name);
    return fs.statSync(fullPath).isDirectory();
  });
  
  if (versions.length === 0) return null;
  
  // Find latest compatible version
  const compatible = versions
    .map(v => ({ version: v, parsed: parseVersionFromPath(v) }))
    .filter(v => v.parsed && isCompatibleVersion(v.parsed))
    .sort((a, b) => compareVersions(b.parsed, a.parsed));
  
  if (compatible.length === 0) return null;
  
  return path.join(freecadDir, compatible[0].version);
}

/**
 * Resolves FreeCAD Python and library paths for the current platform.
 * @param {string} freecadLocation - Path to FreeCAD installation
 * @returns {{python: string, freecadLib: string}|null} Resolved paths or null
 */
function resolveFreeCADPaths(freecadLocation) {
  const platform = process.platform;
  
  if (platform === 'linux') {
    return resolveLinuxPaths(freecadLocation);
  } else if (platform === 'darwin') {
    return resolveMacOSPaths(freecadLocation);
  } else if (platform === 'win32') {
    return resolveWindowsPaths(freecadLocation);
  }
  
  return null;
}

/**
 * Resolves FreeCAD paths for Linux (AppImage extraction).
 * @param {string} freecadLocation - Path to FreeCAD installation
 * @returns {{python: string, freecadLib: string}|null} Resolved paths or null
 */
function resolveLinuxPaths(freecadLocation) {
  // Check if it's an AppImage extraction (squashfs-root)
  let rootDir = freecadLocation;
  if (freecadLocation.includes('squashfs-root')) {
    rootDir = freecadLocation.substring(0, freecadLocation.indexOf('squashfs-root') + 'squashfs-root'.length);
  } else if (fs.existsSync(path.join(freecadLocation, 'squashfs-root'))) {
    rootDir = path.join(freecadLocation, 'squashfs-root');
  }
  
  const pythonPath = findFile(rootDir, 'python', ['usr/bin', 'bin']);
  const freecadSo = findFile(rootDir, 'FreeCAD.so', ['usr/lib', 'lib']);
  
  if (!pythonPath || !freecadSo) return null;
  
  return {
    python: pythonPath,
    freecadLib: path.dirname(freecadSo)
  };
}

/**
 * Resolves FreeCAD paths for macOS (app bundle).
 * @param {string} freecadLocation - Path to FreeCAD installation
 * @returns {{python: string, freecadLib: string}|null} Resolved paths or null
 */
function resolveMacOSPaths(freecadLocation) {
  // FreeCAD.app/Contents/Resources
  let resourcesDir = freecadLocation;
  if (freecadLocation.endsWith('.app')) {
    resourcesDir = path.join(freecadLocation, 'Contents', 'Resources');
  } else if (freecadLocation.includes('Resources')) {
    resourcesDir = freecadLocation.substring(0, freecadLocation.indexOf('Resources') + 'Resources'.length);
  }
  
  const pythonPath = findFile(resourcesDir, 'python', ['bin']);
  const freecadLib = path.join(resourcesDir, 'lib');
  
  if (!pythonPath || !fs.existsSync(freecadLib)) return null;
  
  return { python: pythonPath, freecadLib };
}

/**
 * Resolves FreeCAD paths for Windows (7z extraction).
 * @param {string} freecadLocation - Path to FreeCAD installation
 * @returns {{python: string, freecadLib: string}|null} Resolved paths or null
 */
function resolveWindowsPaths(freecadLocation) {
  let rootDir = freecadLocation;
  if (freecadLocation.endsWith('FreeCAD.exe')) {
    rootDir = path.dirname(path.dirname(freecadLocation)); // Go up from bin/
  }
  
  const pythonPath = findFile(rootDir, 'python.exe', ['bin']);
  const freecadDll = findFile(rootDir, 'FreeCADApp.dll', ['bin']);
  
  if (!pythonPath || !freecadDll) return null;
  
  return {
    python: pythonPath,
    freecadLib: path.dirname(freecadDll)
  };
}

/**
 * Finds a file in specified directories or recursively searches.
 * @param {string} rootDir - Root directory to search
 * @param {string} filename - Name of file to find
 * @param {string[]} searchDirs - Directories to check first
 * @returns {string|null} Path to file or null if not found
 */
function findFile(rootDir, filename, searchDirs) {
  for (const dir of searchDirs) {
    const fullPath = path.join(rootDir, dir, filename);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  
  // Fallback: recursive search (limited depth)
  try {
    const found = findFileRecursive(rootDir, filename, 3);
    return found;
  } catch (error) {
    return null;
  }
}

/**
 * Recursively searches for a file up to a maximum depth.
 * @param {string} dir - Directory to search
 * @param {string} filename - Name of file to find
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {string|null} Path to file or null if not found
 */
function findFileRecursive(dir, filename, maxDepth) {
  if (maxDepth <= 0) return null;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === filename) {
      return fullPath;
    } else if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, filename, maxDepth - 1);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * Gets FreeCAD version by parsing from path.
 * @param {string} freecadLocation - Path to FreeCAD installation
 * @returns {{major: number, minor: number, patch: number}|null} Version object or null
 */
function getFreeCADVersion(freecadLocation) {
  return parseVersionFromPath(freecadLocation);
}

/**
 * Parses version from path string (e.g., "freecad/1.0.2/" -> {major: 1, minor: 0, patch: 2}).
 * @param {string} pathStr - Path string containing version
 * @returns {{major: number, minor: number, patch: number}|null} Version object or null
 */
function parseVersionFromPath(pathStr) {
  // Look for version pattern like 1.0.2 in path
  const versionMatch = pathStr.match(/(\d+)\.(\d+)\.(\d+)/);
  if (versionMatch) {
    return {
      major: parseInt(versionMatch[1]),
      minor: parseInt(versionMatch[2]),
      patch: parseInt(versionMatch[3])
    };
  }
  return null;
}

/**
 * Checks if version is compatible (1.0.x only).
 * @param {{major: number, minor: number, patch: number}} version - Version to check
 * @returns {boolean} True if compatible
 */
function isCompatibleVersion(version) {
  return version.major === 1 && version.minor === 0;
}

/**
 * Compares two version objects.
 * @param {{major: number, minor: number, patch: number}} a - First version
 * @param {{major: number, minor: number, patch: number}} b - Second version
 * @returns {number} Negative if a < b, positive if a > b, zero if equal
 */
function compareVersions(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Updates or creates .env file with FreeCAD paths.
 * @param {string} rootPath - Root path of the application
 * @param {string} pythonPath - Path to Python executable
 * @param {string} freecadLibPath - Path to FreeCAD library directory
 */
function updateEnvFile(rootPath, pythonPath, freecadLibPath) {
  const envPath = path.join(rootPath, '.env');
  let lines = [];
  
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, 'utf8').split('\n');
  }
  
  const updated = { PYTHON: false, FREECAD_LIB: false };
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('PYTHON=')) {
      lines[i] = `PYTHON=${pythonPath}`;
      updated.PYTHON = true;
    } else if (lines[i].startsWith('FREECAD_LIB=')) {
      lines[i] = `FREECAD_LIB=${freecadLibPath}`;
      updated.FREECAD_LIB = true;
    }
  }
  
  if (!updated.PYTHON) lines.push(`PYTHON=${pythonPath}`);
  if (!updated.FREECAD_LIB) lines.push(`FREECAD_LIB=${freecadLibPath}`);
  
  fs.writeFileSync(envPath, lines.join('\n'));
}

module.exports = detectFreeCAD;
