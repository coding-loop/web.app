(function () {
  window.CL.curso.registrarEtapa("js-modulo-01", 4, {
    titulo: "Operações numéricas",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("\\+", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
