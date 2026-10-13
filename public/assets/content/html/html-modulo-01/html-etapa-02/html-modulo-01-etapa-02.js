(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 2, {
    titulo: 'Parágrafos e significado',
    codigoInicial: { html: '<h1>Olá!</h1>\n<p></p>', css: '', js: '' },
    verificar: function (codigo) { return /<p[^>]*>\s*[^<]+\s*<\/p>/i.test(codigo.html || '') ? 100 : 0; }
  });
})();
