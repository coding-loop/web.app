(function () {
  window.CL.curso.registrarEtapa("js-modulo-01", 5, {
    titulo: "Decisões com if",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("\\bif\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
