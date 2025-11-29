/**
 * electron-builder's dependency analysis (node-dep-tree) doesn't preserve
 * yarn's flat node_modules structure. It reorganizes dependencies based on
 * its own tree analysis, causing nested dependencies (e.g., lit-element)
 * to be placed in subdirectories instead of at the top level.
 * 
 * This breaks ES module imports that expect a flat structure.
 * 
 * Solution: Manually copy node_modules and site-packages using platform-specific
 * commands (rsync on Unix, robocopy on Windows), preserving yarn's flat structure
 * while excluding unnecessary files (.git directories, platform-specific binaries,
 * source files).
 * 
 * Additionally:
 * - Replace symlinks in site-packages with real clones for distribution
 * - Prune dev dependencies from the packaged app
 */
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);

function getCopyCommand(sourcePath, destPath, excludes) {
  const isWindows = os.platform() === 'win32';
  
  if (isWindows) {
    // robocopy: /E = copy subdirs including empty, /NFL = no file list, /NDL = no dir list
    // /XD = exclude directories, /XF = exclude files
    const excludeDirs = excludes.map(e => `"${e}"`).join(' ');
    return `robocopy "${sourcePath}" "${destPath}" /E /NFL /NDL /NJH /NJS /XD ${excludeDirs} & exit 0`;
  } else {
    // rsync: -a = archive mode, --exclude = exclude pattern
    const excludeArgs = excludes.map(e => `--exclude='${e}'`).join(' ');
    return `rsync -a ${excludeArgs} "${sourcePath}/" "${destPath}/"`;
  }
}

exports.default = async function(context) {
  const { appOutDir } = context;
  const appDir = path.join(
    appOutDir,
    fs.readdirSync(appOutDir, { recursive: true }).find(p => p.endsWith('/app') || p.endsWith('\\app'))
  );

  // Replace symlinks with real pip installs in SOURCE site-packages BEFORE copying
  const sourceSitePackagesDir = path.join(__dirname, 'site-packages');
  
  // Check if there are any symlinks that need to be replaced
  const hasSymlinks = ['openafpm_cad_core', 'freecad_to_obj'].some(name => {
    const packagePath = path.join(sourceSitePackagesDir, name);
    return fs.existsSync(packagePath) && fs.lstatSync(packagePath).isSymbolicLink();
  });
  
  if (hasSymlinks) {
    console.log('Found symlinks in site-packages, replacing with real installs...');
    
    // Remove symlinks
    for (const name of ['openafpm_cad_core', 'freecad_to_obj']) {
      const packagePath = path.join(sourceSitePackagesDir, name);
      if (fs.existsSync(packagePath) && fs.lstatSync(packagePath).isSymbolicLink()) {
        console.log(`Removing symlink: ${name}`);
        fs.unlinkSync(packagePath);
      }
    }
    
    // Run install script which will clone and install from git
    console.log('Running install-python-dependencies.sh to install from git...');
    await execAsync('./install-python-dependencies.sh', { cwd: __dirname });
  }

  const copyConfigs = [
    {
      dir: 'node_modules',
      excludes: ['.git', '7zip-bin/mac', '7zip-bin/win', 'three/src']
    },
    {
      dir: 'site-packages',
      excludes: ['.git']
    }
  ];

  // Copy directories
  for (const config of copyConfigs) {
    const sourcePath = path.join(__dirname, config.dir);
    const destPath = path.join(appDir, config.dir);
    const copyCommand = getCopyCommand(sourcePath, destPath, config.excludes);
    
    console.log(`Copying ${config.dir}...`);
    try {
      const { stdout, stderr } = await execAsync(copyCommand);
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (error) {
      console.error(`Error copying ${config.dir}:`, error);
      throw error;
    }
  }

  // Prune dev dependencies from packaged app
  console.log('Pruning dev dependencies from packaged app...');
  try {
    const { stdout, stderr } = await execAsync('npm prune --production', {
      cwd: appDir,
      stdio: 'inherit'
    });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log('Dev dependencies pruned successfully');
  } catch (error) {
    console.error('Error pruning dev dependencies:', error);
    throw error;
  }
};
