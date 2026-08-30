/* =====================================================
   INTEGRAÇÃO — como plugar dicionario-typescript-pt-br.js
   no traduzirDiagnosticoMonaco já existente em ide.js.

   1) Adicionar <script defer src="assets/js/dicionario-typescript-pt-br.js"></script>
      no ide.html, ANTES de ide.js.

   2) Substituir a função traduzirDiagnosticoMonaco(mensagem)
      por esta versão, que recebe também o código do
      diagnóstico e tenta a tradução oficial primeiro.
   ===================================================== */

/* Constrói, a partir do template em inglês (ex.: "Cannot find name '{0}'."),
   um regex que captura os valores nas posições {0}, {1}... Os mesmos
   placeholders existem no template em português, então dá pra
   reaproveitar os valores capturados sem precisar entender o que
   cada um significa. */
function construirComparadorDeTemplate(templateEn) {
  var indices = [];
  var regexEscapado = templateEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  regexEscapado = regexEscapado.replace(/\\\{(\d+)\\\}/g, function (_, indice) {
    indices.push(Number(indice));
    return '([\\s\\S]+?)';
  });
  return { regex: new RegExp('^' + regexEscapado + '$'), indices: indices };
}

function preencherTemplatePt(templatePt, valoresPorIndice) {
  return templatePt.replace(/\{(\d+)\}/g, function (correspondencia, indice) {
    var valor = valoresPorIndice[Number(indice)];
    return valor !== undefined ? valor : correspondencia;
  });
}

/* Cache dos comparadores compilados — evita reconstruir o regex a
   cada diagnóstico igual que aparecer na tela. */
var _cacheComparadoresTs = {};

function traduzirPorCodigoOficial(codigo, mensagemOriginal) {
  if (!codigo || !window.CL_TS_DIAGNOSTICOS) return null;
  var par = window.CL_TS_DIAGNOSTICOS[codigo];
  if (!par) return null;

  var templateEn = par[0];
  var templatePt = par[1];

  /* Caso comum: mensagem sem parâmetro nenhum (bate direto). */
  if (templateEn === mensagemOriginal) return templatePt;

  if (!_cacheComparadoresTs[codigo]) {
    _cacheComparadoresTs[codigo] = construirComparadorDeTemplate(templateEn);
  }
  var comparador = _cacheComparadoresTs[codigo];
  var resultado = mensagemOriginal.match(comparador.regex);
  if (!resultado) return null; // versão do compilador mudou a frase; cai no fallback

  var valores = {};
  comparador.indices.forEach(function (indicePlaceholder, posicao) {
    valores[indicePlaceholder] = resultado[posicao + 1];
  });
  return preencherTemplatePt(templatePt, valores);
}

/* Nova assinatura: recebe o código do diagnóstico quando disponível
   (marker.code no Monaco). Tenta a tradução oficial (cobre ~2000
   mensagens do TS/JS); se não achar ou o código não existir (ex.:
   diagnósticos de CSS/JSON, que não vêm do compilador TypeScript),
   cai no dicionário manual que já existia. */
function traduzirDiagnosticoMonaco(mensagem, codigo) {
  var texto = String(mensagem || '');

  var traduzidaPorCodigo = traduzirPorCodigoOficial(codigo, texto);
  if (traduzidaPorCodigo !== null) return traduzidaPorCodigo;

  /* ---- a partir daqui, o corpo é o mesmo traduzirDiagnosticoMonaco
     que já existe em ide.js (dicionário manual + regex pra CSS/JSON) ---- */
  var traducoesExatas = {
    'Expression expected.': 'Era esperada uma expressão.'
    // ... manter todas as entradas atuais aqui
  };
  if (traducoesExatas[texto]) return traducoesExatas[texto];
  return texto
    .replace(/^At-rule or selector expected\.$/i, 'Era esperada uma regra CSS ou um seletor.');
    // ... manter todas as regras de CSS/JSON atuais aqui
}

/* ---- Atualizar os 3 pontos que chamam traduzirDiagnosticoMonaco
   pra passar também o código: ---- */

// Em getNativeAnnotations:
//   text: traduzirDiagnosticoMonaco(marker.message || 'Diagnóstico do editor.', marker.code && (marker.code.value || marker.code)),

// Em localizarMarcadoresNativos, para o marker principal:
//   message: traduzirDiagnosticoMonaco(marker.message, marker.code && (marker.code.value || marker.code)),

// E para relatedInformation (não tem code próprio; passar undefined,
// cai automaticamente no fallback manual):
//   message: traduzirDiagnosticoMonaco(informacao.message)
