(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-01", 4, {
    titulo: "Reconhecer phishing",
    codigoInicial: {"html":"<h1>Guia de segurança digital</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<ul\\b[\\s\\S]*<li\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
