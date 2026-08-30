(function () {
  'use strict';

  /* Módulos planejados: serão liberados conforme suas etapas forem criadas. */
  for (var numero = 2; numero <= 120; numero++) {
    var numeroFormatado = String(numero).padStart(2, '0');
    window.CL.curso.registrarModulo('programming-logic', {
      id: 'programming-logic-modulo-' + numeroFormatado,
      numero: numero,
      nome: 'Módulo ' + numero,
      etapas: []
    });
  }
})();
