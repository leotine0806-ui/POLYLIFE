const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
let scripts = 0;
const errors = [];
function checkFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  try {
    if (file.endsWith('.json')) JSON.parse(source.replace(/^\uFEFF/, ''));
    if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) errors.push(relative + ': ' + result.stderr);
      scripts++;
    }
    if (file.endsWith('.html')) {
      for (const [index, match] of [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].entries()) {
        if (/\bsrc\s*=/.test(match[1]) || /application\/(?:ld\+)?json/.test(match[1])) continue;
        new vm.Script(match[2], { filename: relative + ':script-' + index });
        scripts++;
      }
      for (const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
        const target = match[1].split(/[?#]/)[0];
        if (!target || /^(?:[\w-]+:|\/\/|\$|\{)/.test(target)) continue;
        const asset = target.startsWith('/') ? path.join(root, 'src', target) : path.resolve(path.dirname(file), target);
        if (!fs.existsSync(asset)) errors.push(relative + ': asset mancante ' + target);
      }
    }
  } catch (error) { errors.push(relative + ': ' + error.message); }
}
for (const dir of ['', 'src', 'scripts', 'test']) {
  for (const item of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (item.isFile() && /\.(?:js|html|json)$/.test(item.name) && item.name !== 'package-lock.json') {
      checkFile(path.join(root, dir, item.name));
    }
  }
}
for (const name of ['manifest.json', 'manifest-studio.json']) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', name), 'utf8'));
  for (const icon of manifest.icons) {
    if (!fs.existsSync(path.join(root, 'src', icon.src))) errors.push(name + ': icona mancante ' + icon.src);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Controllati ${scripts} script attivi, JSON e asset HTML: nessun errore.`);
