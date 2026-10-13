(function () {
  window.CL.curso.registrarEtapa("html-modulo-02", 3, {
    titulo: "Tabelas acessíveis",
    codigoInicial: {"html":"<h1>Minha página</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<th\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
