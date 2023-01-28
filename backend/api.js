const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const express = require('express');
const os = require('os');
const rootPath = path.join(__dirname, '..');

require('dotenv').config({ path: path.join(rootPath, '.env') });

const api = express();
api.use(express.json());

const dataDir = path.join(getApplicationDataDirectory(), 'openafpm-cad-desktop-app');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const pythonPath = path.join(rootPath, process.env.PYTHON);
const frontendPath = path.join(rootPath, 'frontend');
api.use(express.static(frontendPath));
api.use('/web_modules', express.static(path.join(rootPath, 'node_modules')));
api.use('/data', express.static(dataDir));

api.get('/defaultparameters', (req, res) => {
  getDefaultParameters().then(defaultParameters => {
    res.status(200).send(JSON.parse(defaultParameters));
  }).catch(err => {
    console.error(err);
    res.status(500).send({ error: err.toString() });
  });
});

api.get('/parametersschema', (req, res) => {
  getParametersSchema().then(parametersSchema => {
    res.status(200).send(JSON.parse(parametersSchema));
  }).catch(err => {
    console.error(err);
    res.status(500).send({ error: err.toString() });
  });
});

api.post('/visualize', (req, res) => {
  const parameters = JSON.stringify(req.body).replaceAll('"', '\\"');
  const objFilename = 'wind-turbine.obj';
  const objTextPromise = visualize(dataDir, objFilename, parameters);
  const furlTransformsPromise = getFurlTransforms(parameters);
  const promise = Promise.all([objTextPromise, furlTransformsPromise]);
  promise.then(([stdout, furlTransformsJson]) => {
    console.log(stdout);
    const furlTransforms = JSON.parse(furlTransformsJson);
    res.status(200).send({ objUrl: `data/${objFilename}`, furlTransforms });
  }).catch(err => {
    console.error(err);
    res.status(500).send({ error: err.toString() });
  });
});

api.post('/archive', (req, res) => {
  const parameters = JSON.stringify(req.body).replaceAll('"', '\\"');
  createArchive(dataDir, parameters).then((message) => {
    console.log(message);
    res.status(200).send({ message });
  }).catch(err => {
    console.error(err);
    res.status(500).send({ error: err.toString() });
  });
});

function visualize(...args) {
  return execPythonScript('visualize', ...args);
}

function getFurlTransforms(...args) {
  return execPythonScript('get_furl_transforms', ...args);
}

function createArchive(...args) {
  return execPythonScript('create_archive', ...args);
}

function getDefaultParameters() {
  return execPythonScript('get_default_parameters');
}

function getParametersSchema() {
  return execPythonScript('get_parameters_schema');
}

function execPythonScript(scriptName, ...args) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, `${scriptName}.py`);
    const command = `${pythonPath} ${scriptPath} ${args.join(' ')}`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        if (stdout) {
          console.log(stdout);
        }
        reject(error);
      } else {
        if (stdout) {
          resolve(stdout);
        }
        if (stderr) {
          reject(stderr);
        }
      }
    })
  });
}

function getApplicationDataDirectory() {
  switch(process.platform) {
    case 'darwin':
      // https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/MacOSXDirectories/MacOSXDirectories.html
      return path.join(os.homedir(), 'Library', 'Application Support');
    case 'win32':
      return process.env.APPDATA;
    default:
      return path.join(os.homedir(), '.local', 'share');
  }
}

module.exports = api;
