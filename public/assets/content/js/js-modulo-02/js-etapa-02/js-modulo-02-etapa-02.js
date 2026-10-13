(function () {
  window.CL.curso.registrarEtapa("js-modulo-02", 2, {
    titulo: "Arrays",
    codigoInicial: {"html":"<h1>JavaScript</h1><button>Testar</button>","css":"","js":"// Escreva seu código aqui\n"},
    verificar: function (codigo) {
      return new RegExp("const\\s+tarefas\\s*=\\s*\\[", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
