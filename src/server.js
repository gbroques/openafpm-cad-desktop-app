const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());

const rootPath = path.join(__dirname, '..');

app.use(express.static(path.join(rootPath, 'public')));

app.use('/openafpm-cad-visualization.js', (req, res) => {
    res.sendFile(path.join(rootPath, 'node_modules', 'openafpm-cad-visualization', 'public', 'openafpm-cad-visualization.js'))
});

app.use('/defaultparameters', (req, res) => {
    getDefaultParameters().then(defaultParameters => {
        res.status(200).send(JSON.parse(defaultParameters));
    }).catch(err => {
        console.error(err);
        res.status(500).send({ error: err.toString() });
    });
});

app.use('/visualize', (req, res) => {
    const json = JSON.stringify(req.body);
    const filepath = path.join(__dirname, 'parameters.json');
    fs.writeFileSync(filepath, json);
    const filename = 'wind-turbine.obj';
    const objFilepath = path.join(__dirname, '..', 'public', filename);
    visualize(objFilepath).then((stdout) => {
        console.log(stdout);
        res.status(200).send({ objUrl: filename });
    }).catch(err => {
        console.error(err);
        res.status(500).send({ error: err.toString() });
    });
});

function visualize(filepath) {
    return execPythonScript('visualize', filepath);
}

function getDefaultParameters() {
    return execPythonScript('get_default_parameters');
}

function execPythonScript(scriptName, ...args) {
    return new Promise((resolve, reject) => {
        const options = { cwd: __dirname };
        const command = `${process.env.PYTHON} ${scriptName}.py ${args.join(' ')}`;
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            if (stdout) {
                resolve(stdout);
            }
            if (stderr) {
                reject(stderr);
            }
        })
    });
}

module.exports = app;
