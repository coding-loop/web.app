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
const cursosComEtapas = [
  { pasta: 'html', prefixo: 'html' },
  { pasta: 'css', prefixo: 'css' },
  { pasta: 'js', prefixo: 'js' },
  { pasta: 'logprog', prefixo: 'logprog' },
  { pasta: 'cyber-security', prefixo: 'cyber-security' }
];
for (const curso of cursosComEtapas) {
  const cursoRoot = path.join('public', 'assets', 'content', curso.pasta);
  let quantidadeEtapas = 0;
  const modulos = fs.readdirSync(cursoRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && new RegExp('^' + curso.prefixo + '-modulo-\\d+$').test(entry.name));
  for (const modulo of modulos) {
    const moduloPath = path.join(cursoRoot, modulo.name);
    const numeroModulo = modulo.name.slice((curso.prefixo + '-modulo-').length);
    const etapas = fs.readdirSync(moduloPath, { withFileTypes: true }).filter((entry) => entry.isDirectory() && new RegExp('^' + curso.prefixo + '-etapa-\\d+$').test(entry.name));
    for (const etapa of etapas) {
      const numeroEtapa = etapa.name.slice((curso.prefixo + '-etapa-').length);
      const etapaPath = path.join(moduloPath, etapa.name);
      const base = path.join(etapaPath, curso.prefixo + '-modulo-' + numeroModulo + '-etapa-' + numeroEtapa);
      const registroEtapa = base + '.js';
      assert(fs.statSync(registroEtapa).isFile(), path.relative(root, registroEtapa) + ' ausente');
      for (const aba of ['conteudo', 'exercicio', 'questoes', 'desafio']) {
        for (const extensao of ['html', 'css', 'js']) {
          const asset = base + '-' + aba + '.' + extensao;
          assert(fs.statSync(asset).isFile(), path.relative(root, asset) + ' ausente');
        }
      }
      quantidadeEtapas++;
    }
  }
  assert(quantidadeEtapas > 0, 'Nenhuma etapa organizada para ' + curso.pasta);
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
