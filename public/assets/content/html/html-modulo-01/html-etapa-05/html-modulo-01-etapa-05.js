(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 5, {
    titulo: 'Seu primeiro cartão',
    codigoInicial: { html: '<main>\n  <h1></h1>\n  <p></p>\n  <a href="https://example.com"></a>\n</main>', css: '', js: '' },
    verificar: function (codigo) { var html = codigo.html || ''; return /<h1[^>]*>\s*[^<]+/i.test(html) && /<p[^>]*>\s*[^<]+/i.test(html) && /<a[^>]+href=/i.test(html) ? 100 : 0; }
  });
})();
