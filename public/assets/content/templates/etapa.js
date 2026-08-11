/* crie a pasta do curso e um arquivo chamado etapa.js dentro dela. Em seguida, adicione o código abaixo no arquivo etapa.js */

(function () {
  window.CL.curso.registrarEtapa('nome-do-curso-modulo-01', 1, {
    titulo: 'Sua primeira etapa',
    texto: '<p>Explique aqui o conceito.</p>',
    missao: 'Descreva aqui o exercício prático.',
    codigoInicial: { html: '', css: '', js: 'print("Olá, mundo!")' },
    verificar: function (codigo) {
      return /print\s*\(/.test(codigo.js || '') ? 100 : 0;
    }
  });
})();

(function () {
  window.CL.curso.registrarEtapa('NomeDoCurso-modulo-02', 1, {
    titulo: 'Criando links',

    texto: '<p>Links usam a tag <code>&lt;a&gt;</code>.</p>',

    missao: 'Crie um link para o site MDN.',

    codigoInicial: {
      html: '<a href=""></a>',
      css: '',
      js: ''
    },

    verificar: function (codigo) {
      return /<a[^>]+href=["'][^"']+["'][^>]*>/i.test(codigo.html || '')
        ? 100
        : 0;
    }
  });
})();
