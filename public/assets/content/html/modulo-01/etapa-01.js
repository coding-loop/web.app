(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 1, {
    titulo: 'Bem-vindo ao HTML',
    texto: '<p>HTML é a linguagem que organiza o conteúdo de uma página. Você escreve elementos, como títulos e parágrafos, entre tags.</p><p>Nesta primeira etapa, altere o texto visível da página e veja o resultado no preview.</p>',
    missao: 'Troque o texto dentro de <code>&lt;h1&gt;</code> pelo seu nome.',
    codigoInicial: { html: '<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><title>Minha página</title></head>\n<body>\n  <h1>Seu nome aqui</h1>\n</body>\n</html>', css: '', js: '' },
    verificar: function (codigo) { return /<h1[^>]*>\s*[^<]+\s*<\/h1>/i.test(codigo.html || '') ? 100 : 0; }
  });
})();
