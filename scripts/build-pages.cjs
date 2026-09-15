'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
// Pasta nova por execução: nenhum arquivo de uma publicação anterior permanece.
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-loop-pages-'));
let files = 0;
function copy(source, target) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'Coding Loop Backups' ||
        /^(firebase\.json|firestore\.rules)$|\.(md|example)$|debug\.log$|Zone.Identifier|^coding-loop-progresso.*\.json$/i.test(entry.name)) continue;
    const from = path.join(source, entry.name), to = path.join(target, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Link não permitido no pacote: ' + from);
    if (entry.isDirectory()) { fs.mkdirSync(to); copy(from, to); }
    else if (entry.isFile()) { fs.copyFileSync(from, to); files++; }
  }
}
copy(path.join(root, 'public'), output);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'directory=' + output + '\n');
console.log('Pacote GitHub Pages: ' + files + ' arquivos em ' + output);
