(function () {
  window.CL.curso.registrarEtapa("js-modulo-02", 5, {
    titulo: "Eventos",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("addEventListener\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
