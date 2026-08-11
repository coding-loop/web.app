(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 2, {
    titulo: 'Parágrafos e significado',
    texto: '<p>Use <code>&lt;p&gt;</code> para textos em parágrafo. Cada elemento deve comunicar o significado do conteúdo, não apenas sua aparência.</p>',
    missao: 'Adicione um parágrafo abaixo do título contando o que você quer aprender.',
    codigoInicial: { html: '<h1>Olá!</h1>\n<p></p>', css: '', js: '' },
    verificar: function (codigo) { return /<p[^>]*>\s*[^<]+\s*<\/p>/i.test(codigo.html || '') ? 100 : 0; }
  });
})();
