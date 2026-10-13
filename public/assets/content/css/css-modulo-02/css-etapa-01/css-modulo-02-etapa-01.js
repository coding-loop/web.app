(function () {
  window.CL.curso.registrarEtapa("css-modulo-02", 1, {
    titulo: "Flexbox",
    codigoInicial: {"html":"<article class=\"cartao\"><h1>Meu cartão</h1><p>Conteúdo.</p></article>","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("display\\s*:\\s*flex", 'i').test((codigo["css"] || '')) ? 100 : 0;
    }
  });
})();
