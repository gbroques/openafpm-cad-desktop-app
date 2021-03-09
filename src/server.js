const path = require('path');
const express = require('express');

const app = express();

const rootPath = path.join(__dirname, '..');

app.use(express.static(path.join(rootPath, 'public')));

app.use('/openafpm-cad-visualization.js', (req, res) => {
    res.sendFile(path.join(rootPath, 'node_modules', 'openafpm-cad-visualization', 'public', 'openafpm-cad-visualization.js'))
});

module.exports = app;