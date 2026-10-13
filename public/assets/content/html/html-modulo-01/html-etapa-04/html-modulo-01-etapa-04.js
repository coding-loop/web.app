(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 4, {
    titulo: 'Links',
    codigoInicial: { html: '<a href=""></a>', css: '', js: '' },
    verificar: function (codigo) { return /<a[^>]+href=["']https:\/\/developer\.mozilla\.org["'][^>]*>\s*[^<]+/i.test(codigo.html || '') ? 100 : 0; }
  });
})();
