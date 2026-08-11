(function () {
  window.CL.curso.registrarEtapa('js-modulo-01', 1, {
    titulo: 'Seu primeiro comando',
    texto: '<p>JavaScript torna páginas interativas. <code>console.log()</code> mostra uma mensagem no console do navegador.</p>',
    missao: 'Use <code>console.log()</code> para escrever uma mensagem de boas-vindas.',
    codigoInicial: {
      html: '<h1>JavaScript</h1>',
      css: '',
      js: '// Escreva sua mensagem aqui\n'
    },
    verificar: function (codigo) {
      return /console\.log\s*\(\s*['"][^'"]+['"]\s*\)/.test(codigo.js || '') ? 100 : 0;
    }
  });
})();
