#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/**
 * Downloads and extracts FreeCAD from GitHub releases.
 * @param {string} version - FreeCAD version to download
 * @param {string} userDataPath - Path to user data directory
 * @param {Function} onProgress - Progress callback function(message, value, max)
 * @returns {Promise<string>} Path to downloaded FreeCAD directory
 */
async function downloadFreeCAD(version, userDataPath, onProgress) {
  const platform = process.platform;
  const arch = process.arch;
  
  const downloadUrl = getDownloadUrl(platform, arch, version);
  const downloadDir = path.join(userDataPath, 'freecad', version);
  const extractedMarker = path.join(downloadDir, '.extracted');
  
  // Check if already fully set up
  if (fs.existsSync(extractedMarker)) {
    return downloadDir;
  }
  
  // Clean up old versions and incomplete downloads
  cleanupOldVersions(userDataPath, version);
  
  // Create download directory
  fs.mkdirSync(downloadDir, { recursive: true });
  
  try {
    // Download
    const filename = path.basename(new URL(downloadUrl).pathname);
    const archivePath = path.join(downloadDir, filename);
    
    if (!fs.existsSync(archivePath)) {
      console.log(`Downloading ${downloadUrl} to ${archivePath}`);
      await downloadFile(downloadUrl, archivePath, onProgress);
      console.log(`Download complete: ${archivePath}`);
    } else {
      console.log(`Archive already exists: ${archivePath}`);
    }
    
    // Verify file exists before extraction
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Archive not found after download: ${archivePath}`);
    }
    
    // Extract
    await extractWithProgress(
      () => extractArchive(archivePath, downloadDir, platform),
      onProgress
    );
    
    // Mark as extracted
    fs.writeFileSync(extractedMarker, '');
    
    // Delete archive to save disk space
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
    
    return downloadDir;
  } catch (error) {
    // Clean up on failure
    console.error('Download/extraction failed, cleaning up:', error);
    if (fs.existsSync(downloadDir)) {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    }
    throw error;
  }
}

/**
 * Gets download URL for FreeCAD based on platform and architecture.
 * @param {string} platform - Platform (linux, darwin, win32)
 * @param {string} arch - Architecture (arm64, x64)
 * @param {string} version - FreeCAD version
 * @returns {string} Download URL
 */
function getDownloadUrl(platform, arch, version) {
  const baseUrl = `https://github.com/FreeCAD/FreeCAD/releases/download/${version}/FreeCAD_${version}`;
  
  if (platform === 'linux') {
    return `${baseUrl}-conda-Linux-x86_64-py311.AppImage`;
  } else if (platform === 'darwin') {
    const macArch = arch === 'arm64' ? 'arm64' : 'x86_64';
    return `${baseUrl}-conda-macOS-${macArch}-py311.dmg`;
  } else if (platform === 'win32') {
    return `${baseUrl}-conda-Windows-x86_64-py311.7z`;
  }
  
  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Cleans up old FreeCAD versions from app data directory.
 * @param {string} userDataPath - Path to user data directory
 * @param {string} currentVersion - Current version to keep
 */
function cleanupOldVersions(userDataPath, currentVersion) {
  const freecadBaseDir = path.join(userDataPath, 'freecad');
  
  if (!fs.existsSync(freecadBaseDir)) return;
  
  const versions = fs.readdirSync(freecadBaseDir);
  
  for (const version of versions) {
    if (version !== currentVersion) {
      const versionPath = path.join(freecadBaseDir, version);
      fs.rmSync(versionPath, { recursive: true, force: true });
    }
  }
}

/**
 * Downloads a file with progress tracking.
 * @param {string} url - URL to download
 * @param {string} destPath - Destination file path
 * @param {Function} onProgress - Progress callback function(message, value, max)
 * @returns {Promise<string>} Path to downloaded file
 */
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    console.log(`Starting download from ${url}`);
    const file = fs.createWriteStream(destPath);
    
    const cleanup = () => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    };
    
    const request = https.get(url, (response) => {
      console.log(`Response status: ${response.statusCode}`);
      
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        console.log(`Redirecting to ${response.headers.location}`);
        cleanup();
        return downloadFile(response.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        cleanup();
        return reject(new Error(`Download failed: ${response.statusCode}`));
      }
      
      console.log(`Starting pipe to file`);
      
      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;
      let startTime = Date.now();
      let lastUpdateTime = startTime;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const now = Date.now();
        
        // Update every 500ms to avoid too many IPC calls
        if (now - lastUpdateTime > 500) {
          const elapsed = (now - startTime) / 1000; // seconds
          const speed = downloadedBytes / elapsed; // bytes per second
          const remaining = totalBytes - downloadedBytes;
          const eta = remaining / speed; // seconds
          
          const message = `Downloading FreeCAD: ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} (${Math.floor(downloadedBytes/totalBytes*100)}%)\nSpeed: ${formatBytes(speed)}/s • Time remaining: ~${formatTime(eta)}`;
          
          if (onProgress) {
            onProgress(message, downloadedBytes, totalBytes);
          }
          
          lastUpdateTime = now;
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        console.log(`File finish event`);
        file.close((err) => {
          if (err) {
            console.log(`File close error:`, err);
            reject(err);
          } else {
            console.log(`File closed successfully`);
            resolve(destPath);
          }
        });
      });
      
      file.on('error', (err) => {
        console.log(`File error:`, err);
        cleanup();
        reject(err);
      });
      
      response.on('error', (err) => {
        console.log(`Response error:`, err);
        cleanup();
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      console.log(`Request error:`, err);
      cleanup();
      reject(err);
    });
  });
}

