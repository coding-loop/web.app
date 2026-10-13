(function () {
  window.CL.curso.registrarEtapa("js-modulo-02", 1, {
    titulo: "Funções",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("function\\s+saudar\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
