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

  // Replace symlinks with real pip installs in site-packages
  const sitePackagesDir = path.join(appDir, 'site-packages');
  
  // Read version from install-python-dependencies.sh
  const installScript = fs.readFileSync(path.join(__dirname, 'install-python-dependencies.sh'), 'utf8');
  const versionMatch = installScript.match(/OPENAFPM_CAD_CORE_VERSION="([^"]+)"/);
  const coreVersion = versionMatch ? versionMatch[1] : 'master';
  
  const repos = [
    { 
      name: 'openafpm_cad_core',
      pipUrl: `git+https://github.com/gbroques/openafpm-cad-core.git@${coreVersion}`
    }
  ];
  
  // Find Python path
  const pythonPath = process.env.PYTHON_PATH || 'python3';
  
  for (const repo of repos) {
    const packagePath = path.join(sitePackagesDir, repo.name);
    
    if (fs.existsSync(packagePath)) {
      const stats = fs.lstatSync(packagePath);
      
      if (stats.isSymbolicLink()) {
        console.log(`Replacing symlink ${repo.name} with pip install...`);
        fs.unlinkSync(packagePath);
        
        await execAsync(`"${pythonPath}" -m pip install --target "${sitePackagesDir}" "${repo.pipUrl}"`);
      }
    }
  }
  
  // Also remove freecad_to_obj symlink if it exists (will be installed as dependency)
  const freecadToObjPath = path.join(sitePackagesDir, 'freecad_to_obj');
  if (fs.existsSync(freecadToObjPath)) {
    const stats = fs.lstatSync(freecadToObjPath);
    if (stats.isSymbolicLink()) {
      console.log('Removing freecad_to_obj symlink (will be installed as dependency)...');
      fs.unlinkSync(freecadToObjPath);
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
