(function () {
  window.CL.curso.registrarEtapa("html-modulo-02", 4, {
    titulo: "Formulários e rótulos",
    codigoInicial: {"html":"<h1>Minha página</h1>\n","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("<label\\b[\\s\\S]*for=", 'i').test((codigo["html"] || '')) ? 100 : 0;
    }
  });
})();
