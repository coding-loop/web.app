(function () {
  window.CL.curso.registrarEtapa('html-modulo-02', 1, {
    titulo: 'Imagens em HTML',

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