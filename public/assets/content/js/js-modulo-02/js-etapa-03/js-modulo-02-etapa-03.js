(function () {
  window.CL.curso.registrarEtapa("js-modulo-02", 3, {
    titulo: "Repetição com for",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("for\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
