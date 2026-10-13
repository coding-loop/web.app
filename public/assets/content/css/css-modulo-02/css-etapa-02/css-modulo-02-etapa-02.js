(function () {
  window.CL.curso.registrarEtapa("css-modulo-02", 2, {
    titulo: "CSS Grid",
    codigoInicial: {"html":"<article class=\"cartao\"><h1>Meu cartão</h1><p>Conteúdo.</p></article>","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("display\\s*:\\s*grid", 'i').test((codigo["css"] || '')) ? 100 : 0;
    }
  });
})();
