const path = require('path');
const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
app.use(express.urlencoded({ extended: true }));

const rootPath = path.join(__dirname, '..');

app.use(express.static(path.join(rootPath, 'public')));

app.use('/openafpm-cad-visualization.js', (req, res) => {
    res.sendFile(path.join(rootPath, 'node_modules', 'openafpm-cad-visualization', 'public', 'openafpm-cad-visualization.js'))
});

const groupByKey = {
    // magnafpm
    'RotorDiskRadius': 'magnafpm',
    'DiskThickness': 'magnafpm',
    'MagnetLength': 'magnafpm',
    'MagnetWidth': 'magnafpm',
    'MagnetThickness': 'magnafpm',
    'NumberMagnet': 'magnafpm',
    'StatorThickness': 'magnafpm',
    'CoilLegWidth': 'magnafpm',
    'CoilInnerWidth1': 'magnafpm',
    'CoilInnerWidth2': 'magnafpm',
    'MechanicalClearance': 'magnafpm',

    // furling
    'Angle': 'furling',
    'BracketLength': 'furling',
    'BracketWidth': 'furling',
    'BracketThickness': 'furling',
    'BoomLength': 'furling',
    'BoomPipeRadius': 'furling',
    'BoomPipeThickness': 'furling',
    'VaneThickness': 'furling',
    'VaneLength': 'furling',
    'VaneWidth': 'furling',
    'Offset': 'furling',

    // user
    'HubHolesPlacement': 'user',
    'RotorInnerCircle': 'user',
    'Holes': 'user',
    'MetalLengthL': 'user',
    'MetalThicknessL': 'user',
    'FlatMetalThickness': 'user',
    'YawPipeRadius': 'user',
    'PipeThickness': 'user',
    'ResineRotorMargin': 'user',
    'HubHoles': 'user'
};

app.use('/visualize', (req, res) => {
    const parameterByGroup = createdNestedObject(req.body,
        key => groupByKey[key],
        parseFloat);
    const json = JSON.stringify(parameterByGroup);
    const filepath = path.join(__dirname, 'parameters.json');
    fs.writeFileSync(filepath, json);
    const filename = 'wind-turbine.obj';
    const objFilepath = path.join(__dirname, '..', 'public', filename);
    visualize(objFilepath).then(() => {
        res.status(200).send({objUrl: filename});
    }).catch(err => {
        console.error(err);
        res.status(500).send({error: err.toString()});
    });
});

function visualize(filepath) {
    return new Promise((resolve, reject) => {
        exec(`python visualize.py ${filepath}`, {cwd: __dirname}, (error, stdout, stderr) => {
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

function createdNestedObject(object, groupGetter, valueTransformer) {
    const entries = Object.entries(object);
    return entries.reduce((acc, entry) => {
        const [key, value] = entry;
        const group = groupGetter(key);
        if (group === undefined) {
            return acc;
        }
        if (acc[group] === undefined) {
            acc[group] = {};
        }
        acc[group][key] = valueTransformer(value);
        return acc;
    }, {});
}

module.exports = app;
