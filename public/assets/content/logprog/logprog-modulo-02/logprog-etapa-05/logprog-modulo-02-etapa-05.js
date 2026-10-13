(function () {
  window.CL.curso.registrarEtapa("programming-logic-modulo-02", 5, {
    titulo: "Projeto: validar uma entrada",
    codigoInicial: {"html":"","css":"","js":"// Escreva seu algoritmo aqui\n"},
    verificar: function (codigo) {
      return new RegExp("\\bif\\s*\\([\\s\\S]*\\belse\\b", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
