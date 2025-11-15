/**
 * electron-builder fails to copy squashfs-root directory
 * due to symlinks, and fails to copy all of node_modules.
 *
 * To workaround this, we instruct electron-builder to NOT copy
 * the squashfs-root and node_modules directories in the build
 * configuration, and manually copy it with the cp command after packing.
 */
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

exports.default = async function(context) {
  const { appOutDir } = context;
  const appDir = path.join(
      appOutDir,
      fs.readdirSync(appOutDir, { recursive: true }).find(p => p.endsWith('/app'))
  );
  const directories = ['squashfs-root', 'node_modules'];
  for (const directory of directories) {
    const directoryPath = path.join(__dirname, directory);
    const copyCommand = `cp -r ${directoryPath} ${appDir}`;
    exec(copyCommand, (error, stdout, stderr) => {
      if (error) {
        if (stdout) {
          console.log(stdout);
        }
        console.error(error);
      } else {
        if (stdout) {
          console.log(stdout);
        }
        if (stderr) {
          console.error(stderr);
        }
      }
    });
  }
}
