(function () {
  window.CL.curso.registrarEtapa("programming-logic-modulo-02", 3, {
    titulo: "Coleções de dados",
    codigoInicial: {"html":"","css":"","js":"// Escreva seu algoritmo aqui\n"},
    verificar: function (codigo) {
      return new RegExp("const\\s+valores\\s*=\\s*\\[", 'i').test((codigo["js"] || '')) ? 100 : 0;
    }
  });
})();
