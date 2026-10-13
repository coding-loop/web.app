(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-02", 5, {
    titulo: "Projeto: plano de resposta",
    codigoInicial: {"html":"<h1>Guia de segurança digital</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<main\\b[\\s\\S]*<ol\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
