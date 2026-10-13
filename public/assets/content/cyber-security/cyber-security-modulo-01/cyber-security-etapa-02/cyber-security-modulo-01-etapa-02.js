(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-01", 2, {
    titulo: "Senhas fortes",
    codigoInicial: {"html":"<h1>Guia de segurança digital</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<ul\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
