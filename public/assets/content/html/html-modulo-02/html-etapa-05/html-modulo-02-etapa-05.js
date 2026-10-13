(function () {
  window.CL.curso.registrarEtapa("html-modulo-02", 5, {
    titulo: "Projeto: página completa",
    codigoInicial: {"html":"<h1>Minha página</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<footer\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
