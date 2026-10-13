(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-02", 2, {
    titulo: "Privacidade e dados pessoais",
    codigoInicial: {"html":"<h1>Guia de segurança digital</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<section\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
