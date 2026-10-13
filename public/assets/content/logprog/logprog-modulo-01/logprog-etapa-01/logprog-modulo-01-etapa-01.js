(function () {
  'use strict';

  window.CL.curso.registrarEtapa('programming-logic-modulo-01', 1, {
    titulo: 'Seu primeiro algoritmo',
    codigoInicial: {
      html: '<h1>Lógica de Programação</h1>',
      css: '',
      js: '// Escreva sua mensagem aqui\n'
    },
    verificar: function (codigo) {
      return /console\.log\s*\(\s*[`'\"][^`'\"]+[`'\"]\s*\)/.test(codigo.js || '') ? 100 : 0;
    }
  });
})();
