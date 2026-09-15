(function () {
  window.CL.curso.registrarEtapa('programming-logic-modulo-01', 1, {
    titulo: 'Seu primeiro algoritmo',
    texto: '<p>Um algoritmo é uma sequência de instruções para resolver um problema. Vamos começar exibindo uma mensagem.</p>',
    questoes: [
      {
        pergunta: 'Para que serve um algoritmo?',
        opcoes: [
          'Para guardar imagens no computador.',
          'Para definir uma sequência de instruções que resolve um problema.',
          'Para substituir toda linguagem de programação.'
        ],
        correta: 1,
        explicacao: 'Um algoritmo organiza os passos necessários para resolver um problema.'
      }
    ],
    missao: 'Use <code>console.log()</code> para exibir uma mensagem de boas-vindas.',
    desafio: '<p>Personalize a mensagem do console com o seu nome e algo que você quer aprender a programar.</p><div class="task-box"><strong>Desafio:</strong> Escreva uma única mensagem clara, usando <code>console.log()</code>.</div>',
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
