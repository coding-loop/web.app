(function () {
  window.CL.curso.registrarEtapa("programming-logic-modulo-02", 2, {
    titulo: "Decompor em funções",
    codigoInicial: {"html":"","css":"","js":"// Escreva seu algoritmo aqui\n"},
    verificar: function (codigo) {
      return new RegExp("function\\s+dobro\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
