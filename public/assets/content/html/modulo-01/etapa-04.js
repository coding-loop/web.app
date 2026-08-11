(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 4, {
    titulo: 'Links',
    texto: '<p>Links usam a tag <code>&lt;a&gt;</code> e o atributo <code>href</code>. Eles conectam páginas e recursos da web.</p>',
    missao: 'Crie um link para <code>https://developer.mozilla.org</code> com um texto descritivo.',
    codigoInicial: { html: '<a href=""></a>', css: '', js: '' },
    verificar: function (codigo) { return /<a[^>]+href=["']https:\/\/developer\.mozilla\.org["'][^>]*>\s*[^<]+/i.test(codigo.html || '') ? 100 : 0; }
  });
})();
