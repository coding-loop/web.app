(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 3, {
    titulo: 'Hierarquia de títulos',
    texto: '<p>Os títulos vão de <code>&lt;h1&gt;</code> a <code>&lt;h6&gt;</code>. Use um <code>h1</code> para o tema principal e níveis menores para seções.</p>',
    missao: 'Crie um <code>h1</code> e, abaixo dele, um <code>h2</code> para uma seção.',
    codigoInicial: { html: '<h1></h1>\n<h2></h2>', css: '', js: '' },
    verificar: function (codigo) { var html = codigo.html || ''; return /<h1[^>]*>\s*[^<]+/i.test(html) && /<h2[^>]*>\s*[^<]+/i.test(html) ? 100 : 0; }
  });
})();
