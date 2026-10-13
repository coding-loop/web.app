(function () {
  window.CL.curso.registrarEtapa("css-modulo-02", 4, {
    titulo: "Estados e interação",
    codigoInicial: {"html":"<article class=\"cartao\"><h1>Meu cartão</h1><p>Conteúdo.</p></article>","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp(":hover", 'i').test((codigo["css"] || '')) ? 100 : 0;
    }
  });
})();
