(function () {
  window.CL.curso.registrarEtapa("js-modulo-02", 4, {
    titulo: "Selecionar elementos",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("querySelector\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
