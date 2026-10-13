(function () {
  window.CL.curso.registrarEtapa("programming-logic-modulo-02", 4, {
    titulo: "Percorrer uma lista",
    codigoInicial: {"html":"","css":"","js":"// Escreva seu algoritmo aqui\n"},
    verificar: function (codigo) {
      return new RegExp("for\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
