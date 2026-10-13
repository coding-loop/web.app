(function () {
  window.CL.curso.registrarEtapa("programming-logic-modulo-01", 4, {
    titulo: "Decisões condicionais",
    codigoInicial: {"html":"","css":"","js":"// Escreva seu algoritmo aqui\n"},
    verificar: function (codigo) {
      return new RegExp("\\bif\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
