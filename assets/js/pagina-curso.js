/* =====================================================
   PAGINA-CURSO.JS
   Liga a trilha de módulos (CL.trilha + CL.curso) à página
   "course" registrada em router.js (#cl-page-course).

   Cada ícone do #cl-sidebar (HTML/CSS/JS) leva a uma trilha
   DIFERENTE e INDEPENDENTE: #course/html, #course/css,
   #course/js — CL.state.routeParam é o cursoId.

   Depende de: curso-data.js, trilha.js, api.js, auth.js,
   router.js (precisa carregar DEPOIS de router.js, pra
   CL.pages.course já existir).
   ===================================================== */
(function () {
  'use strict';

  window.CL = window.CL || {};
  var CL = window.CL;

  if (!CL.pages || !CL.pages.course) {
    return;
  }

  var tituloEl = document.getElementById('trilha-titulo');
  var subtituloEl = document.getElementById('trilha-subtitulo');

  function irParaIde(moduloId) {
    window.location.href = 'ide.html?modulo=' + encodeURIComponent(moduloId);
  }

  function resolverCursoId() {
    var alvo = CL.state && CL.state.routeParam;
    if (alvo && CL.curso.CURSOS[alvo]) {
      return alvo;
    }
    // Sem parâmetro (ou desconhecido) na hash -> primeira trilha
    // registrada (hoje, HTML), pra nunca ficar com a página vazia.
    return CL.curso.ORDEM_CURSOS[0];
  }

  function montarTrilha() {
    var container = document.getElementById('trilha-modulos-container');
    if (!container || !CL.curso || !CL.trilha) {
      return;
    }

    var cursoId = resolverCursoId();
    var curso = CL.curso.CURSOS[cursoId];

    if (tituloEl) tituloEl.textContent = 'Trilha de ' + curso.nome;
    if (subtituloEl) {
      subtituloEl.textContent = 'Cada nível é um módulo de ' + curso.nome +
        '. Complete um pra destravar o próximo — essa trilha é independente das outras.';
    }

    var progressoPromise = (CL.api && typeof CL.api.listProgress === 'function')
      ? CL.api.listProgress().catch(function () { return {}; })
      : Promise.resolve({});

    progressoPromise.then(function (progresso) {
      progresso = progresso || {};

      // "Módulo atual" dessa trilha = 1º módulo ainda não concluído
      // (ou o último, se todos já estiverem concluídos).
      var moduloAtual = curso.modulos.find(function (m) {
        return !CL.curso.moduloConcluido(m, progresso);
      }) || curso.modulos[curso.modulos.length - 1];

      var nodes = CL.curso.buildModuloNodes(curso.modulos, progresso, moduloAtual.id);

      CL.trilha.render(container, {
        nodes: nodes,
        onSelect: irParaIde,
        onReset: function (moduloId) {
          var confirmado = window.confirm(
            'Refazer este módulo? O progresso e o código salvo de todas as etapas dele serão apagados.'
          );
          if (!confirmado || !CL.api) return;

          var modulo = curso.modulos.filter(function (m) { return m.id === moduloId; })[0];
          if (!modulo) return;

          var apagamentos = [];
          modulo.etapas.forEach(function (etapa, i) {
            var chave = CL.curso.chaveEtapa(moduloId, i + 1);
            if (typeof CL.api.deleteProgress === 'function') apagamentos.push(CL.api.deleteProgress(chave));
            if (typeof CL.api.deleteExercise === 'function') apagamentos.push(CL.api.deleteExercise(chave));
          });

          Promise.all(apagamentos).catch(function () {}).then(montarTrilha);
        }
      });

      CL.trilha.destacar(container, moduloAtual.id);
    });
  }

  CL.pages.course.init = montarTrilha;

})();
