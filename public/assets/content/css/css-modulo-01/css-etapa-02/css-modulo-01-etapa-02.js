(function () {
  window.CL.curso.registrarEtapa("css-modulo-01", 2, {
    titulo: "Seletores de classe",
    codigoInicial: {"html":"<article class=\"cartao\"><h1>Meu cartão</h1><p>Conteúdo.</p></article>","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("article\\.cartao\\s*\\{", 'i').test((codigo["css"] || '')) ? 100 : 0;
    }
  });
})();
