(function () {
  'use strict';

  window.CL = window.CL || {};
  window.CL.curso = window.CL.curso || {};
  window.CL.curso.etapasPorArquivo = window.CL.curso.etapasPorArquivo || [];

  var modo = window.CL_CONTEUDO_MODO || 'automatico';
  var arquivos = modo === 'manual'
    ? (window.CL_CONTEUDO_MANIFEST_MANUAL || [])
    : (window.CL_CONTEUDO_MANIFEST_AUTOMATICO || []);

  function carregarArquivo(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Não foi possível carregar: ' + src)); };
      document.head.appendChild(script);
    });
  }

  /* Carrega em sequência e expõe uma Promise. Dashboard e IDE a aguardam
     antes de renderizar, eliminando a corrida entre conteúdo e interface. */
  CL.curso.conteudoPronto = arquivos.reduce(function (corrente, src) {
    return corrente.then(function () { return carregarArquivo(src); });
  }, Promise.resolve()).then(function () {
    if (CL.curso.aplicarEtapasPorArquivo) CL.curso.aplicarEtapasPorArquivo();
  });
})();