/**
 * Formats bytes to MB.
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(0) + ' MB';
}

/**
 * Formats seconds to human-readable time.
 * @param {number} seconds - Number of seconds
 * @returns {string} Formatted string
 */
function formatTime(seconds) {
  if (seconds < 60) return Math.ceil(seconds) + ' seconds';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' minute' + (minutes !== 1 ? 's' : '');
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours + 'h ' + mins + 'm';
}

/**
 * Wraps extraction function with indeterminate progress.
 * @param {Function} extractFn - Extraction function to execute
 * @param {Function} onProgress - Progress callback function(message, value, max)
 * @returns {Promise<void>}
 */
async function extractWithProgress(extractFn, onProgress) {
  // Show indeterminate progress
  if (onProgress) {
    onProgress('Extracting FreeCAD...', 0, 0);
  }
  
  try {
    await extractFn();
  } catch (error) {
    throw error;
  }
}

/**
 * Extracts archive based on platform.
 * @param {string} archivePath - Path to archive file
 * @param {string} destDir - Destination directory
 * @param {string} platform - Platform (linux, darwin, win32)
 * @returns {Promise<void>}
 */
async function extractArchive(archivePath, destDir, platform) {
  if (platform === 'linux') {
    await extractLinuxAppImage(archivePath, destDir);
  } else if (platform === 'darwin') {
    await extractMacOSDmg(archivePath, destDir);
  } else if (platform === 'win32') {
    await extractWindows7z(archivePath, destDir);
  }
}

/**
 * Extracts Linux AppImage.
 * @param {string} archivePath - Path to AppImage file
 * @param {string} destDir - Destination directory
 * @returns {Promise<void>}
 */
async function extractLinuxAppImage(archivePath, destDir) {
  fs.chmodSync(archivePath, 0o755);
  await spawnAsync(archivePath, ['--appimage-extract'], { cwd: destDir });
}

/**
 * Extracts macOS DMG.
 * @param {string} archivePath - Path to DMG file
 * @param {string} destDir - Destination directory
 * @returns {Promise<void>}
 */
async function extractMacOSDmg(archivePath, destDir) {
  await spawnAsync('hdiutil', ['attach', archivePath]);
  
  try {
    const volumePath = '/Volumes/FreeCAD';
    const resourcesPath = `${volumePath}/FreeCAD.app/Contents/Resources`;
    await spawnAsync('cp', ['-r', resourcesPath, destDir]);
  } finally {
    await spawnAsync('hdiutil', ['detach', '/Volumes/FreeCAD']);
  }
}

/**
 * Extracts Windows 7z archive.
 * @param {string} archivePath - Path to 7z file
 * @param {string} destDir - Destination directory
 * @returns {Promise<void>}
 */
async function extractWindows7z(archivePath, destDir) {
  const sevenZip = require('7zip-bin');
  await spawnAsync(sevenZip.path7za, ['x', archivePath, `-o${destDir}`]);
}

/**
 * Promisified spawn that returns stdout/stderr.
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Spawn options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function spawnAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = '';
    let stderr = '';
    
    if (child.stdout) child.stdout.on('data', (data) => stdout += data);
    if (child.stderr) child.stderr.on('data', (data) => stderr += data);
    
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Gets the user data path based on platform.
 * @returns {string} User data directory path
 */
function getUserDataPath() {
  const appName = require('../package.json').name;
  
  if (process.platform === 'linux') {
    return path.join(os.homedir(), '.config', appName);
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  } else if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
  }
  
  throw new Error(`Unsupported platform: ${process.platform}`);
}

module.exports = downloadFreeCAD;

// CLI support
if (require.main === module) {
  const version = process.argv[2] || '1.0.2';
  const userDataPath = getUserDataPath();
  
  console.log(`Downloading FreeCAD ${version} to: ${userDataPath}`);
  
  downloadFreeCAD(
    version,
    userDataPath,
    (message, value, max) => {
      if (max === 0) {
        console.log(message);
      } else {
        const percent = Math.floor((value / max) * 100);
        process.stdout.write(`\r${message.split('\n')[0]} - ${percent}%`);
      }
    }
  ).then(downloadDir => {
    console.log(`\n\nFreeCAD downloaded successfully to: ${downloadDir}`);
    process.exit(0);
  }).catch(err => {
    console.error(`\n\nDownload failed: ${err.message}`);
    process.exit(1);
  });
}
