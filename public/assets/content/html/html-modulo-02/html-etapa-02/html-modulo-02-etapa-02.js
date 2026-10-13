(function () {
  window.CL.curso.registrarEtapa("html-modulo-02", 2, {
    titulo: "Regiões semânticas",
    codigoInicial: {"html":"<h1>Minha página</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<main\\b", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
