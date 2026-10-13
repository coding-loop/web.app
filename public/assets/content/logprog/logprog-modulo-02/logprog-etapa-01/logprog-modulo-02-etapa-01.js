(function () {
  window.CL.curso.registrarEtapa("programming-logic-modulo-02", 1, {
    titulo: "Repetir com while",
    codigoInicial: {"html":"","css":"","js":"// Escreva seu algoritmo aqui\n"},
    verificar: function (codigo) {
      return new RegExp("while\\s*\\(", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
