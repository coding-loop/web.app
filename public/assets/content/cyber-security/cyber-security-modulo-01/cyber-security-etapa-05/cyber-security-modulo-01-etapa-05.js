(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-01", 5, {
    titulo: "Atualizações e segurança",
    codigoInicial: {"html":"<h1>Guia de segurança digital</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<h2\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
