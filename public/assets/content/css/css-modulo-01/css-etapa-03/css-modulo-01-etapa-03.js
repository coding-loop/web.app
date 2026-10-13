(function () {
  window.CL.curso.registrarEtapa("css-modulo-01", 3, {
    titulo: "Cores e contraste",
    codigoInicial: {"html":"<article class=\"cartao\"><h1>Meu cartão</h1><p>Conteúdo.</p></article>","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("background-color\\s*:", 'i').test((codigo["css"] || '')) ? 100 : 0;
    }
  });
})();
