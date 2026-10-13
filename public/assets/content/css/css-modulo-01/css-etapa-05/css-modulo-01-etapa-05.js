(function () {
  window.CL.curso.registrarEtapa("css-modulo-01", 5, {
    titulo: "Modelo de caixa",
    codigoInicial: {"html":"<article class=\"cartao\"><h1>Meu cartão</h1><p>Conteúdo.</p></article>","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("padding\\s*:", 'i').test((codigo["css"] || '')) ? 100 : 0;
    }
  });
})();
