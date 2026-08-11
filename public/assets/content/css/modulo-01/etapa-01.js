(function () {
  window.CL.curso.registrarEtapa('css-modulo-01', 1, {
    titulo: 'Seu primeiro estilo',

    texto: `
      <p>CSS define a aparência de elementos HTML.</p>
      <p>Uma regra possui um seletor, uma propriedade e um valor.</p>
    `,

    missao: 'Faça o título ficar azul usando CSS.',

    codigoInicial: {
      html: '<h1>Olá, CSS!</h1>',
      css: 'h1 {\n  \n}',
      js: ''
    },

    verificar: function (codigo) {
      return /h1\s*\{[\s\S]*color\s*:\s*(blue|#0000ff|rgb\(0,\s*0,\s*255\))/i
        .test(codigo.css || '')
        ? 100
        : 0;
    }
  });
})();