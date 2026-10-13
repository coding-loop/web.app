(function () {
  window.CL.curso.registrarEtapa("js-modulo-01", 2, {
    titulo: "Variáveis com const",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("\\bconst\\s+mensagem\\s*=", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
