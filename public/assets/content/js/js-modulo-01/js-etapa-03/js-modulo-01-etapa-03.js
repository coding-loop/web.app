(function () {
  window.CL.curso.registrarEtapa("js-modulo-01", 3, {
    titulo: "Tipos de dados",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("typeof", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
