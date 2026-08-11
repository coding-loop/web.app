(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 6, {
    titulo: 'Imagens em HTML',

    texto: `
      <p>Use a tag <code>&lt;img&gt;</code> para inserir imagens.</p>
      <p>O atributo <code>src</code> informa o endereço, e
      <code>alt</code> descreve a imagem para acessibilidade.</p>
    `,

    missao: `
      Adicione uma imagem com <code>src</code> e um texto no
      atributo <code>alt</code>.
    `,

    codigoInicial: {
      html: '<img src="" alt="">',
      css: '',
      js: ''
    },

    verificar: function (codigo) {
      var html = codigo.html || '';

      return /<img[^>]+src=["'][^"']+["'][^>]+alt=["'][^"']+["']/i.test(html)
        ? 100
        : 0;
    }
  });
})();