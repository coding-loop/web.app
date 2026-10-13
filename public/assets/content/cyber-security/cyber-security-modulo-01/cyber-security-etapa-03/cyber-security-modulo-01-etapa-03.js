(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-01", 3, {
    titulo: "Autenticação multifator",
    codigoInicial: {"html":"<h1>Guia de segurança digital</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<li\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
