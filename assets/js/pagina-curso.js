/* =====================================================
   PAGINA-CURSO.JS
   Liga a trilha de módulos (CL.trilha + CL.curso) à página
   "course" registrada em router.js (#cl-page-course).

   Acessada tanto pelos ícones HTML/CSS/JS do #cl-sidebar
   (#course/<moduloId>) quanto por "Voltar para a dashboard"
   dentro do IDE — sempre a mesma trilha, sem sair da SPA.

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

  function irParaIde(moduloId) {
    window.location.href = 'ide.html?modulo=' + encodeURIComponent(moduloId);
  }

  function montarTrilha() {
    var container = document.getElementById('trilha-modulos-container');
    if (!container || !CL.curso || !CL.trilha) {
      return;
    }

    // #course/<moduloId> — de qual ícone (HTML/CSS/JS) o aluno veio.
    var moduloAlvo = CL.state && CL.state.routeParam;

    var progressoPromise = (CL.api && typeof CL.api.listProgress === 'function')
      ? CL.api.listProgress().catch(function () { return {}; })
      : Promise.resolve({});

    progressoPromise.then(function (progresso) {
      progresso = progresso || {};

      var nodes = CL.curso.buildModuloNodes(progresso, moduloAlvo);

      CL.trilha.render(container, {
        nodes: nodes,
        onSelect: irParaIde,
        onReset: function (moduloId) {
          var confirmado = window.confirm(
            'Refazer este módulo? O progresso e o código salvo de todas as etapas dele serão apagados.'
          );
          if (!confirmado || !CL.api) return;

          var modulo = CL.curso.MODULOS.filter(function (m) { return m.id === moduloId; })[0];
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

      if (moduloAlvo) {
        CL.trilha.destacar(container, moduloAlvo);
      }
    });
  }

  CL.pages.course.init = montarTrilha;

})();
