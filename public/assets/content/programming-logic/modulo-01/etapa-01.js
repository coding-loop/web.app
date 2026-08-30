(function () {
  window.CL.curso.registrarEtapa('programming-logic-modulo-01', 1, {
    titulo: 'Seu primeiro algoritmo',
    texto: '<p>Um algoritmo é uma sequência de instruções para resolver um problema. Vamos começar exibindo uma mensagem.</p>',
    missao: 'Use <code>console.log()</code> para exibir uma mensagem de boas-vindas.',
    codigoInicial: {
      html: '<h1>Lógica de Programação</h1>',
      css: '',
      js: '// Escreva sua mensagem aqui\n'
    },
    verificar: function (codigo) {
      return /console\.log\s*\(\s*[\'\"][^\'\"]+[\'\"]\s*\)/.test(codigo.js || '') ? 100 : 0;
    }
  });
})();
