/**
 * electron-builder fails to copy squashfs-root directory
 * due to symlinks.
 *
 * To workaround this, we instruct electron-builder to NOT copy
 * the squashfs-root directory in the build configuration, and
 * manually copy it with the cp command after packing.
 */
const path = require('path');
const { exec } = require('child_process');

exports.default = async function(context) {
  const { appOutDir } = context;
  const appDir = path.join(appOutDir, 'resources', 'app');
  const squashfsRootPath = path.join(__dirname, 'squashfs-root');
  const copyCommand = `cp --recursive ${squashfsRootPath} ${appDir}`;
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
