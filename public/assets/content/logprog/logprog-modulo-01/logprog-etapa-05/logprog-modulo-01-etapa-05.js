(function () {
  window.CL.curso.registrarEtapa("programming-logic-modulo-01", 5, {
    titulo: "Comparações",
    codigoInicial: {"html":"","css":"","js":"// Escreva seu algoritmo aqui\n"},
    verificar: function (codigo) {
      return new RegExp("===", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
