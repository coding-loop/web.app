(function () {
  'use strict';

  window.CL.curso.registrarEtapa('cyber-security-modulo-01', 1, {
    titulo: 'Proteja sistemas, informações e pessoas',
    codigoInicial: {
      html: '<h1>Minha segurança digital</h1>\n  <ul>\n    <li></li>\n    <li></li>\n    <li></li>\n  </ul>',
      css: '',
      js: ''
    },
    verificar: function (codigo) {
      var html = codigo.html || '';
      var list = /<ul\b[\s\S]*?<\/ul>/i.test(html);
      var items = (html.match(/<li\b[^>]*>\s*[^<\s][\s\S]*?<\/li>/gi) || []).length;
      return list && items >= 3 ? 100 : 0;
    }
  });
})();
