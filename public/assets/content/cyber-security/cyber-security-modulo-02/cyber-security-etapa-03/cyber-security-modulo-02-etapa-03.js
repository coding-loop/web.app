(function () {
  window.CL.curso.registrarEtapa("cyber-security-modulo-02", 3, {
    titulo: "Navegação segura",
    codigoInicial: {"html":"<h1>Guia de segurança digital</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<a\\b[\\s\\S]*href=", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
