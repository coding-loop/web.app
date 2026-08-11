(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 5, {
    titulo: 'Seu primeiro cartão',
    texto: '<p>Agora reúna títulos, texto e links em uma pequena apresentação. Essa composição é a base de muitos componentes de interface.</p>',
    missao: 'Monte uma apresentação com título, parágrafo e um link.',
    codigoInicial: { html: '<main>\n  <h1></h1>\n  <p></p>\n  <a href="https://example.com"></a>\n</main>', css: '', js: '' },
    verificar: function (codigo) { var html = codigo.html || ''; return /<h1[^>]*>\s*[^<]+/i.test(html) && /<p[^>]*>\s*[^<]+/i.test(html) && /<a[^>]+href=/i.test(html) ? 100 : 0; }
  });
})();
