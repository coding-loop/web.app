(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 3, {
    titulo: 'Hierarquia de títulos',
    codigoInicial: { html: '<h1></h1>\n<h2></h2>', css: '', js: '' },
    verificar: function (codigo) { var html = codigo.html || ''; return /<h1[^>]*>\s*[^<]+/i.test(html) && /<h2[^>]*>\s*[^<]+/i.test(html) ? 100 : 0; }
  });
})();
