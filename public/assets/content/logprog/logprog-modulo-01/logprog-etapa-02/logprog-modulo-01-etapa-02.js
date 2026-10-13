(function () {
  window.CL.curso.registrarEtapa("programming-logic-modulo-01", 2, {
    titulo: "Variáveis e valores",
    codigoInicial: {"html":"","css":"","js":"// Escreva seu algoritmo aqui\n"},
    verificar: function (codigo) {
      return new RegExp("\\b(const|let)\\s+nome\\s*=", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
