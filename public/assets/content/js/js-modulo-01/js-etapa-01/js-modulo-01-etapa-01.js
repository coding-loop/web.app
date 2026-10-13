(function () {
  window.CL.curso.registrarEtapa('js-modulo-01', 1, {
    titulo: 'Seu primeiro comando',
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
