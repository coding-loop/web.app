(function () {
  window.CL.curso.registrarEtapa("css-modulo-01", 4, {
    titulo: "Tipografia",
    codigoInicial: {"html":"<article class=\"cartao\"><h1>Meu cartão</h1><p>Conteúdo.</p></article>","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("font-size\\s*:", 'i').test((codigo["css"] || '')) ? 100 : 0;
    }
  });
})();
