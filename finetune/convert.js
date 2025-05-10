const fs = require('fs');
const path = require('path');

// Read existing improvements file
const improvementsFilePath = './improvements.json';
const improvements = JSON.parse(fs.readFileSync(improvementsFilePath, 'utf-8')).improvements;

// Create the JSONL file
const jsonlFilePath = './improvements.jsonl';

const jsonlData = improvements.map(imp => {
  return JSON.stringify({
    prompt: "Extract actionable improvement from the following report:",
    completion: imp
  });
}).join('\n');

fs.writeFileSync(jsonlFilePath, jsonlData);

console.log('JSONL file created at:', jsonlFilePath);
