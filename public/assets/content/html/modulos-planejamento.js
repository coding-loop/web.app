(function () {
  'use strict';

  /* Módulos visuais para planejar a trilha HTML. Eles não possuem etapas
     ainda e, portanto, ficam bloqueados até receberem conteúdo real. */
  // Mantenha este total alinhado ao número de posições que deseja planejar.
  for (var numero = 2; numero <= 120; numero++) {
    var numeroFormatado = String(numero).padStart(2, '0');
    window.CL.curso.registrarModulo('html', {
      id: 'html-modulo-' + numeroFormatado,
      numero: numero,
      nome: 'Módulo ' + numero,
      etapas: []
    });
  }
})();
