const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
let changed = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content.replace(/import React from 'react';\n/g, '');
    newContent = newContent.replace(/import React,\s*{\s*/g, 'import { ');
    if (newContent !== content) {
        fs.writeFileSync(file, newContent, 'utf8');
        changed++;
    }
});
console.log(`Changed ${changed} files.`);
