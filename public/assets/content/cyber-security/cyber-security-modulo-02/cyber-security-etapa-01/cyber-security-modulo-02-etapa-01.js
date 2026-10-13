(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-02", 1, {
    titulo: "Redes Wi-Fi seguras",
    codigoInicial: {"html":"<h1>Guia de segurança digital</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<ul\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
