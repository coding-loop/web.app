/* Extrai SVGs embutidos em HTML/JS para assets/images/icons.svg.
   Não altera os arquivos-fonte: apenas cria os assets para uso futuro. */
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const publicDir = path.join(raiz, 'public');
const destino = path.join(publicDir, 'assets', 'images', 'icons.svg');
const fontes = [];

function listar(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entrada) => {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) listar(completo);
    else if (/\.(html|js)$/i.test(entrada.name)) fontes.push(completo);
  });
}

listar(publicDir);
fs.mkdirSync(destino, { recursive: true });

const manifest = [];
let total = 0;

/* Remove somente os arquivos produzidos pela execução anterior, listados
   no próprio manifesto. Ícones originais da pasta nunca são tocados. */
const manifestoAnterior = path.join(destino, 'embedded-icons-manifest.json');
if (fs.existsSync(manifestoAnterior)) {
  try {
    JSON.parse(fs.readFileSync(manifestoAnterior, 'utf8')).forEach((item) => {
      const alvo = path.join(destino, item.nome);
      if (fs.existsSync(alvo)) fs.unlinkSync(alvo);
    });
  } catch (_) {}
}

fontes.forEach((arquivo) => {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const relativo = path.relative(publicDir, arquivo).replace(/\\/g, '/');
  /* Arquivos .html armazenados como imagem não são código-fonte da UI. */
  if (relativo.startsWith('assets/images/')) return;
  const base = relativo.replace(/\.(html|js)$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const encontrados = texto.match(/<svg\b[\s\S]*?<\/svg>/gi) || [];

  encontrados.forEach((svg, indice) => {
    const nome = `${base}-${String(indice + 1).padStart(3, '0')}.svg`;
    const conteudo = /\bxmlns=/.test(svg)
      ? svg
      : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    fs.writeFileSync(path.join(destino, nome), `${conteudo}\n`, 'utf8');
    manifest.push({ arquivo: relativo, indice: indice + 1, nome });
    total++;
  });
});

fs.writeFileSync(path.join(destino, 'embedded-icons-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Extraídos ${total} SVGs para ${path.relative(raiz, destino)}.`);
