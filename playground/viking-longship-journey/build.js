const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const ORDER = [
  '00-util.js',
  '05-textures.js',
  '10-sky.js',
  '20-terrain.js',
  '30-water.js',
  '40-ship.js',
  '45-crew.js',
  '50-world.js',
  '55-fx.js',
  '60-controls.js',
  '70-main.js',
];

const three = fs.readFileSync(path.join(SRC, 'three.min.js'), 'utf8');
const app = ORDER.map((f) => `\n/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');

let html = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
html = html.replace('/*__THREE__*/', () => three);
html = html.replace('/*__APP__*/', () => app);

const out = path.join(ROOT, 'index.html');
fs.writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`built ${out} (${kb} KB)`);
