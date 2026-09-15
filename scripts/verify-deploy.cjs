'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const config = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
assert.equal(config.hosting, undefined, 'A hospedagem é feita pelo GitHub Pages');
assert.equal(JSON.parse(fs.readFileSync('.firebaserc', 'utf8')).projects.default, 'coding-loop');
for (const entry of ['index.html', 'dashboard.html', 'ide.html', 'admin.html', '404.html']) {
  assert(fs.statSync(path.join('public', entry)).isFile(), entry + ' ausente');
}
assert(fs.statSync(config.firestore.rules).isFile());
JSON.parse(fs.readFileSync(config.firestore.indexes, 'utf8'));
let scripts = 0;
function check(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) check(file);
    else if (entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      assert.equal(result.status, 0, file + '\n' + result.stderr);
      scripts++;
    }
  }
}
check('public');
const security = spawnSync(process.execPath, ['reports/security/verify-security.cjs'], { stdio: 'inherit' });
assert.equal(security.status, 0, 'Verificação de segurança falhou');
console.log('Pré-deploy aprovado: páginas, configuração e sintaxe de ' + scripts + ' scripts.');
console.log('Site: GitHub Pages (public/). Firebase coding-loop: regras e índices.');
