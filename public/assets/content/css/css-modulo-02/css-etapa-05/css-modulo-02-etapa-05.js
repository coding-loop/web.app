(function () {
  window.CL.curso.registrarEtapa("css-modulo-02", 5, {
    titulo: "Projeto: página de perfil",
    codigoInicial: {"html":"<article class=\"cartao\"><h1>Meu cartão</h1><p>Conteúdo.</p></article>","css":"","js":""},
    verificar: function (codigo) {
      return new RegExp("border-radius\\s*:", 'i').test((codigo["css"] || '')) ? 100 : 0;
    }
  });
})();
