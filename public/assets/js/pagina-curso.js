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

  function logoCursoSvg(linguagem) {
    if (linguagem === 'html') {
      return '<svg class="cl-course-logo cl-course-logo--shield" viewBox="0 0 64 64" aria-hidden="true"><g transform="translate(32 32) scale(1.18 1.1) translate(-32 -32)"><path fill="#e44d26" stroke="#002b36" stroke-width="2" stroke-linejoin="round" d="M8 4h48l-4.4 50.1L32 60 12.4 54.1z"/><path fill="#f16529" d="M32 9v45.8l15.8-4.8L51.6 9z"/><path fill="#fff" d="M18 17h28l-.7 7H25.7l.5 5.6h18.6l-1.4 15.6-11.4 3.2-11.4-3.2-.8-9h7.1l.3 3.6 4.8 1.3 4.8-1.3.5-5.3H19.7z"/></g></svg>';
    }
    if (linguagem === 'css') {
      return '<svg class="cl-course-logo cl-course-logo--shield" viewBox="0 0 512 512" aria-hidden="true"><path fill="#264de4" stroke="#002b36" stroke-width="16" stroke-linejoin="round" d="M71.357 460.819L30.272 0h451.456l-41.129 460.746L255.724 512z"/><path fill="#2965f1" d="M405.388 431.408l35.148-393.73H256v435.146z"/><path fill="#ebebeb" d="M124.46 208.59l5.065 56.517H256V208.59zM119.419 150.715H256V94.197H114.281zM256 355.372l-.248.066-62.944-16.996-4.023-45.076h-56.736l7.919 88.741 115.772 32.14.26-.073z"/><path fill="#fff" d="M255.805 208.59v56.517H325.4l-6.56 73.299-63.035 17.013v58.8l115.864-32.112.85-9.549 13.28-148.792 1.38-15.176 10.203-114.393H255.805v56.518h79.639L330.3 208.59z"/></svg>';
    }
    if (linguagem === 'js') {
      return '<svg class="cl-course-logo cl-course-logo--js" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="9" fill="#f7df1e"/><path fill="#202020" d="M34 49c1.2 2.4 3.4 4.2 7.2 4.2 3 0 5-1.5 5-3.6 0-2.5-2-3.4-5.4-4.9l-1.9-.8c-5.5-2.3-9.1-5.1-9.1-11.2 0-5.6 4.2-9.8 10.8-9.8 4.7 0 8 1.6 10.5 5.9l-5.7 3.6c-1.3-2.2-2.6-3-4.8-3-2.2 0-3.6 1.4-3.6 3 0 2.1 1.4 3 4.5 4.3l1.9.8c6.5 2.8 10.1 5.5 10.1 11.7 0 6.7-5.3 10.4-12.3 10.4-6.9 0-11.3-3.3-13.5-7.6zm-24.1.6c1.1 2 2.1 3.7 4.6 3.7 2.4 0 3.9-.9 3.9-4.4V23.3h7.5V49c0 7.8-4.6 11.4-11.2 11.4-6 0-9.5-3.1-11.3-6.8z"/></svg>';
    }
    return '';
  }

  function montarMenuCursos() {
    var lista = document.querySelector('#cl-sidebar .cl-topbar-menu');
    if (!lista || !CL.curso || !CL.curso.ORDEM_CURSOS) return;

    lista.innerHTML = CL.curso.ORDEM_CURSOS.map(function (cursoId) {
      var curso = CL.curso.CURSOS[cursoId];
      if (!curso) return '';
      var logo = logoCursoSvg(curso.linguagem);
      return '<li class="cl-topbar-item">' +
        '<a class="cl-topbar-link" data-page="course" href="#course/' + encodeURIComponent(curso.id) + '">' +
        logo +
        '<span class="cl-topbar-label">' + curso.nome + '</span>' +
        '<span class="cl-topbar-caret">&#9662;</span></a></li>';
    }).join('');
  }

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

  // Mesmo padrão de segurança do ide.js (bootIde/comTimeout): em redes
  // lentas, o Firestore pode demorar dezenas de segundos. Não faz
  // sentido deixar a trilha inteira travada esperando — depois de 6s,
  // ela é desenhada com o progresso vazio (tudo "disponível"/"não
  // concluído" nesta sessão) e, se a leitura real chegar depois, a
  // trilha é redesenhada sozinha com os dados certos.
  function comTimeout(promise, ms) {
    return Promise.race([
      promise.then(function (valor) { return { expirou: false, valor: valor }; }),
      new Promise(function (resolve) {
        setTimeout(function () { resolve({ expirou: true, valor: null }); }, ms);
      })
    ]);
  }

  function montarTrilha() {
    var container = document.getElementById('trilha-modulos-container');
    if (!container || !CL.curso || !CL.trilha) {
      return;
    }

    montarMenuCursos();
    var cursoId = resolverCursoId();
    var curso = CL.curso.CURSOS[cursoId];

    // Marca o container com o curso atual (html/css/js). É esse
    // atributo que o trilha.css usa pra escolher a imagem de fundo
    // certa — ver ".trilha-container[data-curso=...]" em trilha.css.
    container.setAttribute('data-curso', cursoId);

    /* if (tituloEl) tituloEl.textContent = 'Trilha de ' + curso.nome;*/
    /*if (subtituloEl) {
      subtituloEl.textContent = 'Cada nível é um módulo de ' + curso.nome +
        '. Complete um pra destravar o próximo — essa trilha é independente das outras.';
    }*/

    function desenhar(progresso) {
      progresso = progresso || {};

      // "Módulo atual" dessa trilha = 1º módulo ainda não concluído
      // (ou o último, se todos já estiverem concluídos).
      var moduloAtual = curso.modulos.find(function (m) {
        return !CL.curso.moduloConcluido(m, progresso);
      }) || curso.modulos[curso.modulos.length - 1];

      var nodes = CL.curso.buildModuloNodes(curso.modulos, progresso, moduloAtual.id);

      CL.trilha.render(container, {
        nodes: nodes,
        cursoId: cursoId,
        layout: 'vinte-um-por-tela',
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
    }

    var progressoPromise = (CL.api && typeof CL.api.listProgress === 'function')
      ? CL.api.listProgress().catch(function () { return {}; })
      : Promise.resolve({});

    comTimeout(progressoPromise, 6000).then(function (corrida) {
      if (!corrida.expirou) {
        desenhar(corrida.valor);
        return;
      }

      // Passou de 6s: libera a trilha agora (progresso vazio nesta
      // sessão) em vez de deixar o aluno olhando pra tela em branco.
      if (CL.config && CL.config.debug) {
        console.warn('[pagina-curso] Firestore demorou mais de 6s; desenhando a trilha com progresso vazio por enquanto.');
      }
      if (CL.ui && typeof CL.ui.showToast === 'function') {
        CL.ui.showToast('Sua conexão está lenta — mostrando a trilha sem o progresso salvo por enquanto.', 'warning', 6000);
      }
      desenhar({});

      // A leitura de verdade continua em segundo plano; quando (e se)
      // chegar, redesenha a trilha já com o progresso real. Diferente
      // do editor do IDE, redesenhar a trilha não tem risco nenhum de
      // perder nada que o aluno digitou.
      progressoPromise.then(function (progressoAtrasado) {
        desenhar(progressoAtrasado);
      });
    });
  }

  CL.pages.course.init = montarTrilha;

})();
