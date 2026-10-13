(function () {
  window.CL.curso.registrarEtapa('html-modulo-1', 1, {
    titulo: 'Bem-vindo ao HTML',
    codigoInicial: { html: '<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><title>Minha página</title></head>\n<body>\n  <h1>Seu nome aqui</h1>\n</body>\n</html>', css: '', js: '' },
    verificar: function (codigo) { return /<h1[^>]*>\s*(?!Seu nome aqui\s*<\/h1>)[^<]+\s*<\/h1>/i.test(codigo.html || '') ? 100 : 0; }
  });
})();
