#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Locate backend directory regardless of whether this script is in root, bin/, or node_modules/.bin/
let backendDir = path.resolve(__dirname, '../backend');
if (!fs.existsSync(backendDir)) {
  backendDir = path.resolve(__dirname, '../../backend');
}
if (!fs.existsSync(backendDir)) {
  backendDir = path.resolve(process.cwd(), 'backend');
}

process.chdir(backendDir);
require(path.join(backendDir, 'server.js'));
