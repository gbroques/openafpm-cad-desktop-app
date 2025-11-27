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
 */
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

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

  for (const config of copyConfigs) {
    const sourcePath = path.join(__dirname, config.dir);
    const destPath = path.join(appDir, config.dir);
    const copyCommand = getCopyCommand(sourcePath, destPath, config.excludes);
    
    console.log(`Copying ${config.dir}...`);
    exec(copyCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error copying ${config.dir}:`, error);
        if (stdout) console.log(stdout);
      } else {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      }
    });
  }
};
