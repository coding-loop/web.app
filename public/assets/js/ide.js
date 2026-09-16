/* =====================================================
   IDE.JS
   Lógica da página do IDE integrado (editor de código +
   guia teórico com módulos/etapas + progresso do aluno).

   Página PROTEGIDA (ide.html define window.CL_PROTECTED_PAGE
   = true antes de carregar este arquivo): exige sessão válida
   antes de montar qualquer coisa.

   Progresso, posição e código ficam no armazenamento local por usuário,
   via CL.api (ver assets/js/api.js). A portabilidade entre dispositivos
   acontece pelos destinos de backup configurados pelo aluno.

   Depende de (carregados ANTES deste arquivo, em ide.html):
   firebase-init.js, auth.js, api.js e o SDK do Monaco.
   ===================================================== */
(function () {
  'use strict';

  window.CL = window.CL || {};
  var CL = window.CL;

  // Chamada pelo bootIde() (no rodapé deste arquivo) depois que o
  // guard de autenticação passou e os dados locais já foram carregados.
  // progressoCarregado/exerciciosCarregado/posicaoCarregada
  // vêm de CL.api.listProgress()/listExercises()/getProfile().
  function iniciarTeoria(progressoCarregado, exerciciosCarregado, posicaoCarregada) {
    // ==========================================================
    // MODELO DE DADOS — MÓDULOS E ETAPAS
    // Agora vive em assets/js/curso-data.js, compartilhado com a
    // Dashboard. Existem 3 trilhas INDEPENDENTES (html/css/js),
    // cada uma com seus próprios 10 módulos. Este IDE opera SEMPRE
    // dentro de UMA trilha por vez — descobrimos qual logo abaixo,
    // a partir de ?modulo= na URL (veio de um nível da trilha da
    // Dashboard) ou da última posição salva do aluno.
    // ==========================================================
    function determinarCursoInicial() {
      var moduloUrl = new URLSearchParams(window.location.search).get('modulo');
      if (moduloUrl) {
        var achado = CL.curso.encontrarModulo(moduloUrl);
        if (achado) return achado.cursoId;
      }
      if (posicaoCarregada && posicaoCarregada.moduloId) {
        var achadoSalvo = CL.curso.encontrarModulo(posicaoCarregada.moduloId);
        if (achadoSalvo) return achadoSalvo.cursoId;
      }
      return 'html'; // trilha padrão, se nada mais indicar qual usar
    }

    const cursoAtualId = determinarCursoInicial();
    const MODULOS = CL.curso.CURSOS[cursoAtualId].modulos;

    // A borda da caixa "Missão" usa a cor de identidade do curso atual.
    const plataforma = document.querySelector('.learning-platform-root');
    if (plataforma) {
      plataforma.setAttribute('data-curso', cursoAtualId);
    }

    // A IDE compartilha a preferência Solarized da plataforma. Como ela não
    // carrega app.js, a alternância é inicializada aqui de forma enxuta.
    const themeToggleBtn = document.getElementById('toggle-theme');
    function aplicarTema(theme) {
      theme = theme === 'solarized-light' ? 'solarized-light' : 'solarized-dark';
      document.documentElement.setAttribute('data-theme', theme);
      CL.state.theme = theme;
      if (CL.storage && typeof CL.storage.set === 'function') CL.storage.set('theme', theme);
      document.querySelectorAll('[data-icon-dark][data-icon-light]').forEach(function (icon) {
        icon.src = theme === 'solarized-light' ? icon.dataset.iconLight : icon.dataset.iconDark;
      });
      window.dispatchEvent(new CustomEvent('theme:mudou', { detail: theme }));
    }
    const temaSalvo = CL.storage && typeof CL.storage.get === 'function'
      ? CL.storage.get('theme', CL.config.defaultTheme)
      : CL.config.defaultTheme;
    aplicarTema(temaSalvo);
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', function () {
        aplicarTema(CL.state.theme === 'solarized-dark' ? 'solarized-light' : 'solarized-dark');
        atualizarIconeRetornoTrilha();
      });
    }

    // O botão de retorno identifica visualmente a trilha aberta na IDE.
    // A página inicia com HTML no markup para evitar ícone vazio antes do
    // carregamento; aqui aplicamos o ícone do curso efetivamente aberto.
    const courseDashboardIcon = document.getElementById('course-dashboard-icon');
    const courseIcons = {
      'programming-logic': 'assets/images/icons.svg/logica-de-programacao.svg?v=20260829-4',
      html: 'assets/images/icons.svg/logo-html.svg',
      css: 'assets/images/icons.svg/logo-css.svg',
      js: 'assets/images/icons.svg/logo-javascript.svg'
    };
    function atualizarIconeRetornoTrilha() {
      if (!courseDashboardIcon) return;
      const icone = courseIcons[cursoAtualId] || courseIcons.html;
      courseDashboardIcon.src = icone;
      courseDashboardIcon.alt = (CL.curso.CURSOS[cursoAtualId] || {}).nome || 'HTML';
    }
    atualizarIconeRetornoTrilha();

    // ==========================================================
    // MOTOR DE RENDERIZAÇÃO E NAVEGAÇÃO
    // ==========================================================

    let currentModuleIndex = 0;
    let currentStep = 1;

    function getModuloAtual() {
      return MODULOS[currentModuleIndex];
    }

    function getEtapasDoModulo() {
      return getModuloAtual().etapas;
    }

    function getTotalEtapas() {
      return getEtapasDoModulo().length;
    }

    /* Salva o editor atual antes de substituir a etapa exibida. A função é
       instalada pelo editor depois do boot; antes disso não há nada a gravar. */
    function prepararTrocaDeEtapa() {
      if (typeof window.salvarRascunhoAtualDaIde === 'function') {
        Promise.resolve(window.salvarRascunhoAtualDaIde()).then(function () {
          sincronizarNuvemAutomaticamente(true);
        });
      }
    }

    const theoryContentEl = document.getElementById('theory-content');
    const moduleTitleEl = document.getElementById('module-title');
    const btnBackupMenu = document.getElementById('btn-backup-menu');
    const backupMenuOptions = document.getElementById('backup-menu-options');
    const btnRestoreBackup = document.getElementById('btn-restore-backup');
    const btnBackupSettings = document.getElementById('btn-backup-settings');
    const backupSettingsDialog = document.getElementById('backup-settings-dialog');
    const backupSettingsForm = document.getElementById('backup-settings-form');
    const restoreBackupDialog = document.getElementById('restore-backup-dialog');
    const restoreBackupForm = document.getElementById('restore-backup-form');
    const restoreBackupSource = document.getElementById('restore-backup-source');
    const restoreBackupVersion = document.getElementById('restore-backup-version');
    const restoreBackupVersionRow = document.getElementById('restore-backup-version-row');
    const backupStatus = document.getElementById('backup-status');
    const btnSaveBackupSettings = document.getElementById('btn-save-backup-settings');
    const btnSelectBackupFolder = document.getElementById('btn-select-backup-folder');
    const btnSyncGoogleDrive = document.getElementById('btn-sync-google-drive');
    const btnSyncOneDrive = document.getElementById('btn-sync-onedrive');
    const cloudPermissionDialog = document.getElementById('cloud-permission-dialog');
    const cloudPermissionService = document.getElementById('cloud-permission-service');
    const cloudPermissionServiceCopy = document.getElementById('cloud-permission-service-copy');
    const cloudPermissionScope = document.getElementById('cloud-permission-scope');
    const cloudPermissionLimits = document.getElementById('cloud-permission-limits');
    const backupReminderDialog = document.getElementById('backup-reminder-dialog');
    const backupReminderDismiss = document.getElementById('backup-reminder-dismiss');
    const btnReminderConfigureBackup = document.getElementById('btn-reminder-configure-backup');
    const progressBar = document.getElementById('progress-bar');

    // ---------- Índice do curso (novo) ----------
    const toggleIndiceBtn = document.getElementById('toggle-indice');
    const indicePanelEl = document.getElementById('indice-etapas');
    const indiceListaEl = document.getElementById('indice-lista');
    const btnVoltarDashboard = document.getElementById('btn-voltar-dashboard');
    // Antes apontava pro Blogger antigo (URL morta). Agora usa o
    // mesmo dashboardUrl definido no config mínimo deste HTML (path
    // relativo, funciona na raiz ou em sub-path do GitHub Pages).
    const URL_DASHBOARD = (CL.config && CL.config.dashboardUrl) || 'dashboard.html';

    // Botão com o ícone do HTML + seta "<" no cabeçalho: sempre volta direto
    // para a dashboard (não abre mais o índice), já na trilha de módulos,
    // mirando o módulo em que o aluno está agora.
    btnVoltarDashboard.addEventListener('click', function () {
      irParaTrilhaDeModulos();
    });

    // ==========================================================
    // PROGRESSO POR ETAPA (concluído / % de acerto / reset)
    // Vive no armazenamento local por usuário, via CL.api.
    // Para evitar leituras assíncronas espalhadas pela UI, tudo é
    // carregado uma vez no boot (ver bootIde) para este cache em
    // memória, e as escritas seguem "fire and forget" para CL.api.
    // ==========================================================
    let progressoEtapasCache = progressoCarregado || {};

    function chaveEtapa(moduloId, step) {
      return moduloId + ':' + step;
    }

    function getProgressoEtapa(moduloId, step) {
      return progressoEtapasCache[chaveEtapa(moduloId, step)] || { concluida: false, percentual: null };
    }

    function setProgressoEtapa(moduloId, step, parcial) {
      const chave = chaveEtapa(moduloId, step);
      const atual = progressoEtapasCache[chave] || { concluida: false, percentual: null };
      const novo = Object.assign({}, atual, parcial);
      progressoEtapasCache[chave] = novo;

      if (CL.api && typeof CL.api.saveProgress === 'function') {
        CL.api.saveProgress(chave, novo).catch(function () {
          // erro já foi mostrado num toast por CL.api._handleError
        });
      }
    }

    // Refaz/reseta uma etapa: apaga a marca de concluído, o percentual salvo
    // e o código salvo dela (users/{uid}/progress e /exercises), pra voltar
    // ao codigoInicial.
    function resetarProgressoEtapa(moduloId, step) {
      const chave = chaveEtapa(moduloId, step);
      if (moduloId === getModuloAtual().id && step === currentStep && typeof window.cancelarSalvamentoAutomaticoDaIde === 'function') {
        window.cancelarSalvamentoAutomaticoDaIde();
      }
      delete progressoEtapasCache[chave];
      delete exerciciosCache[chave];

      if (CL.api && typeof CL.api.deleteProgress === 'function') {
        CL.api.deleteProgress(chave).catch(function () {});
      }
      if (CL.api && typeof CL.api.deleteExercise === 'function') {
        CL.api.deleteExercise(chave).catch(function () {});
      }

      if (moduloId === getModuloAtual().id && step === currentStep) {
        window.dispatchEvent(new CustomEvent('etapa:mudou', { detail: window.getEtapaAtual() }));
      }
    }

    // Calcula o percentual de acerto de uma etapa, se ela definir uma função
    // `verificar(codigo)` (recebe {html, css, js} do editor e retorna 0-100).
    // Etapas sem essa função ficam com percentual "—" até serem configuradas.
    function calcularPercentualEtapa(etapa) {
      if (!etapa || typeof etapa.verificar !== 'function') return null;
      try {
        const codigo = (window.obterCodigoAtualDoEditor && window.obterCodigoAtualDoEditor()) || {};
        const resultado = etapa.verificar(codigo);
        if (typeof resultado !== 'number' || isNaN(resultado)) return null;
        return Math.max(0, Math.min(100, Math.round(resultado)));
      } catch (erro) {
        return null;
      }
    }

    // ---------- Trilha de etapas do módulo atual (novo) ----------
    // O ☰ agora abre uma trilha (níveis em caminho, estilo jogo),
    // um nível por Etapa do módulo em que o aluno está agora — não
    // mais uma lista de texto com todos os módulos. O motor visual
    // (CL.trilha) e os dados dos nós (CL.curso.buildEtapaNodes) são
    // compartilhados com a trilha de Módulos da Dashboard.
    // A preferência definida em Configurações é a fonte única para os dois
    // níveis de aprendizagem: módulos no dashboard e etapas na plataforma.
    // Não deixamos um parâmetro antigo da URL substituir essa escolha.
    const layoutAprendizagem = window.localStorage.getItem('cl-layout-aprendizagem') || 'mapa';
    let indiceLayoutAtual = layoutAprendizagem === 'indice' ? 'lista' : 'trilha';
    // A URL decide apenas se o índice deve iniciar aberto. O formato visual
    // continua obedecendo exclusivamente à preferência das Configurações.
    const indiceSolicitadoNaUrl = new URLSearchParams(window.location.search).get('indice');

    function escaparTextoIndice(valor) {
      return String(valor == null ? '' : valor)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderIndiceLinear(modulo, nodes) {
      indiceListaEl.classList.add('indice-lista--linear');
      indiceListaEl.innerHTML = '<ol class="indice-etapas-linear">' + nodes.map(function (node, indice) {
        var bloqueada = node.status === 'locked';
        var estado = node.status === 'completed' ? 'Concluída' : (node.status === 'current' ? 'Em andamento' : (bloqueada ? 'Bloqueada' : 'Disponível'));
        var titulo = escaparTextoIndice(CL.curso.tituloTextoPlano ? CL.curso.tituloTextoPlano(modulo.etapas[indice].titulo) : modulo.etapas[indice].titulo);
        var acao = bloqueada
          ? '<span class="indice-etapas-linear__titulo">' + titulo + '</span>'
          : '<button type="button" class="indice-etapas-linear__titulo" data-indice-etapa="' + (indice + 1) + '">' + titulo + '</button>';
        var refazer = node.status === 'completed'
          ? '<button type="button" class="indice-etapas-linear__refazer" data-indice-refazer="' + (indice + 1) + '">Refazer</button>'
          : '';
        return '<li class="indice-etapas-linear__item indice-etapas-linear__item--' + node.status + '">' +
          '<span class="indice-etapas-linear__icone" aria-hidden="true">' + (node.status === 'completed' ? '&#10003;' : (bloqueada ? '&#128274;' : '&#9675;')) + '</span>' +
          '<div>' + acao + '<small>' + estado + (node.percentual !== null && node.percentual !== undefined ? ' · ' + node.percentual + '%' : '') + '</small></div>' + refazer + '</li>';
      }).join('') + '</ol>';

      if (!indiceListaEl._indiceLinearBound) {
        indiceListaEl.addEventListener('click', function (evento) {
          var abrir = evento.target.closest('[data-indice-etapa]');
          if (abrir) {
            prepararTrocaDeEtapa();
            currentStep = parseInt(abrir.getAttribute('data-indice-etapa'), 10);
            updateStepsUI();
            fecharIndice();
            return;
          }
          var refazer = evento.target.closest('[data-indice-refazer]');
          if (!refazer) return;
          var numero = parseInt(refazer.getAttribute('data-indice-refazer'), 10);
          if (!numero || !window.confirm('Refazer esta etapa? O progresso e o código salvo dela serão apagados.')) return;
          resetarProgressoEtapa(getModuloAtual().id, numero);
          renderIndice();
        });
        indiceListaEl._indiceLinearBound = true;
      }
    }

    function renderIndice() {
      const modulo = getModuloAtual();
      const cursoId = cursoAtualId;

      /* Etapas e módulos compartilham a mesma identidade do curso: fundo
         ilustrado, pegadas e banner Code Path com a logo correspondente. */
      indiceListaEl.setAttribute('data-curso', cursoId);
      indicePanelEl.setAttribute('data-curso', cursoId);
      // O banner é um aprimoramento visual. A guarda evita interromper a
      // IDE caso o navegador ainda tenha uma versão anterior de trilha.js
      // em cache, que ainda não expõe atualizarTituloFixo.
      if (CL.trilha && typeof CL.trilha.atualizarTituloFixo === 'function') {
        CL.trilha.atualizarTituloFixo(indiceListaEl, {
          cursoId: cursoId,
          titleHost: indicePanelEl
        });
      }

      const nodes = CL.curso.buildEtapaNodes(modulo, progressoEtapasCache, currentStep);

      if (indiceLayoutAtual === 'lista') {
        // Esta classe é exclusiva do índice de módulos e reserva espaço
        // para um banner absoluto; nas etapas ela criaria um vão indevido.
        indiceListaEl.classList.remove('trilha-container--indice');
        renderIndiceLinear(modulo, nodes);
        return;
      }

      indiceListaEl.classList.remove('indice-lista--linear');
      indiceListaEl.classList.remove('trilha-container--indice');

      try {
        if (!CL.trilha || typeof CL.trilha.render !== 'function') {
          throw new Error('Motor visual da trilha indisponível.');
        }

        CL.trilha.render(indiceListaEl, {
          nodes: nodes,
          cursoId: cursoId,
          layout: 'etapas-responsivas',
          tipoTrilha: 'etapas',
          onSelect: function (nodeId) {
            const numero = parseInt(nodeId.split(':').pop(), 10);
            if (!numero) return;
            prepararTrocaDeEtapa();
            currentStep = numero;
            updateStepsUI();
            fecharIndice();
          },
          onReset: function (nodeId) {
            const numero = parseInt(nodeId.split(':').pop(), 10);
            if (!numero) return;
            const confirmado = window.confirm('Refazer esta etapa? O progresso e o código salvo dela serão apagados.');
            if (!confirmado) return;
            resetarProgressoEtapa(modulo.id, numero);
            renderIndice();
          }
        });
      } catch (erroTrilha) {
        // A navegação e o editor são mais importantes que o desenho do mapa.
        // Se o motor visual falhar, o índice continua utilizável em cards e
        // iniciarTeoria consegue terminar normalmente.
        console.error('[ide] falha ao desenhar a trilha das etapas; usando índice em cards:', erroTrilha);
        indiceLayoutAtual = 'lista';
        indiceListaEl.classList.remove('trilha-container--indice');
        renderIndiceLinear(modulo, nodes);
      }
    }

    function fecharIndice() {
      indicePanelEl.hidden = true;
      theoryContentEl.hidden = false;
      toggleIndiceBtn.classList.remove('is-active');
      toggleIndiceBtn.setAttribute('aria-expanded', 'false');
    }

    function abrirIndice() {
      renderIndice();
      indicePanelEl.hidden = false;
      /* Com a IDE recolhida, a Learn Platform passa a ocupar toda a tela.
         Nesse formato, o índice deve revelar as etapas imediatamente, sem
         abrir primeiro no espaço decorativo do topo. */
      if (plataforma && plataforma.classList.contains('ide-recolhido')) {
        requestAnimationFrame(function () {
          indicePanelEl.scrollTop = indicePanelEl.scrollHeight;
        });
      } else {
        indicePanelEl.scrollTop = 0;
      }
      theoryContentEl.hidden = true;
      toggleIndiceBtn.classList.add('is-active');
      toggleIndiceBtn.setAttribute('aria-expanded', 'true');
    }

    toggleIndiceBtn.addEventListener('click', function () {
      if (indicePanelEl.hidden) abrirIndice();
      else fecharIndice();
    });

    // Permite que outros scripts leiam a etapa atual sem depender da ordem
    // de carregamento dos <script>.
    window.getEtapaAtual = function () {
      return getEtapasDoModulo()[currentStep - 1];
    };

    const ABAS_DA_ETAPA = ['conteudo', 'questoes', 'exercicio', 'desafio'];
    let abaAtualDaEtapa = 'conteudo';
    const desbloqueioDasAbas = {};
    const ICONE_ABA_BLOQUEADA = '<svg class="step-tab-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 3a2 2 0 0 0-1 3.73V18h2v-1.27A2 2 0 0 0 12 13Z"/></svg>';

    function chaveDesbloqueioDaEtapa() {
      return getModuloAtual().id + ':' + currentStep;
    }

    function indiceMaximoDesbloqueado() {
      const progresso = getProgressoEtapa(getModuloAtual().id, currentStep);
      if (progresso.concluida) return ABAS_DA_ETAPA.length - 1;
      return desbloqueioDasAbas[chaveDesbloqueioDaEtapa()] || 0;
    }

    function liberarProximaAba() {
      const indiceAtual = ABAS_DA_ETAPA.indexOf(abaAtualDaEtapa);
      if (indiceAtual < 0 || indiceAtual >= ABAS_DA_ETAPA.length - 1) return;
      const chave = chaveDesbloqueioDaEtapa();
      desbloqueioDasAbas[chave] = Math.max(desbloqueioDasAbas[chave] || 0, indiceAtual + 1);
    }

    function renderBotaoAba(nome, rotulo) {
      return '<button type="button" class="step-tab" data-step-tab="' + nome + '" role="tab">' +
        '<span>' + rotulo + '</span>' + ICONE_ABA_BLOQUEADA +
      '</button>';
    }

    function desafioPadraoDaEtapa(etapa) {
      return '<p>Agora aplique o que estudou com mais autonomia. Revise o resultado no Preview antes de avançar.</p>' +
        '<div class="task-box"><strong>Desafio:</strong> ' + etapa.missao + '</div>';
    }

    function escaparHtml(valor) {
      return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (caractere) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[caractere];
      });
    }

    function renderSecaoQuestoes(etapa) {
      var questoes = Array.isArray(etapa.questoes) ? etapa.questoes : [];
      var questoesValidas = questoes.map(function (questao, indiceOriginal) {
        return { questao: questao, indiceOriginal: indiceOriginal };
      }).filter(function (item) {
        var questao = item.questao;
        return questao && Array.isArray(questao.opcoes) && questao.opcoes.length >= 2 &&
          Number.isInteger(questao.correta) && questao.correta >= 0 && questao.correta < questao.opcoes.length;
      });

      if (!questoesValidas.length) {
        return '<p class="step-questions-empty">Esta etapa não tem perguntas de revisão. Você pode seguir direto para o exercício.</p>';
      }

      return questoesValidas.map(function (item, indice) {
        var questao = item.questao;
        var enunciado = questao.perguntaHtml || escaparHtml(questao.pergunta);
        return '<article class="step-question" data-questao-indice="' + item.indiceOriginal + '">' +
          '<p class="step-question-enunciado"><span class="step-question-number">' + (indice + 1) + '</span>' + enunciado + '</p>' +
          '<div class="step-question-opcoes" role="radiogroup" aria-label="Opções da questão ' + (indice + 1) + '">' +
            questao.opcoes.map(function (opcao, indiceOpcao) {
              return '<button type="button" class="step-question-opcao" data-opcao-indice="' + indiceOpcao + '" role="radio" aria-checked="false">' + escaparHtml(opcao) + '</button>';
            }).join('') +
          '</div>' +
          '<p class="step-question-feedback" aria-live="polite" hidden></p>' +
        '</article>';
      }).join('');
    }

    function renderEtapas() {
      moduleTitleEl.textContent = getModuloAtual().nome;

      theoryContentEl.innerHTML = getEtapasDoModulo().map(function (etapa, i) {
        const numero = i + 1;
        const btnVoltar =
          '<button type="button" class="step-nav-btn step-nav-btn--back" data-step-action="back" title="Voltar" aria-label="Voltar">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' +
          '</button>';
        const btnAvancar =
          '<div class="step-nav-footer">' +
            '<button type="button" class="step-nav-btn step-nav-btn--next" data-step-action="next" title="Avançar" aria-label="Avançar">' +
              '<span></span>' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>' +
            '</button>' +
          '</div>';

        return (
          '<section class="step-card' + (i === 0 ? ' active' : '') + '" data-step="' + numero + '">' +
            '<div class="step-navigation">' + btnVoltar +
            '<div class="step-tabs-scroll-wrapper cl-scrollable-controls" data-scrollable-controls><button class="cl-scroll-hint-arrow cl-scroll-hint-arrow--left" data-scroll-direction="left" aria-label="Ver abas anteriores" type="button">‹</button><div class="step-tabs-viewport" data-scroll-viewport><div class="step-tabs" role="tablist" aria-label="Seções da etapa ' + numero + '">' +
              renderBotaoAba('conteudo', 'Conteúdo') +
              renderBotaoAba('questoes', 'Questões') +
              renderBotaoAba('exercicio', 'Exercício') +
              renderBotaoAba('desafio', 'Desafio') +
            '</div></div><button class="cl-scroll-hint-arrow cl-scroll-hint-arrow--right" data-scroll-direction="right" aria-label="Ver mais abas" type="button">›</button></div></div>' +
            '<div class="step-section" data-step-section="conteudo" role="tabpanel"><h3>' + etapa.titulo + '</h3>' + etapa.texto + '</div>' +
            '<div class="step-section" data-step-section="questoes" role="tabpanel" hidden><h3>Questões</h3>' + renderSecaoQuestoes(etapa) + '</div>' +
            '<div class="step-section" data-step-section="exercicio" role="tabpanel" hidden><h3>Exercício</h3><div class="task-box"><strong>Missão:</strong> ' + etapa.missao + '</div></div>' +
            '<div class="step-section" data-step-section="desafio" role="tabpanel" hidden><h3>Desafio</h3>' + (etapa.desafio || desafioPadraoDaEtapa(etapa)) + '</div>' +
            btnAvancar +
          '</section>'
        );
      }).join('');
      if (window.CLScrollableControls) window.CLScrollableControls.refresh(theoryContentEl);
    }

    function atualizarAbasDaEtapa() {
      const card = theoryContentEl.querySelector('.step-card.active');
      if (!card) return;
      const maximoDesbloqueado = indiceMaximoDesbloqueado();
      card.querySelectorAll('[data-step-tab]').forEach(function (tab) {
        const indice = ABAS_DA_ETAPA.indexOf(tab.getAttribute('data-step-tab'));
        const desbloqueada = indice <= maximoDesbloqueado;
        const ativa = desbloqueada && tab.getAttribute('data-step-tab') === abaAtualDaEtapa;
        tab.classList.toggle('is-active', ativa);
        tab.classList.toggle('is-locked', !desbloqueada);
        tab.disabled = !desbloqueada;
        tab.setAttribute('aria-selected', String(ativa));
        tab.setAttribute('aria-disabled', String(!desbloqueada));
        tab.tabIndex = ativa ? 0 : -1;
        tab.title = desbloqueada ? '' : 'Conclua “' + (ABAS_DA_ETAPA[indice - 1] || 'Conteúdo') + '” para liberar esta aba.';
      });
      card.querySelectorAll('[data-step-section]').forEach(function (section) {
        section.hidden = section.getAttribute('data-step-section') !== abaAtualDaEtapa;
      });
      const voltar = card.querySelector('[data-step-action="back"]');
      const avancar = card.querySelector('[data-step-action="next"]');
      const voltarTexto = abaAtualDaEtapa === 'desafio' ? 'Voltar para exercício' : (abaAtualDaEtapa === 'exercicio' ? 'Voltar para questões' : (abaAtualDaEtapa === 'questoes' ? 'Voltar para conteúdo' : (currentStep === 1 ? 'Voltar para a trilha de módulos' : 'Voltar para desafio anterior')));
      const avancarTexto = abaAtualDaEtapa === 'conteudo' ? 'Ir para questões' : (abaAtualDaEtapa === 'questoes' ? 'Ir para exercício' : (abaAtualDaEtapa === 'exercicio' ? 'Ir para desafio' : (currentStep === getTotalEtapas() ? 'Concluir módulo' : 'Próxima etapa')));
      voltar.title = voltarTexto; voltar.setAttribute('aria-label', voltarTexto);
      avancar.title = avancarTexto; avancar.setAttribute('aria-label', avancarTexto);
      avancar.querySelector('span').textContent = avancarTexto;
      theoryContentEl.scrollTop = 0;
    }

    function updateStepsUI() {
      document.querySelectorAll('.step-card').forEach(function (card) {
        card.classList.toggle('active', parseInt(card.dataset.step, 10) === currentStep);
      });

      atualizarAbasDaEtapa();

      const totalEtapas = getTotalEtapas();

      progressBar.style.width = (currentStep / totalEtapas) * 100 + '%';

      // A etapa visitada vira imediatamente a nova posição de retomada.
      // Isso escreve apenas o índice leve, nunca o código dos editores.
      salvarProgresso();

      // Se o índice estiver aberto, mantém o item ativo em sincronia com
      // avanços/retrocessos feitos pelos botões prev/next.
      if (!indicePanelEl.hidden) {
        renderIndice();
      }

      window.dispatchEvent(new CustomEvent('etapa:mudou', { detail: window.getEtapaAtual() }));

      window.dispatchEvent(new CustomEvent('ide:estado-alterado'));
    }

    // Volta pra Dashboard já na trilha de módulos da trilha atual
    // (html/css/js) — usada tanto na 1ª etapa (botão voltar) quanto na
    // última (botão avançar, depois de concluir).
    function irParaTrilhaDeModulos() {
      window.location.href = URL_DASHBOARD + '#course/' + cursoAtualId;
    }

    // Avança na etapa atual: marca ela como concluída e, se não for a
    // última do módulo, vai pra próxima; se for a última, volta pra
    // trilha de módulos (onde o próximo módulo, agora destravado, pode
    // ser escolhido).
    function avancarNaEtapa() {
      const indiceAba = ABAS_DA_ETAPA.indexOf(abaAtualDaEtapa);
      if (indiceAba < ABAS_DA_ETAPA.length - 1) {
        liberarProximaAba();
        abaAtualDaEtapa = ABAS_DA_ETAPA[indiceAba + 1];
        atualizarAbasDaEtapa();
        return;
      }
      const etapaConcluidaAgora = window.getEtapaAtual();
      const moduloIdAtual = getModuloAtual().id;
      const percentualCalculado = calcularPercentualEtapa(etapaConcluidaAgora);
      const dadosProgresso = { concluida: true };
      if (percentualCalculado !== null) dadosProgresso.percentual = percentualCalculado;
      setProgressoEtapa(moduloIdAtual, currentStep, dadosProgresso);

      if (currentStep < getTotalEtapas()) {
        prepararTrocaDeEtapa();
        currentStep++;
        abaAtualDaEtapa = 'conteudo';
        updateStepsUI();
        return;
      }

      // Última etapa do módulo. Se também for o último módulo da
      // trilha, um aviso extra de "trilha concluída" antes de voltar.
      if (currentModuleIndex === MODULOS.length - 1) {
        alert('Parabéns! Você concluiu toda a trilha de ' + CL.curso.CURSOS[cursoAtualId].nome + '.');
      }
      irParaTrilhaDeModulos();
    }

    // Volta na etapa atual: se não for a 1ª do módulo, volta pra etapa
    // anterior; se for a 1ª, volta pra trilha de módulos.
    function voltarNaEtapa() {
      const indiceAba = ABAS_DA_ETAPA.indexOf(abaAtualDaEtapa);
      if (indiceAba > 0) {
        abaAtualDaEtapa = ABAS_DA_ETAPA[indiceAba - 1];
        atualizarAbasDaEtapa();
        return;
      }
      if (currentStep > 1) {
        prepararTrocaDeEtapa();
        currentStep--;
        abaAtualDaEtapa = 'desafio';
        updateStepsUI();
        return;
      }
      irParaTrilhaDeModulos();
    }

    // Botões dentro de cada etapa (topo-esquerda "voltar" / rodapé-
    // direita "avançar", ver renderEtapas). Delegado no container, já
    // que os cards são recriados a cada troca de módulo.
    theoryContentEl.addEventListener('click', function (e) {
      const opcaoQuestao = e.target.closest('.step-question-opcao');
      if (opcaoQuestao && theoryContentEl.contains(opcaoQuestao)) {
        const blocoQuestao = opcaoQuestao.closest('[data-questao-indice]');
        const etapa = getEtapasDoModulo()[currentStep - 1];
        const questao = etapa && Array.isArray(etapa.questoes) && blocoQuestao
          ? etapa.questoes[Number(blocoQuestao.getAttribute('data-questao-indice'))]
          : null;
        const indiceEscolhido = Number(opcaoQuestao.getAttribute('data-opcao-indice'));
        if (!questao || !Number.isInteger(questao.correta) || opcaoQuestao.disabled) return;

        const acertou = indiceEscolhido === questao.correta;
        blocoQuestao.querySelectorAll('.step-question-opcao').forEach(function (opcao) {
          const indiceOpcao = Number(opcao.getAttribute('data-opcao-indice'));
          opcao.disabled = true;
          opcao.setAttribute('aria-checked', String(indiceOpcao === indiceEscolhido));
          if (indiceOpcao === questao.correta) opcao.classList.add('is-correta');
        });
        if (!acertou) opcaoQuestao.classList.add('is-incorreta');

        const feedback = blocoQuestao.querySelector('.step-question-feedback');
        if (feedback) {
          feedback.textContent = questao.explicacao || (acertou ? 'Resposta correta.' : 'Resposta incorreta. Observe a alternativa destacada.');
          feedback.classList.toggle('is-correto', acertou);
          feedback.classList.toggle('is-incorreto', !acertou);
          feedback.hidden = false;
        }
        return;
      }
      const aba = e.target.closest('[data-step-tab]');
      if (aba && !aba.disabled) {
        abaAtualDaEtapa = aba.getAttribute('data-step-tab');
        atualizarAbasDaEtapa();
        return;
      }
      const btnVoltarEtapa = e.target.closest('[data-step-action="back"]');
      if (btnVoltarEtapa) {
        voltarNaEtapa();
        return;
      }
      const btnAvancarEtapa = e.target.closest('[data-step-action="next"]');
      if (btnAvancarEtapa) {
        avancarNaEtapa();
      }
    });

    theoryContentEl.addEventListener('keydown', function (e) {
      const aba = e.target.closest('[data-step-tab]');
      if (!aba) return;
      const indiceAtual = ABAS_DA_ETAPA.indexOf(abaAtualDaEtapa);
      let proximoIndice = indiceAtual;
      if (e.key === 'ArrowRight') proximoIndice = Math.min(ABAS_DA_ETAPA.length - 1, indiceAtual + 1);
      else if (e.key === 'ArrowLeft') proximoIndice = Math.max(0, indiceAtual - 1);
      else if (e.key === 'Home') proximoIndice = 0;
      else if (e.key === 'End') proximoIndice = ABAS_DA_ETAPA.length - 1;
      else return;
      e.preventDefault();
      abaAtualDaEtapa = ABAS_DA_ETAPA[proximoIndice];
      atualizarAbasDaEtapa();
      const ativa = theoryContentEl.querySelector('.step-card.active [data-step-tab="' + abaAtualDaEtapa + '"]');
      if (ativa) ativa.focus();
    });

    // ==========================================================
    // SALVAMENTO LOCAL POR ETAPA
    // O índice pequeno guarda posição e progresso. Cada código fica em
    // uma chave própria no localStorage e é lido somente ao abrir a etapa.
    // ==========================================================

    // Preenchido no boot apenas com o índice das etapas que têm código.
    let exerciciosCache = exerciciosCarregado || {};

    // Grava só a posição atual (módulo + etapa) no perfil.
    function salvarProgresso() {
      if (!CL.auth || typeof CL.auth.updateUser !== 'function') return Promise.resolve(false);
      return CL.auth.updateUser({
        idePosition: { moduloId: getModuloAtual().id, etapa: currentStep }
      });
    }

    function obterTokenGoogleDrive(interativo) {
      return new Promise(function (resolve, reject) {
        if (!window.google || !google.accounts || !google.accounts.oauth2) return reject(new Error('O Google Drive ainda não está disponível.'));
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CL.config.googleDriveClientId,
          scope: 'https://www.googleapis.com/auth/drive.appdata',
          callback: function (response) {
            if (response.error) reject(new Error(response.error));
            else resolve(response.access_token);
          }
        });
        tokenClient.requestAccessToken({ prompt: interativo ? 'consent' : '' });
      });
    }

    async function enviarBackupGoogleDrive(data, interativo) {
      const settings = CL.api.getBackupSettings();
      const token = await obterTokenGoogleDrive(Boolean(interativo));
      const content = JSON.stringify(data, null, 2);
      const fileIdSalvo = settings.drivePrivateFileId;
      let response;
      if (fileIdSalvo) {
        response = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(fileIdSalvo) + '?uploadType=media', {
          method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: content
        });
      } else {
        const boundary = 'coding-loop-backup-' + Date.now();
        const metadata = { name: 'coding-loop-progresso.json', mimeType: 'application/json', parents: ['appDataFolder'] };
        const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + content + '\r\n--' + boundary + '--';
        response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary }, body: body
        });
      }
      if (!response.ok) throw new Error('Não foi possível salvar o backup no Google Drive.');
      const result = await response.json().catch(function () { return {}; });
      if (result.id) CL.api.saveBackupSettings({ drivePrivateFileId: result.id, lastBackupAt: new Date().toISOString() });
    }

    async function restaurarBackupGoogleDrive() {
      const settings = CL.api.getBackupSettings();
      const token = await obterTokenGoogleDrive(true);
      let fileId = settings.drivePrivateFileId;
      if (!fileId) {
        const list = await fetch("https://www.googleapis.com/drive/v3/files?q=name%3D'coding-loop-progresso.json'&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id)&spaces=appDataFolder", { headers: { Authorization: 'Bearer ' + token } });
        const files = await list.json();
        fileId = files.files && files.files[0] && files.files[0].id;
      }
      if (!fileId) throw new Error('Nenhum backup foi encontrado no Google Drive.');
      const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media', { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) throw new Error('Não foi possível ler o backup do Google Drive.');
      return CL.api.readStudyBackupResponse(response);
    }

    let clienteMicrosoft;
    async function obterTokenOneDrive(interativo) {
      if (!window.msal || !CL.config.microsoftOneDriveClientId) throw new Error('O login do OneDrive ainda não está disponível.');
      if (!clienteMicrosoft) {
        clienteMicrosoft = new msal.PublicClientApplication({
          auth: { clientId: CL.config.microsoftOneDriveClientId, authority: 'https://login.microsoftonline.com/common', redirectUri: window.location.origin },
          cache: { cacheLocation: 'sessionStorage' }
        });
        if (typeof clienteMicrosoft.initialize === 'function') await clienteMicrosoft.initialize();
      }
      const request = { scopes: ['User.Read', 'Files.ReadWrite.AppFolder'] };
      const account = clienteMicrosoft.getActiveAccount() || clienteMicrosoft.getAllAccounts()[0];
      if (account) {
        try {
          const result = await clienteMicrosoft.acquireTokenSilent(Object.assign({ account: account }, request));
          return result.accessToken;
        } catch (error) {
          if (!interativo) throw error;
        }
      }
      if (!interativo) throw new Error('A autorização do OneDrive precisa ser renovada.');
      const result = await clienteMicrosoft.acquireTokenPopup(request);
      clienteMicrosoft.setActiveAccount(result.account);
      return result.accessToken;
    }

    async function enviarBackupOneDrive(data, interativo) {
      const token = await obterTokenOneDrive(Boolean(interativo));
      const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/coding-loop-progresso.json:/content', {
        method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data, null, 2)
      });
      if (!response.ok) throw new Error('Não foi possível salvar o backup no OneDrive.');
      const file = await response.json();
      CL.api.saveBackupSettings({ oneDriveFileId: file.id, lastBackupAt: new Date().toISOString() });
    }

    async function restaurarBackupOneDrive() {
      const token = await obterTokenOneDrive(true);
      const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/coding-loop-progresso.json:/content', { headers: { Authorization: 'Bearer ' + token } });
      if (response.status === 404) throw new Error('Nenhum backup foi encontrado no OneDrive.');
      if (!response.ok) throw new Error('Não foi possível ler o backup do OneDrive.');
      return CL.api.readStudyBackupResponse(response);
    }

    function mensagemErroOneDrive(error) {
      const detalhe = error && (error.errorCode || error.error || error.message);
      if (detalhe === 'redirect_uri_mismatch') return 'A URL local não está autorizada no aplicativo Microsoft. Adicione http://localhost:5500 em Authentication → Single-page application (SPA).';
      if (detalhe === 'popup_window_error' || detalhe === 'popup_window_timeout') return 'O navegador bloqueou a janela de login do OneDrive. Permita pop-ups para este site e tente novamente.';
      return 'Não foi possível entrar na conta do OneDrive. Detalhe: ' + (detalhe || 'verifique as permissões e tente novamente.');
    }

    function fecharMenuBackup() {
      if (backupMenuOptions) backupMenuOptions.hidden = true;
      if (btnBackupMenu) btnBackupMenu.setAttribute('aria-expanded', 'false');
    }

    let sincronizacaoNuvemPendente = Boolean(CL.api.getBackupSettings().cloudSyncPending);
    let sincronizacaoNuvemEmAndamento = false;
    let temporizadorSincronizacaoNuvem = null;
    let avisoSaidaNuvemAtivo = false;
    const INTERVALOS_NUVEM = { '5m': 5 * 60 * 1000, '10m': 10 * 60 * 1000, '15m': 15 * 60 * 1000, daily: 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 };
    const RETENTATIVAS_NUVEM = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];

    function avisoSaidaNuvem(event) {
      event.preventDefault();
      event.returnValue = true;
    }

    // A File System Access API guarda a permissão da pasta no IndexedDB.
    // Assim, a cópia no aparelho continua automática sem abrir o seletor a
    // cada autosave. A permissão nunca é solicitada sem uma ação explícita.
    let pastaBackupAparelho = null;
    let temporizadorBackupAparelho = null;
    const ATRASO_BACKUP_APARELHO = 60 * 1000;

    function abrirBancoBackupAparelho() {
      return new Promise(function (resolve, reject) {
        if (!window.indexedDB) return reject(new Error('O navegador não oferece armazenamento para a pasta escolhida.'));
        const pedido = window.indexedDB.open('coding-loop-backup', 1);
        pedido.onupgradeneeded = function () { pedido.result.createObjectStore('pastas'); };
        pedido.onsuccess = function () { resolve(pedido.result); };
        pedido.onerror = function () { reject(pedido.error || new Error('Não foi possível acessar a pasta de backup.')); };
      });
    }

    function chavePastaBackupAparelho() {
      return 'aparelho:' + (CL.api && typeof CL.api._uid === 'function' ? CL.api._uid() : 'usuario');
    }

    async function salvarPastaBackupAparelho(pasta) {
      const banco = await abrirBancoBackupAparelho();
      return new Promise(function (resolve, reject) {
        const transacao = banco.transaction('pastas', 'readwrite');
        transacao.objectStore('pastas').put(pasta, chavePastaBackupAparelho());
        transacao.oncomplete = function () { banco.close(); resolve(); };
        transacao.onerror = function () { banco.close(); reject(transacao.error || new Error('Não foi possível guardar a pasta escolhida.')); };
      });
    }

    async function obterPastaBackupAparelho() {
      if (pastaBackupAparelho) return pastaBackupAparelho;
      const banco = await abrirBancoBackupAparelho();
      return new Promise(function (resolve, reject) {
        const transacao = banco.transaction('pastas', 'readonly');
        const pedido = transacao.objectStore('pastas').get(chavePastaBackupAparelho());
        pedido.onsuccess = function () { banco.close(); pastaBackupAparelho = pedido.result || null; resolve(pastaBackupAparelho); };
        pedido.onerror = function () { banco.close(); reject(pedido.error || new Error('Não foi possível localizar a pasta de backup.')); };
      });
    }

    async function pastaBackupTemPermissao(pasta, solicitar) {
      if (!pasta || typeof pasta.queryPermission !== 'function') return false;
      const opcoes = { mode: 'readwrite' };
      if (await pasta.queryPermission(opcoes) === 'granted') return true;
      return Boolean(solicitar && typeof pasta.requestPermission === 'function' && await pasta.requestPermission(opcoes) === 'granted');
    }

    async function salvarBackupNoAparelho() {
      const pasta = await obterPastaBackupAparelho();
      if (!pasta || !await pastaBackupTemPermissao(pasta, false)) throw new Error('Escolha a pasta novamente para permitir a cópia no aparelho.');
      const arquivo = await pasta.getFileHandle('coding-loop-progresso.json', { create: true });
      const gravacao = await arquivo.createWritable();
      try {
        await gravacao.write(JSON.stringify(CL.api.exportStudyData(), null, 2));
      } finally {
        await gravacao.close();
      }
      CL.api.saveBackupSettings({ lastDeviceBackupAt: new Date().toISOString(), deviceBackupError: false });
    }

    async function restaurarBackupDoAparelho() {
      const pasta = await obterPastaBackupAparelho();
      if (!pasta || !await pastaBackupTemPermissao(pasta, false)) throw new Error('Escolha novamente a pasta usada para este backup.');
      try {
        const arquivo = await pasta.getFileHandle('coding-loop-progresso.json');
        const file = await arquivo.getFile();
        if (file.size > CL.api.MAX_BACKUP_BYTES) throw new Error('Backup excede o limite de 8 MB.');
        return CL.api.parseStudyBackup(await file.text());
      } catch (error) {
        throw new Error('Nenhum backup foi encontrado na pasta escolhida.');
      }
    }

    function agendarBackupNoAparelho() {
      clearTimeout(temporizadorBackupAparelho);
      const settings = CL.api.getBackupSettings();
      if (!(settings.destinations || []).includes('device')) return;
      temporizadorBackupAparelho = setTimeout(function () {
        salvarBackupNoAparelho().then(atualizarStatusBackup).catch(function () {
          CL.api.saveBackupSettings({ deviceBackupError: true });
          atualizarStatusBackup();
        });
      }, ATRASO_BACKUP_APARELHO);
    }

    function atualizarAvisoSaidaNuvem() {
      if (sincronizacaoNuvemPendente && !avisoSaidaNuvemAtivo) {
        window.addEventListener('beforeunload', avisoSaidaNuvem);
        avisoSaidaNuvemAtivo = true;
      } else if (!sincronizacaoNuvemPendente && avisoSaidaNuvemAtivo) {
        window.removeEventListener('beforeunload', avisoSaidaNuvem);
        avisoSaidaNuvemAtivo = false;
      }
    }

    function agendarTentativaNuvem(atraso) {
      clearTimeout(temporizadorSincronizacaoNuvem);
      temporizadorSincronizacaoNuvem = setTimeout(function () { sincronizarNuvemAutomaticamente(false); }, atraso);
    }

    function agendarSincronizacaoNuvem() {
      const settings = CL.api.getBackupSettings();
      const destinos = settings.destinations || [];
      const nuvemAtiva = (destinos.includes('drive') && settings.googleDriveConnected) || (destinos.includes('onedrive') && settings.oneDriveConnected);
      if (!nuvemAtiva) return;
      sincronizacaoNuvemPendente = true;
      CL.api.saveBackupSettings({ cloudSyncPending: true, cloudSyncRetryAt: null });
      atualizarAvisoSaidaNuvem();
      atualizarStatusBackup();
      if (settings.cloudSyncSchedule === 'daily' || settings.cloudSyncSchedule === 'weekly') return;
      agendarTentativaNuvem(INTERVALOS_NUVEM[settings.cloudSyncSchedule] || INTERVALOS_NUVEM['5m']);
    }

    async function sincronizarNuvemAutomaticamente(forcar) {
      if (sincronizacaoNuvemEmAndamento || (!forcar && !sincronizacaoNuvemPendente)) return false;
      const settings = CL.api.getBackupSettings();
      const destinos = settings.destinations || [];
      const tarefas = [];
      const dados = CL.api.exportStudyData();
      if (destinos.includes('drive') && settings.googleDriveConnected) tarefas.push(enviarBackupGoogleDrive(dados, false));
      if (destinos.includes('onedrive') && settings.oneDriveConnected) tarefas.push(enviarBackupOneDrive(dados, false));
      if (!tarefas.length) {
        sincronizacaoNuvemPendente = false;
        CL.api.saveBackupSettings({ cloudSyncPending: false, cloudSyncRetryAt: null });
        atualizarAvisoSaidaNuvem();
        atualizarStatusBackup();
        return false;
      }
      sincronizacaoNuvemEmAndamento = true;
      const resultados = await Promise.allSettled(tarefas);
      sincronizacaoNuvemEmAndamento = false;
      if (resultados.every(function (resultado) { return resultado.status === 'fulfilled'; })) {
        sincronizacaoNuvemPendente = false;
        CL.api.saveBackupSettings({ cloudSyncPending: false, cloudSyncFailureCount: 0, cloudSyncRetryAt: null, lastCloudSyncAt: dados.exportedAt });
        atualizarAvisoSaidaNuvem();
        atualizarStatusBackup();
        return true;
      }
      sincronizacaoNuvemPendente = true;
      const tentativas = Math.min(Number(settings.cloudSyncFailureCount) || 0, RETENTATIVAS_NUVEM.length - 1);
      const atraso = RETENTATIVAS_NUVEM[tentativas];
      CL.api.saveBackupSettings({ cloudSyncPending: true, cloudSyncFailureCount: tentativas + 1, cloudSyncRetryAt: new Date(Date.now() + atraso).toISOString() });
      atualizarAvisoSaidaNuvem();
      atualizarStatusBackup();
      agendarTentativaNuvem(atraso);
      return false;
    }

    function iniciarSincronizacaoNuvem() {
      const settings = CL.api.getBackupSettings();
      const intervalo = INTERVALOS_NUVEM[settings.cloudSyncSchedule] || INTERVALOS_NUVEM['5m'];
      const ultimo = settings.lastCloudSyncAt ? new Date(settings.lastCloudSyncAt).getTime() : 0;
      const porAcesso = settings.cloudSyncSchedule === 'daily' || settings.cloudSyncSchedule === 'weekly';
      atualizarAvisoSaidaNuvem();
      if (sincronizacaoNuvemPendente) {
        if (CL.ui && typeof CL.ui.showToast === 'function') CL.ui.showToast('Seu progresso está salvo em localStorage. A sincronização com a nuvem será tentada agora.', 'info');
        sincronizarNuvemAutomaticamente(true);
      } else if (porAcesso && Date.now() - ultimo >= intervalo) {
        sincronizacaoNuvemPendente = true;
        CL.api.saveBackupSettings({ cloudSyncPending: true });
        sincronizarNuvemAutomaticamente(true);
      }
    }

    function atualizarStatusBackup() {
      if (!backupStatus) return;
      backupStatus.classList.remove('is-error');
      const settings = CL.api.getBackupSettings();
      if (!settings.lastBackupAt) {
        if (settings.lastBackupPrincipalSaved === false) {
          backupStatus.textContent = 'Não foi possível salvar o backup local: o armazenamento do navegador está cheio.';
          backupStatus.classList.add('is-error');
        } else backupStatus.textContent = 'Último backup: ainda não realizado.';
        return;
      }
      const locais = (settings.lastBackupDestinations || []).map(function (local) {
        return { local: 'LocalStorage', device: 'Aparelho', drive: 'Google Drive', onedrive: 'OneDrive' }[local] || local;
      });
      backupStatus.textContent = 'Último backup: ' + new Date(settings.lastBackupAt).toLocaleString('pt-BR') + (locais.length ? ' — ' + locais.join(', ') : '');
      if (settings.lastBackupPrincipalSaved === false) {
        backupStatus.textContent += ' — atenção: o backup local mais recente não pôde ser salvo.';
        backupStatus.classList.add('is-error');
      } else if (settings.lastBackupVersionsSaved === false) {
        backupStatus.textContent += ' — atenção: o histórico de versões locais não coube no armazenamento do navegador.';
        backupStatus.classList.add('is-error');
      }
      if (settings.cloudSyncPending) {
        const proxima = settings.cloudSyncRetryAt ? ' Nova tentativa: ' + new Date(settings.cloudSyncRetryAt).toLocaleString('pt-BR') + '.' : '';
        backupStatus.textContent += ' — sincronização com a nuvem pendente.' + proxima;
      } else if (settings.lastCloudSyncAt) {
        backupStatus.textContent += ' — nuvem sincronizada em ' + new Date(settings.lastCloudSyncAt).toLocaleString('pt-BR') + '.';
      }
      if ((settings.destinations || []).includes('device')) {
        backupStatus.textContent += settings.lastDeviceBackupAt
          ? ' — aparelho atualizado em ' + new Date(settings.lastDeviceBackupAt).toLocaleString('pt-BR') + '.'
          : ' — cópia no aparelho aguardando autorização da pasta.';
        if (settings.deviceBackupError) {
          backupStatus.textContent += ' Escolha novamente a pasta para retomar as cópias automáticas.';
          backupStatus.classList.add('is-error');
        }
      }
    }

    function atualizarBotaoDestino(botao, texto, conectado) {
      if (!botao) return;
      const rotulo = botao.querySelector('span');
      if (rotulo) rotulo.textContent = texto;
      botao.classList.toggle('is-connected', Boolean(conectado));
      botao.setAttribute('aria-pressed', String(Boolean(conectado)));
      if (conectado) {
        botao.classList.remove('is-sync-required');
      }
    }

    function definirDestinoDoBotao(botao, ativo) {
      const opcao = botao && botao.closest('.backup-option');
      const campo = opcao && opcao.querySelector('input[name="destinations"]');
      if (campo) campo.checked = Boolean(ativo);
    }

    function atualizarEstadoSincronizacao() {
      const settings = CL.api.getBackupSettings();
      [
        { botao: btnSyncGoogleDrive, conectado: settings.googleDriveConnected },
        { botao: btnSyncOneDrive, conectado: settings.oneDriveConnected }
      ].forEach(function (item) {
        if (!item.botao) return;
        const opcao = item.botao.closest('.backup-option');
        const campo = opcao && opcao.querySelector('input[name="destinations"]');
        const selecionado = Boolean(campo && campo.checked);
        item.botao.classList.toggle('is-sync-required', selecionado && !item.conectado);
        item.botao.classList.toggle('is-connected', selecionado && Boolean(item.conectado));
      });
      atualizarEstadoBotaoSalvarBackup();
    }

    function atualizarEstadoAparelho() {
      if (!btnSelectBackupFolder) return;
      const campo = btnSelectBackupFolder.closest('.backup-option').querySelector('input[name="destinations"]');
      const selecionado = Boolean(campo && campo.checked);
      const configurado = Boolean(pastaBackupAparelho);
      atualizarBotaoDestino(btnSelectBackupFolder, selecionado ? 'Desativar salvamento' : (configurado ? 'Ativar salvamento' : 'Escolher pasta'), selecionado && configurado);
      btnSelectBackupFolder.classList.toggle('is-location-required', selecionado && !configurado);
      atualizarEstadoBotaoSalvarBackup();
    }

    function configuracaoBackupEstaCompleta() {
      if (!backupSettingsForm) return false;
      const formData = new FormData(backupSettingsForm);
      const destinations = formData.getAll('destinations');
      if (!destinations.includes('local')) destinations.push('local');
      if (!destinations.length || !formData.get('cloudSyncSchedule')) return false;
      const settings = CL.api.getBackupSettings();
      if (destinations.includes('drive') && !settings.googleDriveConnected) return false;
      if (destinations.includes('onedrive') && !settings.oneDriveConnected) return false;
      if (destinations.includes('device') && !pastaBackupAparelho) return false;
      return true;
    }

    function atualizarEstadoBotaoSalvarBackup() {
      if (!btnSaveBackupSettings) return;
      const configuracaoCompleta = configuracaoBackupEstaCompleta();
      btnSaveBackupSettings.disabled = !configuracaoCompleta;
      btnSaveBackupSettings.setAttribute('aria-disabled', String(!configuracaoCompleta));
      btnSaveBackupSettings.title = configuracaoCompleta
        ? 'Salvar configurações'
        : 'Conclua os destinos e escolha a frequência de sincronização';
    }

    async function atualizarAcoesDestino() {
      const settings = CL.api.getBackupSettings();
      const campoGoogle = btnSyncGoogleDrive && btnSyncGoogleDrive.closest('.backup-option').querySelector('input[name="destinations"]');
      const campoOneDrive = btnSyncOneDrive && btnSyncOneDrive.closest('.backup-option').querySelector('input[name="destinations"]');
      const campoAparelho = btnSelectBackupFolder && btnSelectBackupFolder.closest('.backup-option').querySelector('input[name="destinations"]');
      if (campoGoogle) campoGoogle.checked = Boolean(settings.googleDriveConnected && (settings.destinations || []).includes('drive'));
      if (campoOneDrive) campoOneDrive.checked = Boolean(settings.oneDriveConnected && (settings.destinations || []).includes('onedrive'));
      try { pastaBackupAparelho = await obterPastaBackupAparelho(); } catch (error) { pastaBackupAparelho = null; }
      if (campoAparelho) campoAparelho.checked = Boolean(pastaBackupAparelho && (settings.destinations || []).includes('device'));
      atualizarBotaoDestino(btnSyncGoogleDrive, campoGoogle && campoGoogle.checked ? 'Desativar sincronização' : 'Ativar sincronização', campoGoogle && campoGoogle.checked);
      atualizarBotaoDestino(btnSyncOneDrive, campoOneDrive && campoOneDrive.checked ? 'Desativar sincronização' : 'Ativar sincronização', campoOneDrive && campoOneDrive.checked);
      atualizarEstadoSincronizacao();
      atualizarEstadoAparelho();
    }

    function confirmarPermissaoNuvem(servico) {
      const permissoes = {
        google: {
          nome: 'Google Drive',
          acesso: 'Criar, ler, atualizar e excluir o backup na área privada do Coding Loop no seu Google Drive.',
          limite: 'O arquivo não aparece no Google Drive e somente o Coding Loop pode restaurá-lo. Você pode revogar o acesso a qualquer momento.'
        },
        microsoft: {
          nome: 'Microsoft OneDrive',
          acesso: 'Criar, ler, atualizar e excluir o arquivo de backup na pasta exclusiva do aplicativo no seu OneDrive.',
          limite: 'Também solicitamos a identificação básica da conta Microsoft para concluir a conexão. Não solicitamos acesso aos outros arquivos do seu OneDrive, nem a contatos ou arquivos compartilhados.'
        }
      }[servico];
      if (!permissoes || !cloudPermissionDialog) return Promise.resolve(true);
      cloudPermissionService.textContent = permissoes.nome;
      cloudPermissionServiceCopy.textContent = permissoes.nome;
      cloudPermissionScope.textContent = permissoes.acesso;
      cloudPermissionLimits.textContent = permissoes.limite;
      return new Promise(function (resolve) {
        cloudPermissionDialog.addEventListener('close', function aoFechar() {
          cloudPermissionDialog.removeEventListener('close', aoFechar);
          resolve(cloudPermissionDialog.returnValue === 'continue');
        });
        cloudPermissionDialog.showModal();
      });
    }

    if (btnSyncGoogleDrive) btnSyncGoogleDrive.addEventListener('click', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      try {
        const opcao = btnSyncGoogleDrive.closest('.backup-option');
        const campo = opcao && opcao.querySelector('input[name="destinations"]');
        if (campo && campo.checked) {
          definirDestinoDoBotao(btnSyncGoogleDrive, false);
          CL.api.saveBackupSettings({ googleDriveConnected: false });
          atualizarBotaoDestino(btnSyncGoogleDrive, 'Ativar sincronização', false);
          atualizarEstadoSincronizacao();
          return;
        }
        if (!await confirmarPermissaoNuvem('google')) return;
        await obterTokenGoogleDrive(true);
        CL.api.saveBackupSettings({ googleDriveConnected: true });
        definirDestinoDoBotao(btnSyncGoogleDrive, true);
        atualizarBotaoDestino(btnSyncGoogleDrive, 'Desativar sincronização', true);
        atualizarEstadoSincronizacao();
      } catch (error) {
        window.alert('Não foi possível entrar na conta do Google Drive. Verifique as permissões e tente novamente.');
      }
    });

    if (btnSyncOneDrive) btnSyncOneDrive.addEventListener('click', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      try {
        const opcao = btnSyncOneDrive.closest('.backup-option');
        const campo = opcao && opcao.querySelector('input[name="destinations"]');
        if (campo && campo.checked) {
          definirDestinoDoBotao(btnSyncOneDrive, false);
          CL.api.saveBackupSettings({ oneDriveConnected: false });
          atualizarBotaoDestino(btnSyncOneDrive, 'Ativar sincronização', false);
          atualizarEstadoSincronizacao();
          return;
        }
        if (!await confirmarPermissaoNuvem('microsoft')) return;
        await obterTokenOneDrive(true);
        CL.api.saveBackupSettings({ oneDriveConnected: true });
        definirDestinoDoBotao(btnSyncOneDrive, true);
        atualizarBotaoDestino(btnSyncOneDrive, 'Desativar sincronização', true);
        atualizarEstadoSincronizacao();
      } catch (error) {
        window.alert(mensagemErroOneDrive(error));
      }
    });

    if (btnSelectBackupFolder) btnSelectBackupFolder.addEventListener('click', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      const campo = btnSelectBackupFolder.closest('.backup-option').querySelector('input[name="destinations"]');
      if (campo && campo.checked) {
        definirDestinoDoBotao(btnSelectBackupFolder, false);
        atualizarEstadoAparelho();
        return;
      }
      if (!window.showDirectoryPicker) {
        window.alert('A escolha de pasta é compatível com navegadores baseados em Chromium, como Chrome e Edge.');
        return;
      }
      try {
        const pastaEscolhida = await window.showDirectoryPicker({ id: 'coding-loop-backup', mode: 'readwrite', startIn: 'documents' });
        const pastaDestino = pastaEscolhida.name === 'Coding Loop Backups'
          ? pastaEscolhida
          : await pastaEscolhida.getDirectoryHandle('Coding Loop Backups', { create: true });
        if (!await pastaBackupTemPermissao(pastaDestino, true)) throw new Error('A permissão para gravar nesta pasta não foi concedida.');
        pastaBackupAparelho = pastaDestino;
        await salvarPastaBackupAparelho(pastaDestino);
        definirDestinoDoBotao(btnSelectBackupFolder, true);
        await salvarBackupNoAparelho();
        atualizarEstadoAparelho();
        atualizarStatusBackup();
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        window.alert(error.message || 'Não foi possível configurar a pasta de backup.');
      }
    });

    if (backupSettingsForm) {
      backupSettingsForm.querySelectorAll('.backup-option--with-action').forEach(function (opcao) {
        opcao.addEventListener('click', function (event) {
          if (!event.target.closest('.backup-destination-action')) event.preventDefault();
        });
      });
      backupSettingsForm.querySelectorAll('input[name="destinations"]').forEach(function (campo) {
        campo.addEventListener('change', function () {
          if (!campo.checked && (campo.value === 'drive' || campo.value === 'onedrive')) {
            const nome = campo.value === 'drive' ? 'Google Drive' : 'OneDrive';
            if (!window.confirm('Tem certeza que deseja desabilitar a sincronização com ' + nome + '? Os backups existentes não serão apagados.')) {
              campo.checked = true;
              return;
            }
          }
          atualizarEstadoSincronizacao();
          atualizarEstadoAparelho();
        });
      });
      backupSettingsForm.addEventListener('change', atualizarEstadoBotaoSalvarBackup);
    }

    function confirmarERestaurar(backup, origem, criarCopia, conflito) {
      if (!backup) return window.alert('Nenhum backup foi encontrado em ' + origem + '.');
      if (!CL.api.validateStudyData(backup)) return window.alert('Arquivo de progresso inválido. Seus dados não foram alterados.');
      if (conflito === 'newest') {
        const atual = CL.api._studyIndex && CL.api._studyIndex();
        const dataAtual = atual && atual.updatedAt ? new Date(atual.updatedAt).getTime() : 0;
        const dataBackup = backup.index && backup.index.updatedAt ? new Date(backup.index.updatedAt).getTime() : 0;
        if (dataAtual && dataBackup && dataAtual >= dataBackup) return window.alert('O progresso atual é o mais recente; nenhuma restauração foi feita.');
      }
      const dataBackup = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('pt-BR') : 'data não informada';
      if (!window.confirm('Restaurar o backup de ' + origem + ' (' + dataBackup + ') substituirá o progresso atual. Continuar?')) return;
      try {
        if (criarCopia) CL.api.saveLocalBackup();
        CL.api.importStudyData(backup);
      } catch (error) { window.alert(error.message); return; }
      window.location.reload();
    }

    function atualizarVersoesDeRestauracao() {
      const usarLocal = restoreBackupSource && restoreBackupSource.value === 'local';
      if (restoreBackupVersionRow) restoreBackupVersionRow.hidden = !usarLocal;
      if (!usarLocal || !restoreBackupVersion) return;
      const versoes = CL.api.getLocalBackupVersions ? CL.api.getLocalBackupVersions() : [];
      restoreBackupVersion.innerHTML = versoes.map(function (backup, indice) {
        const data = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('pt-BR') : 'sem data';
        return '<option value="' + indice + '">Versão ' + (indice + 1) + ' — ' + data + '</option>';
      }).join('') || '<option value="0">Nenhuma versão disponível</option>';
    }

    if (btnBackupMenu && backupMenuOptions) {
      btnBackupMenu.addEventListener('click', function () {
        const aberto = !backupMenuOptions.hidden;
        backupMenuOptions.hidden = aberto;
        btnBackupMenu.setAttribute('aria-expanded', String(!aberto));
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !backupMenuOptions.hidden) {
          fecharMenuBackup();
          btnBackupMenu.focus();
        }
      });
      document.addEventListener('click', function (event) {
        if (!event.target.closest('.backup-menu')) fecharMenuBackup();
      });
    }
    if (btnRestoreBackup) btnRestoreBackup.addEventListener('click', function () {
      const settings = CL.api.getBackupSettings();
      const destinations = settings.destinations || [];
      fecharMenuBackup();
      if (!destinations.length) return window.alert('Escolha ao menos um local de backup nas configurações.');
      const nomes = { local: 'LocalStorage', device: 'Aparelho (pasta escolhida)', drive: 'Google Drive (privado do app)', onedrive: 'OneDrive' };
      restoreBackupSource.innerHTML = destinations.map(function (destino) { return '<option value="' + destino + '">' + nomes[destino] + '</option>'; }).join('');
      atualizarVersoesDeRestauracao();
      restoreBackupDialog.showModal();
    });

    function mostrarErroConfiguracaoBackup(mensagem) {
      if (!backupStatus) return;
      backupStatus.textContent = mensagem;
      backupStatus.classList.add('is-error');
    }

    function validarConfiguracaoBackup() {
      const formData = new FormData(backupSettingsForm);
      const destinations = formData.getAll('destinations');
      if (!destinations.includes('local')) destinations.push('local');
      if (!destinations.length) {
        mostrarErroConfiguracaoBackup('Selecione pelo menos um destino de backup.');
        return false;
      }
      if (!formData.get('cloudSyncSchedule')) {
        mostrarErroConfiguracaoBackup('Selecione uma frequência de sincronização em nuvem.');
        return false;
      }
      const settings = CL.api.getBackupSettings();
      if (destinations.includes('drive') && !settings.googleDriveConnected) {
        mostrarErroConfiguracaoBackup('Conclua a sincronização com o Google Drive antes de salvar.');
        atualizarEstadoSincronizacao();
        return false;
      }
      if (destinations.includes('onedrive') && !settings.oneDriveConnected) {
        mostrarErroConfiguracaoBackup('Conclua a sincronização com o OneDrive antes de salvar.');
        atualizarEstadoSincronizacao();
        return false;
      }
      if (destinations.includes('device') && !pastaBackupAparelho) {
        mostrarErroConfiguracaoBackup('Escolha uma pasta no aparelho antes de salvar.');
        atualizarEstadoAparelho();
        return false;
      }
      backupStatus.classList.remove('is-error');
      return true;
    }

    if (btnBackupSettings && backupSettingsDialog) btnBackupSettings.addEventListener('click', async function () {
      fecharMenuBackup();
      const settings = CL.api.getBackupSettings();
      Object.keys(settings).forEach(function (key) {
        const field = backupSettingsForm.querySelector('[name="' + key + '"][value="' + settings[key] + '"]');
        if (field) field.checked = true;
      });
      // "retentionCount" é um <select>: <option> não tem propriedade
      // .checked (isso é só de radio/checkbox), então o loop acima nunca
      // restaurava o valor salvo — reabrir o painel e salvar de novo
      // silenciosamente resetava a retenção para "1". Corrigido aqui:
      const retentionField = backupSettingsForm.querySelector('select[name="retentionCount"]');
      if (retentionField) retentionField.value = String(settings.retentionCount || 1);
      backupSettingsForm.querySelectorAll('[name="destinations"]').forEach(function (field) {
        if (field.value === 'drive') field.checked = Boolean(settings.googleDriveConnected && settings.destinations.includes('drive'));
        else if (field.value === 'onedrive') field.checked = Boolean(settings.oneDriveConnected && settings.destinations.includes('onedrive'));
        else if (field.value === 'device') field.checked = Boolean(settings.destinations.includes('device'));
        else field.checked = false;
      });
      await atualizarAcoesDestino();
      atualizarEstadoBotaoSalvarBackup();
      atualizarStatusBackup();
      backupSettingsDialog.showModal();
    });

    if (backupSettingsForm) backupSettingsForm.addEventListener('submit', function (event) {
      const fecharSemSalvar = event.submitter && event.submitter.classList.contains('backup-dialog-close');
      if (fecharSemSalvar && !window.confirm('Tem certeza que deseja sair sem configurar o backup?')) {
        event.preventDefault();
        return;
      }
      const desejaSalvar = event.submitter && event.submitter.value === 'save';
      if (!desejaSalvar) return;
      event.preventDefault();
      if (!validarConfiguracaoBackup()) {
        return;
      }
      // Fecha explicitamente após validar. Isso evita depender do submit
      // nativo de <dialog>, que alguns navegadores tratavam de forma
      // inconsistente e fazia o botão Salvar parecer inoperante.
      if (backupSettingsDialog && backupSettingsDialog.open) {
        backupSettingsDialog.close('save');
      } else {
        event.preventDefault();
      }
    });

    if (backupSettingsDialog) backupSettingsDialog.addEventListener('close', function () {
      if (backupSettingsDialog.returnValue !== 'save') return;
      const formData = new FormData(backupSettingsForm);
      const destinations = formData.getAll('destinations');
      if (!destinations.includes('local')) destinations.push('local');
      CL.api.saveBackupSettings({ destinations: destinations, cloudSyncSchedule: formData.get('cloudSyncSchedule'), retentionCount: Number(formData.get('retentionCount')) || 1, configurationCompleted: true });
      if (sincronizacaoNuvemPendente) agendarSincronizacaoNuvem();
      atualizarStatusBackup();
    });

    function chaveAvisoBackup() {
      const uid = CL.state && CL.state.user && CL.state.user.uid ? CL.state.user.uid : 'usuario';
      return 'backupReminderDismissed:' + uid;
    }

    function abrirAvisoBackupSeNecessario() {
      if (!backupReminderDialog || typeof backupReminderDialog.showModal !== 'function') return;
      // Quem já concluiu a configuração de backup não precisa mais do lembrete.
      if (CL.api.getBackupSettings().configurationCompleted) return;
      const dispensado = CL.storage && typeof CL.storage.get === 'function'
        ? CL.storage.get(chaveAvisoBackup(), false)
        : false;
      if (!dispensado && !backupReminderDialog.open) backupReminderDialog.showModal();
    }

    if (backupReminderDialog) {
      backupReminderDialog.addEventListener('close', function () {
        if (backupReminderDismiss && backupReminderDismiss.checked && CL.storage && typeof CL.storage.set === 'function') {
          CL.storage.set(chaveAvisoBackup(), true);
        }
      });
    }

    if (btnReminderConfigureBackup) {
      btnReminderConfigureBackup.addEventListener('click', function () {
        if (backupReminderDialog && backupReminderDialog.open) backupReminderDialog.close('configure');
        setTimeout(function () {
          if (btnBackupSettings) btnBackupSettings.click();
        }, 0);
      });
    }

    let criarCopiaAntesRestaurar = true;
    if (restoreBackupDialog) restoreBackupDialog.addEventListener('close', function () {
      if (restoreBackupDialog.returnValue !== 'restore') return;
      const origem = restoreBackupSource.value;
      criarCopiaAntesRestaurar = restoreBackupForm.elements.backupBeforeRestore.checked;
      const conflito = restoreBackupForm.elements.conflict.value;
      if (origem === 'local') {
        const versoes = CL.api.getLocalBackupVersions ? CL.api.getLocalBackupVersions() : [];
        return confirmarERestaurar(versoes[Number(restoreBackupVersion.value)] || CL.api.getLocalBackup(), 'LocalStorage', criarCopiaAntesRestaurar, conflito);
      }
      const leitura = origem === 'device' ? restaurarBackupDoAparelho() : (origem === 'drive' ? restaurarBackupGoogleDrive() : restaurarBackupOneDrive());
      const nome = origem === 'device' ? 'Aparelho' : (origem === 'drive' ? 'Google Drive' : 'OneDrive');
      leitura.then(function (backup) { confirmarERestaurar(backup, nome, criarCopiaAntesRestaurar, conflito); }).catch(function (error) { window.alert(error.message); });
    });
    if (restoreBackupSource) restoreBackupSource.addEventListener('change', atualizarVersoesDeRestauracao);
    window.addEventListener('pagehide', function () {
      CL.api.saveLocalBackup();
      if ((CL.api.getBackupSettings().destinations || []).includes('device')) salvarBackupNoAparelho().catch(function () {});
      if (sincronizacaoNuvemPendente) CL.api.saveBackupSettings({ cloudSyncPending: true });
    });

    window.salvarCodigoDoAluno = function (codigo) {
      const chave = chaveEtapa(getModuloAtual().id, currentStep);
      exerciciosCache[chave] = codigo;

      if (!CL.api || typeof CL.api.saveExercise !== 'function') {
        return Promise.resolve(false);
      }
      return CL.api.saveExercise(chave, codigo);
    };

    window.getCodigoInicialParaEditor = function () {
      const chave = chaveEtapa(getModuloAtual().id, currentStep);
      const salvo = exerciciosCache[chave];

      if (salvo && (salvo.html || salvo.css || salvo.js || (Array.isArray(salvo.files) && salvo.files.length))) {
        return salvo;
      }

      const salvoLocal = CL.api && typeof CL.api.getExerciseLocal === 'function'
        ? CL.api.getExerciseLocal(chave)
        : null;
      if (salvoLocal && (salvoLocal.html || salvoLocal.css || salvoLocal.js || (Array.isArray(salvoLocal.files) && salvoLocal.files.length))) {
        exerciciosCache[chave] = salvoLocal;
        return salvoLocal;
      }

      const etapa = window.getEtapaAtual();
      return (etapa && etapa.codigoInicial) || {};
    };

    // Recebe a posição salva no perfil (carregada no boot) e reposiciona
    // o aluno no módulo/etapa em que ele parou da última vez.
    function restaurarProgressoSalvo(posicaoSalva) {
      if (!posicaoSalva) return;

      const indiceModulo = MODULOS.findIndex(function (modulo) {
        return modulo.id === posicaoSalva.moduloId;
      });
      if (indiceModulo === -1) return;

      currentModuleIndex = indiceModulo;

      const total = getTotalEtapas();
      if (typeof posicaoSalva.etapa === 'number' && posicaoSalva.etapa >= 1 && posicaoSalva.etapa <= total) {
        currentStep = posicaoSalva.etapa;
      }
    }

    // Chegou aqui a partir de um nível da trilha da Dashboard
    // (ide.html?modulo=...&etapa=2)? Abre diretamente no módulo e,
    // quando fornecida, na etapa solicitada pelo índice do curso.
    function aplicarModuloDaUrl() {
      const parametrosUrl = new URLSearchParams(window.location.search);
      const moduloAlvo = parametrosUrl.get('modulo');
      if (!moduloAlvo) return;

      const indiceModulo = MODULOS.findIndex(function (modulo) {
        return modulo.id === moduloAlvo;
      });
      if (indiceModulo === -1) return;

      currentModuleIndex = indiceModulo;

      const etapaAlvo = parseInt(parametrosUrl.get('etapa'), 10);
      const totalEtapas = getTotalEtapas();
      currentStep = etapaAlvo >= 1 && etapaAlvo <= totalEtapas ? etapaAlvo : 1;
    }

    restaurarProgressoSalvo(posicaoCarregada);
    aplicarModuloDaUrl();
    renderEtapas();
    updateStepsUI();
    if (indiceSolicitadoNaUrl === 'trilha' || indiceSolicitadoNaUrl === 'lista') {
      abrirIndice();
    }
    iniciarSincronizacaoNuvem();
    setTimeout(abrirAvisoBackupSeNecessario, 350);
  } // fim de iniciarTeoria
  // Chamada pelo bootIde() depois que os dados locais estiverem prontos e
  // algum carregador do Monaco estiver disponível.
  var MONACO_CDN_BASES = [
    'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/',
    'https://unpkg.com/monaco-editor@0.52.0/min/'
  ];

  function carregarScriptExterno(src, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var encerrado = false;
      var timer = window.setTimeout(function () {
        if (encerrado) return;
        encerrado = true;
        script.remove();
        reject(new Error('Tempo esgotado ao carregar ' + src));
      }, timeoutMs || 10000);

      script.src = src;
      script.async = true;
      script.onload = function () {
        if (encerrado) return;
        encerrado = true;
        window.clearTimeout(timer);
        resolve(true);
      };
      script.onerror = function () {
        if (encerrado) return;
        encerrado = true;
        window.clearTimeout(timer);
        script.remove();
        reject(new Error('Falha ao carregar ' + src));
      };
      document.head.appendChild(script);
    });
  }

  async function garantirCarregadorMonaco() {
    if (window.require && typeof window.require.config === 'function') return true;
    for (var indiceCdn = 0; indiceCdn < MONACO_CDN_BASES.length; indiceCdn += 1) {
      try {
        await carregarScriptExterno(MONACO_CDN_BASES[indiceCdn] + 'vs/loader.js', 10000);
        if (window.require && typeof window.require.config === 'function') return true;
      } catch (erroCdn) {
        if (CL.config && CL.config.debug) console.warn('[ide] CDN do Monaco indisponível:', erroCdn);
      }
    }
    return false;
  }

  function mostrarFalhaDoEditor() {
    var mensagem = 'O editor não pôde ser carregado. Verifique a conexão e recarregue a página.';
    if (CL.ui && typeof CL.ui.showToast === 'function') CL.ui.showToast(mensagem, 'error', 12000);
    var container = document.getElementById('main-window-container');
    if (container) {
      container.setAttribute('data-editor-error', 'true');
      container.setAttribute('aria-label', mensagem);
    }
  }

  function iniciarEditorDeCodigo() {
      if (!window.require || typeof window.require.config !== 'function') {
        mostrarFalhaDoEditor();
        return;
      }
      var indiceBaseMonaco = 0;

      function carregarModulosMonaco() {
        var baseMonaco = MONACO_CDN_BASES[indiceBaseMonaco];
        window.MonacoEnvironment = {
          getWorkerUrl: function () {
            var codigoWorker = "self.MonacoEnvironment={baseUrl:'" + baseMonaco + "'};importScripts('" + baseMonaco + "vs/base/worker/workerMain.js');";
            return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(codigoWorker);
          }
        };
        window.require.config({ paths: { vs: baseMonaco + 'vs' } });
        window.require(['vs/editor/editor.main'], iniciar, function (erroMonaco) {
          indiceBaseMonaco += 1;
          if (indiceBaseMonaco < MONACO_CDN_BASES.length) {
            carregarModulosMonaco();
            return;
          }
          if (CL.config && CL.config.debug) console.error('[ide] Monaco indisponível em todas as CDNs:', erroMonaco);
          mostrarFalhaDoEditor();
        });
      }

      carregarModulosMonaco();

      function iniciar() {
        var htmlEditor, cssEditor, jsEditor, debounceTimeout, itemArrastado = null;

        var mainWindowContainer = document.getElementById('main-window-container');
        var contentWrapper = document.getElementById('window-content-wrapper');
        var editorsContainer = document.getElementById('editors-container');
        var previewContainer = document.getElementById('preview-container');
        var btnPreviewLayout = document.getElementById('btn-preview-layout');
        var btnPreviewMaximize = document.getElementById('btn-preview-maximize');
        var btnPreviewTheme = document.getElementById('btn-preview-theme');
        var iconPreviewMax = document.getElementById('icon-preview-max');
        var iconPreviewRestore = document.getElementById('icon-preview-restore');
        var iconPreviewThemeLight = document.getElementById('icon-preview-theme-light');
        var iconPreviewThemeDark = document.getElementById('icon-preview-theme-dark');
        var previewSplitResizer = document.getElementById('preview-split-resizer');
        var btnRun = document.getElementById('btn-run');
        var btnUndo = document.getElementById('btn-undo');
        var btnRedo = document.getElementById('btn-redo');
        var btnImportFile = document.getElementById('btn-import-file');
        var btnExportFile = document.getElementById('btn-export-file');
        var exportCodeDialog = document.getElementById('export-code-dialog');
        var exportTypesDialog = document.getElementById('export-types-dialog');
        var exportCodeTitle = document.getElementById('export-code-title');
        var exportInternalTitle = document.getElementById('export-internal-title');
        var exportInternalDescription = document.getElementById('export-internal-description');
        var exportExternalTitle = document.getElementById('export-external-title');
        var exportExternalDescription = document.getElementById('export-external-description');
        var btnNewFile = document.getElementById('btn-new-file');
        var newFileMenu = document.getElementById('new-file-menu');
        var saveProgressDot = document.getElementById('save-progress-dot');
        var saveToastEl = document.getElementById('save-toast');
        var inputImportFile = document.getElementById('input-import-file');
        var arquivoDeExportacaoPendente = null;
        var btnIdeCollapse = document.getElementById('btn-ide-collapse');
        var btnMaximizeToggle = document.getElementById('btn-maximize-toggle');
        var iconMaximize = document.getElementById('icon-maximize');
        var iconMinimize = document.getElementById('icon-minimize');
        var chkToggleHtml = document.getElementById('chk-toggle-html');
        var chkToggleCss = document.getElementById('chk-toggle-css');
        var chkToggleJs = document.getElementById('chk-toggle-js');
        var chkTogglePreview = document.getElementById('chk-toggle-preview');
        var dragContainer = document.getElementById('tabs-draggable-container');
        var tabsScrollWrapper = document.getElementById('tabs-scroll-wrapper');
        var tabsScrollViewport = tabsScrollWrapper && tabsScrollWrapper.querySelector('[data-scroll-viewport]');

        /* A barra da IDE usa o próprio viewport: as setas não dependem de
           propagação de evento nem do botão Live, que fica fora da área
           rolável. */
        if (tabsScrollWrapper && tabsScrollViewport) {
          tabsScrollWrapper.querySelectorAll('[data-scroll-direction]').forEach(function (botao) {
            botao.addEventListener('click', function (evento) {
              evento.preventDefault();
              evento.stopPropagation();
              var direcao = botao.getAttribute('data-scroll-direction') === 'left' ? -1 : 1;
              var limite = Math.max(0, tabsScrollViewport.scrollWidth - tabsScrollViewport.clientWidth);
              var distancia = Math.max(120, Math.floor(tabsScrollViewport.clientWidth * .72));
              tabsScrollViewport.scrollTo({
                left: Math.max(0, Math.min(limite, tabsScrollViewport.scrollLeft + (direcao * distancia))),
                behavior: 'smooth'
              });
              requestAnimationFrame(atualizarIndicadoresRolagem);
            });
          });
          tabsScrollViewport.addEventListener('scroll', atualizarIndicadoresRolagem, { passive: true });
          if (window.ResizeObserver) {
            new ResizeObserver(atualizarIndicadoresRolagem).observe(tabsScrollViewport);
          }
          requestAnimationFrame(atualizarIndicadoresRolagem);
        }

        var paiOriginal = mainWindowContainer.parentNode;
        var irmaoOriginal = mainWindowContainer.nextSibling;
        var learningPlatformRoot = document.querySelector('.learning-platform-root');
        var IDE_ABERTO = true;

        var prefPreviewVertical = true;
        var prefPreviewMaximized = false;
        var previewTemaEscuro = false;

        function obterPaineisVisiveis() {
          return Array.prototype.slice.call(editorsContainer.querySelectorAll('.tab-pane.show-pane'));
        }

        function limparTamanhosDosPaineis() {
          [editorsContainer, previewContainer].concat(obterPaineisVisiveis()).forEach(function (painel) {
            painel.style.flex = '';
          });
        }

        function configurarRedimensionadores() {
          var paineis = obterPaineisVisiveis();
          var modoLateral = contentWrapper.classList.contains('preview-vertical') &&
            previewContainer.classList.contains('show-preview');
          var comPreview = previewContainer.classList.contains('show-preview');
          var divisores = Array.prototype.slice.call(editorsContainer.querySelectorAll('.editor-split-resizer'));

          divisores.forEach(function (divisor) {
            divisor.classList.remove('is-visible');
            divisor.removeAttribute('data-before');
            divisor.removeAttribute('data-after');
            divisor.tabIndex = -1;
          });

          if (previewSplitResizer) {
            var mostrarDivisorPreview = comPreview && !modoLateral && !prefPreviewMaximized;
            previewSplitResizer.classList.toggle('is-visible', mostrarDivisorPreview);
            previewSplitResizer.tabIndex = mostrarDivisorPreview ? 0 : -1;
            previewSplitResizer.setAttribute('data-before', 'editors-container');
            previewSplitResizer.setAttribute('data-after', 'preview-container');
          }

          if (prefPreviewMaximized) return;
          paineis.forEach(function (painel, indice) {
            var divisor = divisores[indice];
            if (!divisor) {
              divisor = document.createElement('div');
              divisor.className = 'editor-split-resizer';
              divisor.setAttribute('aria-label', 'Redimensionar painéis');
              divisor.setAttribute('aria-orientation', 'vertical');
              divisor.setAttribute('aria-valuemin', '0');
              divisor.setAttribute('aria-valuemax', '100');
              divisor.setAttribute('aria-valuenow', '50');
              divisor.setAttribute('role', 'separator');
              divisor.tabIndex = -1;
              divisor.addEventListener('pointerdown', function (evento) {
                var paineisDoDivisor = elementosDoDivisor(divisor);
                iniciarRedimensionamento(divisor, paineisDoDivisor.antes, paineisDoDivisor.depois, 'x', evento);
              });
              divisor.addEventListener('keydown', function (evento) { controlarDivisorPeloTeclado(divisor, evento); });
              divisor.addEventListener('dblclick', function () { restaurarDivisor(divisor); });
              editorsContainer.appendChild(divisor);
              divisores.push(divisor);
            }
            var proximoPainel = paineis[indice + 1] || (modoLateral && comPreview ? previewContainer : null);
            if (!proximoPainel) return;
            painel.after(divisor);
            divisor.setAttribute('data-before', painel.id);
            divisor.setAttribute('data-after', proximoPainel.id);
            divisor.setAttribute('aria-label', 'Redimensionar ' + nomeDoPainel(painel) + ' e ' + nomeDoPainel(proximoPainel));
            divisor.setAttribute('aria-valuenow', '50');
            divisor.tabIndex = 0;
            divisor.classList.add('is-visible');
          });
        }

        function nomeDoPainel(painel) {
          var nomes = {
            'html-pane': 'HTML',
            'css-pane': 'CSS',
            'js-pane': 'JavaScript',
            'preview-container': 'Preview',
            'editors-container': 'editores'
          };
          return nomes[painel && painel.id] || 'painéis';
        }

        function elementosDoDivisor(divisor) {
          return {
            antes: document.getElementById(divisor.getAttribute('data-before')),
            depois: document.getElementById(divisor.getAttribute('data-after'))
          };
        }

        function aplicarTamanhoAoPar(divisor, antes, depois, eixo, novoAntes) {
          if (!antes || !depois) return;
          var tamanhoAntes = eixo === 'x' ? antes.getBoundingClientRect().width : antes.getBoundingClientRect().height;
          var tamanhoDepois = eixo === 'x' ? depois.getBoundingClientRect().width : depois.getBoundingClientRect().height;
          var total = tamanhoAntes + tamanhoDepois;
          var minimo = Math.min(140, total * 0.42);
          var tamanhoLimitado = Math.max(minimo, Math.min(novoAntes, total - minimo));
          var novoDepois = total - tamanhoLimitado;
          antes.style.flex = '0 0 ' + tamanhoLimitado + 'px';
          depois.style.flex = '0 0 ' + novoDepois + 'px';
          divisor.setAttribute('aria-valuenow', String(Math.round((tamanhoLimitado / total) * 100)));
          redimensionarEditores();
        }

        function iniciarRedimensionamento(divisor, antes, depois, eixo, evento) {
          if (!antes || !depois) return;
          var inicio = eixo === 'x' ? evento.clientX : evento.clientY;
          var tamanhoAntes = eixo === 'x' ? antes.getBoundingClientRect().width : antes.getBoundingClientRect().height;
          divisor.classList.add('is-dragging');
          document.body.style.userSelect = 'none';
          document.body.style.cursor = eixo === 'x' ? 'col-resize' : 'row-resize';
          if (divisor.setPointerCapture) divisor.setPointerCapture(evento.pointerId);

          function mover(e) {
            var delta = (eixo === 'x' ? e.clientX : e.clientY) - inicio;
            aplicarTamanhoAoPar(divisor, antes, depois, eixo, tamanhoAntes + delta);
          }

          function finalizar() {
            divisor.classList.remove('is-dragging');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            window.removeEventListener('pointermove', mover);
            window.removeEventListener('pointerup', finalizar);
            window.removeEventListener('pointercancel', finalizar);
          }

          window.addEventListener('pointermove', mover);
          window.addEventListener('pointerup', finalizar);
          window.addEventListener('pointercancel', finalizar);
          evento.preventDefault();
        }

        function eixoDoDivisor(divisor) {
          return divisor.getAttribute('aria-orientation') === 'horizontal' ? 'y' : 'x';
        }

        function controlarDivisorPeloTeclado(divisor, evento) {
          var paineis = elementosDoDivisor(divisor);
          if (!paineis.antes || !paineis.depois) return;
          var eixo = eixoDoDivisor(divisor);
          var tamanhoAtual = eixo === 'x' ? paineis.antes.getBoundingClientRect().width : paineis.antes.getBoundingClientRect().height;
          var passo = evento.shiftKey ? 64 : 24;
          var delta = 0;
          if ((eixo === 'x' && evento.key === 'ArrowLeft') || (eixo === 'y' && evento.key === 'ArrowUp')) delta = -passo;
          if ((eixo === 'x' && evento.key === 'ArrowRight') || (eixo === 'y' && evento.key === 'ArrowDown')) delta = passo;
          if (evento.key === 'Home') aplicarTamanhoAoPar(divisor, paineis.antes, paineis.depois, eixo, 0);
          else if (evento.key === 'End') aplicarTamanhoAoPar(divisor, paineis.antes, paineis.depois, eixo, Number.MAX_SAFE_INTEGER);
          else if (delta) aplicarTamanhoAoPar(divisor, paineis.antes, paineis.depois, eixo, tamanhoAtual + delta);
          else return;
          evento.preventDefault();
        }

        function restaurarDivisor(divisor) {
          var paineis = elementosDoDivisor(divisor);
          if (!paineis.antes || !paineis.depois) return;
          var eixo = eixoDoDivisor(divisor);
          var total = eixo === 'x'
            ? paineis.antes.getBoundingClientRect().width + paineis.depois.getBoundingClientRect().width
            : paineis.antes.getBoundingClientRect().height + paineis.depois.getBoundingClientRect().height;
          aplicarTamanhoAoPar(divisor, paineis.antes, paineis.depois, eixo, total / 2);
        }

        Array.prototype.slice.call(editorsContainer.querySelectorAll('.editor-split-resizer')).forEach(function (divisor) {
          divisor.addEventListener('pointerdown', function (evento) {
            var paineis = elementosDoDivisor(divisor);
            iniciarRedimensionamento(divisor, paineis.antes, paineis.depois, 'x', evento);
          });
          divisor.addEventListener('keydown', function (evento) { controlarDivisorPeloTeclado(divisor, evento); });
          divisor.addEventListener('dblclick', function () { restaurarDivisor(divisor); });
        });

        if (previewSplitResizer) {
          previewSplitResizer.addEventListener('pointerdown', function (evento) {
            var paineis = elementosDoDivisor(previewSplitResizer);
            iniciarRedimensionamento(previewSplitResizer, paineis.antes, paineis.depois, 'y', evento);
          });
          previewSplitResizer.addEventListener('keydown', function (evento) { controlarDivisorPeloTeclado(previewSplitResizer, evento); });
          previewSplitResizer.addEventListener('dblclick', function () { restaurarDivisor(previewSplitResizer); });
        }

        function atualizarAlturaReal() {
          var altura = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
          document.documentElement.style.setProperty('--ide-vh', altura + 'px');
        }

        monaco.editor.defineTheme('coding-loop-solarized-dark', {
          base: 'vs-dark', inherit: true, rules: [],
          colors: {
            'editor.background': '#002b36',
            'editor.foreground': '#fdf6e3',
            'editorLineNumber.foreground': '#586e75',
            'editorError.foreground': '#ff4d5e',
            'editorError.border': '#ff4d5e',
            'editorWarning.foreground': '#ffc247',
            'editorWarning.border': '#ffc247',
            'editorInfo.foreground': '#4fc3ff',
            'editorInfo.border': '#4fc3ff',
            'editorHint.foreground': '#c59cff',
            'editorHint.border': '#c59cff',
            'editorOverviewRuler.errorForeground': '#ff4d5ecc',
            'editorOverviewRuler.warningForeground': '#ffc247cc',
            'editorOverviewRuler.infoForeground': '#4fc3ffcc'
          }
        });
        monaco.editor.defineTheme('coding-loop-solarized-light', {
          base: 'vs', inherit: true, rules: [],
          colors: {
            'editor.background': '#fdf6e3',
            'editor.foreground': '#002b36',
            'editorLineNumber.foreground': '#657b83',
            'editorError.foreground': '#d7193f',
            'editorError.border': '#d7193f',
            'editorWarning.foreground': '#a86500',
            'editorWarning.border': '#a86500',
            'editorInfo.foreground': '#006fba',
            'editorInfo.border': '#006fba',
            'editorHint.foreground': '#7651a8',
            'editorHint.border': '#7651a8',
            'editorOverviewRuler.errorForeground': '#d7193fcc',
            'editorOverviewRuler.warningForeground': '#a86500cc',
            'editorOverviewRuler.infoForeground': '#006fbacc'
          }
        });

        function aplicarTemaMonaco(theme) {
          monaco.editor.setTheme(theme === 'solarized-light'
            ? 'coding-loop-solarized-light'
            : 'coding-loop-solarized-dark');
        }

        // O worker TypeScript do Monaco sempre emite as mensagens em inglês.
        // O dicionário oficial usa o código estável do diagnóstico (TS1005,
        // TS2304 etc.), evitando depender de uma comparação frágil por texto.
        function construirComparadorDeTemplate(templateEn) {
          var indices = [];
          var regexEscapado = templateEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          regexEscapado = regexEscapado.replace(/\\\{(\d+)\\\}/g, function (_, indice) {
            indices.push(Number(indice));
            return '([\\s\\S]+?)';
          });
          return { regex: new RegExp('^' + regexEscapado + '$'), indices: indices };
        }

        function preencherTemplatePt(templatePt, valoresPorIndice) {
          return templatePt.replace(/\{(\d+)\}/g, function (correspondencia, indice) {
            var valor = valoresPorIndice[Number(indice)];
            return valor !== undefined ? valor : correspondencia;
          });
        }

        var cacheComparadoresTs = {};
        function traduzirPorCodigoOficial(codigo, mensagemOriginal) {
          if (!codigo || !window.CL_TS_DIAGNOSTICOS) return null;
          var par = window.CL_TS_DIAGNOSTICOS[codigo];
          if (!par) return null;

          var templateEn = par[0];
          var templatePt = par[1];
          if (templateEn === mensagemOriginal) return templatePt;

          if (!cacheComparadoresTs[codigo]) {
            cacheComparadoresTs[codigo] = construirComparadorDeTemplate(templateEn);
          }
          var comparador = cacheComparadoresTs[codigo];
          var resultado = mensagemOriginal.match(comparador.regex);
          if (!resultado) return null;

          var valores = {};
          comparador.indices.forEach(function (indicePlaceholder, posicao) {
            valores[indicePlaceholder] = resultado[posicao + 1];
          });
          return preencherTemplatePt(templatePt, valores);
        }

        function traduzirDiagnosticoMonaco(mensagem, codigo) {
          var texto = String(mensagem || '');
          var traduzidaPorCodigo = traduzirPorCodigoOficial(codigo, texto);
          if (traduzidaPorCodigo !== null) return traduzidaPorCodigo;
          var traducoesExatas = {
            'Expression expected.': 'Era esperada uma expressão.',
            'Declaration or statement expected.': 'Era esperada uma declaração ou instrução.',
            'Unexpected token.': 'Símbolo inesperado.',
            'Identifier expected.': 'Era esperado um identificador.',
            'Property assignment expected.': 'Era esperada uma atribuição de propriedade.',
            'Property value expected.': 'Era esperado um valor para a propriedade.',
            'Comma expected.': 'Era esperada uma vírgula.',
            'Colon expected.': 'Eram esperados dois-pontos.',
            '"}" expected.': 'Era esperado "}".',
            '";" expected.': 'Era esperado ";".',
            'End of file expected.': 'Era esperado o fim do arquivo.',
            'Unreachable code detected.': 'Código inacessível detectado.',
            'Variable declaration expected.': 'Era esperada uma declaração de variável.'
          };
          if (traducoesExatas[texto]) return traducoesExatas[texto];
          return texto
            .replace(/^Cannot find name ('[^']+').$/, 'Não foi possível encontrar o nome $1.')
            .replace(/^Cannot find namespace ('[^']+').$/, 'Não foi possível encontrar o namespace $1.')
            .replace(/^Cannot redeclare block-scoped variable ('[^']+').$/, 'Não é possível redeclarar a variável de bloco $1.')
            .replace(/^('.*?') was also declared here\.$/, '$1 também foi declarado(a) aqui.')
            .replace(/^Cannot assign to ('[^']+') because it is a constant.$/, 'Não é possível atribuir a $1 porque ela é uma constante.')
            .replace(/^Variable ('[^']+') is used before being assigned.$/, 'A variável $1 é usada antes de receber um valor.')
            .replace(/^Variable ('[^']+') implicitly has type 'any' in some locations where its type cannot be determined.$/, 'A variável $1 possui tipo implícito "any" em locais onde seu tipo não pode ser determinado.')
            .replace(/^'([^']+)' is declared but its value is never read.$/, '$1 foi declarado(a), mas seu valor nunca é usado.')
            .replace(/^'([^']+)' is declared but never used.$/, '$1 foi declarado(a), mas nunca é usado(a).')
            .replace(/^Parameter ('[^']+') implicitly has an 'any' type.$/, 'O parâmetro $1 possui tipo implícito "any".')
            .replace(/^Parameter ('[^']+') is declared but its value is never read.$/, 'O parâmetro $1 foi declarado, mas seu valor nunca é usado.')
            .replace(/^Type (.+) is not assignable to type (.+).$/, 'O tipo $1 não pode ser atribuído ao tipo $2.')
            .replace(/^Property ('[^']+') does not exist on type (.+).$/, 'A propriedade $1 não existe no tipo $2.')
            .replace(/^Expected (\d+) arguments?, but got (\d+).$/, 'Eram esperados $1 argumento(s), mas foram recebidos $2.')
            .replace(/^Expected at least (\d+) arguments?, but got (\d+).$/, 'Eram esperados pelo menos $1 argumento(s), mas foram recebidos $2.')
            .replace(/^Object is possibly 'null'\.$/, 'O objeto pode ser "null".')
            .replace(/^Object is possibly 'undefined'\.$/, 'O objeto pode ser "undefined".')
            .replace(/^Cannot read properties of undefined/i, 'Não é possível ler propriedades de "undefined"')
            .replace(/^Cannot read properties of null/i, 'Não é possível ler propriedades de "null"')
            .replace(/^At-rule or selector expected\.$/i, 'Era esperada uma regra CSS ou um seletor.')
            .replace(/^Identifier or variable expected\.$/i, 'Era esperado um identificador ou uma variável.')
            .replace(/^Expected a declaration\.$/i, 'Era esperada uma declaração.')
            .replace(/^Expected a property name\.$/i, 'Era esperado o nome de uma propriedade.')
            .replace(/^Expected a value\.$/i, 'Era esperado um valor.')
            .replace(/^Expected a comma or closing (?:brace|bracket)\.$/i, 'Era esperada uma vírgula ou o fechamento da estrutura.')
            .replace(/^Unexpected end of JSON input\.$/i, 'Fim inesperado do conteúdo JSON.')
            .replace(/^Expected (?:a )?property name or ['"]}['"]\.?$/i, 'Era esperado o nome de uma propriedade ou o fechamento "}".')
            .replace(/^Expected (?:a )?property name\.?$/i, 'Era esperado o nome de uma propriedade.')
            .replace(/^Expected (?:a )?value\.?$/i, 'Era esperado um valor.')
            .replace(/^Expected (?:a )?colon\.?$/i, 'Eram esperados dois-pontos.')
            .replace(/^Expected (?:a )?comma\.?$/i, 'Era esperada uma vírgula.')
            .replace(/^Expected (?:a )?semicolon\.?$/i, 'Era esperado ponto e vírgula.')
            .replace(/^Expected (?:a )?closing (?:brace|bracket|parenthesis|parentheses)\.?$/i, 'Era esperado o fechamento da estrutura.')
            .replace(/^Expected (?:a )?['"]}['"]\.?$/i, 'Era esperado "}".')
            .replace(/^Expected (?:a )?['"]\]['"]\.?$/i, 'Era esperado "]".')
            .replace(/^Expected (?:a )?['"]\)['"]\.?$/i, 'Era esperado ")".')
            .replace(/^Trailing comma\.?$/i, 'Vírgula final não é permitida aqui.')
            .replace(/^Comments are not permitted in JSON\.?$/i, 'Comentários não são permitidos em JSON.')
            .replace(/^Duplicate object key\.?$/i, 'Esta propriedade foi declarada mais de uma vez.')
            .replace(/^Property (.+) is not allowed\.?$/i, 'A propriedade $1 não é permitida.')
            .replace(/^Property (.+) is not expected here\.?$/i, 'A propriedade $1 não é esperada aqui.')
            .replace(/^Missing required property (.+)\.?$/i, 'Está faltando a propriedade obrigatória $1.')
            .replace(/^Missing property (.+)\.?$/i, 'Está faltando a propriedade obrigatória $1.')
            .replace(/^Incorrect type\. Expected (.+) but found (.+)\.?$/i, 'Tipo incorreto. Era esperado $1, mas foi encontrado $2.')
            .replace(/^Incorrect type\. Expected (.+)\.?$/i, 'Tipo incorreto. Era esperado $1.')
            .replace(/^Value is not accepted\. Valid values: (.+)\.?$/i, 'O valor não é aceito. Valores válidos: $1.')
            .replace(/^Value is not accepted\.?$/i, 'O valor não é aceito.')
            .replace(/^The value is not accepted\.?$/i, 'O valor não é aceito.')
            .replace(/^Array has too few items\. Expected (\d+) or more\.?$/i, 'A lista possui poucos itens. Eram esperados $1 ou mais.')
            .replace(/^Array has too many items\. Expected (\d+) or fewer\.?$/i, 'A lista possui itens demais. Eram esperados no máximo $1.')
            .replace(/^String is shorter than the minimum length of (\d+)\.?$/i, 'O texto é menor que o tamanho mínimo de $1 caractere(s).')
            .replace(/^String is longer than the maximum length of (\d+)\.?$/i, 'O texto excede o tamanho máximo de $1 caractere(s).')
            .replace(/^Does not match the pattern of (.+)\.?$/i, 'O valor não corresponde ao padrão exigido: $1.')
            .replace(/^Unknown property: (.+)\.?$/i, 'Propriedade desconhecida: $1.')
            .replace(/^Unknown at rule (.+)\.?$/i, 'Regra CSS desconhecida: $1.')
            .replace(/^Unknown property (.+)\.?$/i, 'Propriedade CSS desconhecida: $1.')
            .replace(/^Invalid property value\.?$/i, 'Valor inválido para esta propriedade CSS.')
            .replace(/^Property value expected\.?$/i, 'Era esperado um valor para a propriedade.')
            .replace(/^Selector expected\.?$/i, 'Era esperado um seletor CSS.')
            .replace(/^Rule or selector expected\.?$/i, 'Era esperada uma regra CSS ou um seletor.')
            .replace(/^Property (.+) is not allowed\.$/, 'A propriedade $1 não é permitida.')
            .replace(/^Missing property (.+)\.$/, 'Está faltando a propriedade obrigatória $1.')
            .replace(/^Incorrect type\. Expected (.+)\.$/, 'Tipo incorreto. Era esperado $1.')
            .replace(/^Value is not accepted\. Valid values: (.+)\.$/, 'O valor não é aceito. Valores válidos: $1.')
            .replace(/^Unknown property: (.+)\.$/, 'Propriedade desconhecida: $1.')
            .replace(/^Do you mean (.+)\?$/, 'Você quis dizer $1?');
        }

        var diagnosticosSemTraducaoAvisados = {};
        function modoDiagnosticoDaIdeAtivo() {
          try {
            return Boolean(window.CL && CL.config && CL.config.debug) ||
              new URLSearchParams(window.location.search).get('ideDebug') === '1' ||
              window.localStorage.getItem('cl.ide.debug') === '1';
          } catch (erro) {
            return Boolean(window.CL && CL.config && CL.config.debug);
          }
        }

        function registrarDiagnosticoSemTraducao(mensagem) {
          if (!modoDiagnosticoDaIdeAtivo()) return;
          if (!/\b(?:cannot|expected|property|variable|parameter|argument|type|unexpected|unknown|missing|unreachable)\b/i.test(mensagem)) return;
          if (diagnosticosSemTraducaoAvisados[mensagem]) return;
          diagnosticosSemTraducaoAvisados[mensagem] = true;
          console.warn('[CL.ide] diagnóstico do Monaco sem tradução:', mensagem);
        }

        function criarEditor(id, linguagem, valorInicial, nomeDoArquivo) {
          // Os workers de linguagem do Monaco (principalmente o TypeScript)
          // reconhecem e relacionam arquivos de forma mais confiável com URIs
          // `file:` e extensões reais, como .js e .ts.
          var extensoesPorLinguagem = { html: 'html', css: 'css', scss: 'scss', javascript: 'js', typescript: 'ts', javascriptreact: 'jsx', json: 'json', xml: 'xml', svg: 'svg', markdown: 'md' };
          var extensao = extensoesPorLinguagem[linguagem] || 'txt';
          var caminhoDoArquivo = String(nomeDoArquivo || (id + '.' + extensao)).split('/').map(encodeURIComponent).join('/');
          var linguagemMonaco = linguagem === 'javascriptreact' ? 'javascript' : (linguagem === 'svg' ? 'xml' : linguagem);
          // Todos os arquivos reais compartilham a mesma raiz virtual para
          // que imports relativos resolvam para o modelo aberto correto.
          // Os três modelos de compatibilidade continuam isolados.
          var raizVirtual = nomeDoArquivo ? 'file:///coding-loop/projeto/' : ('file:///coding-loop/estado-legado/' + encodeURIComponent(id) + '/');
          var model = monaco.editor.createModel(valorInicial, linguagemMonaco, monaco.Uri.parse(raizVirtual + caminhoDoArquivo));
          var editorMonaco = monaco.editor.create(document.getElementById(id), {
            model: model,
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: false },
            lineNumbersMinChars: 2,
            lineDecorationsWidth: 4,
            glyphMargin: false,
            folding: false,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            renderValidationDecorations: 'on',
            overviewRulerLanes: 3,
            hideCursorInOverviewRuler: false
          });

          // O Monaco anuncia esses atalhos no widget da lâmpada, mas alguns
          // layouts de teclado/navegadores não encaminham as combinações
          // nativas no editor standalone. Registrá-las no editor garante o
          // mesmo comportamento em todos os arquivos, inclusive os extras.
          editorMonaco.addAction({
            id: 'coding-loop.aplicar-correcao-preferencial',
            label: 'Aplicar correção rápida preferencial',
            keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.Period],
            run: function (editor) {
              var acao = editor.getAction('editor.action.autoFix');
              return acao ? acao.run() : undefined;
            }
          });
          editorMonaco.addAction({
            id: 'coding-loop.mostrar-correcoes-rapidas',
            label: 'Mostrar correções rápidas',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period],
            run: function (editor) {
              var acao = editor.getAction('editor.action.quickFix');
              return acao ? acao.run() : undefined;
            }
          });

          // O Monaco normalmente fecha tags HTML. Como isso pode depender do
          // carregamento do worker, mantemos um fallback, mas só depois de dar
          // ao próprio Monaco a chance de inserir o fechamento. Sem essa
          // espera, os dois mecanismos podiam produzir `</h1></h1>` e o
          // validador corretamente marcava o segundo fechamento como erro.
          if (linguagem === 'html') {
            var inserindoFechamentoHtml = false;
            var tagsSemFechamento = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
            model.onDidChangeContent(function (evento) {
              if (inserindoFechamentoHtml || evento.changes.length !== 1) return;
              var alteracao = evento.changes[0];
              if (alteracao.text !== '>') return;
              var numeroLinha = alteracao.range.startLineNumber;
              var linha = model.getLineContent(numeroLinha);
              var coluna = alteracao.range.startColumn + 1;
              var antes = linha.slice(0, coluna - 1);
              var depois = linha.slice(coluna - 1);
              var encontrada = antes.match(/<([a-z][\w:-]*)(?:\s[^<>]*)?>$/i);
              if (!encontrada) return;
              var tag = encontrada[1].toLowerCase();
              if (tagsSemFechamento.indexOf(tag) >= 0 || /\/\s*>$/.test(antes) || new RegExp('^\\s*</' + tag + '\\s*>', 'i').test(depois)) return;
              window.setTimeout(function () {
                var linhaAtual = model.getLineContent(numeroLinha);
                var depoisAtual = linhaAtual.slice(coluna - 1);
                if (new RegExp('^\\s*</' + tag + '\\s*>', 'i').test(depoisAtual)) return;
                inserindoFechamentoHtml = true;
                editorMonaco.executeEdits('coding-loop-auto-close-tag', [{
                  range: new monaco.Range(numeroLinha, coluna, numeroLinha, coluna),
                  text: '</' + tag + '>',
                  forceMoveMarkers: true
                }]);
                editorMonaco.setPosition({ lineNumber: numeroLinha, column: coluna });
                inserindoFechamentoHtml = false;
              }, 0);
            });
          }
          var anotacoes = [];
          var listenersDeAnotacao = [];
          var editorDescartado = false;
          var historicoEstado = { undo: 0, redo: 0 };

          model.onDidChangeContent(function (evento) {
            if (evento.isFlush) {
              historicoEstado.undo = 0;
              historicoEstado.redo = 0;
            } else if (evento.isUndoing) {
              historicoEstado.undo = Math.max(0, historicoEstado.undo - 1);
              historicoEstado.redo += 1;
            } else if (evento.isRedoing) {
              historicoEstado.redo = Math.max(0, historicoEstado.redo - 1);
              historicoEstado.undo += 1;
            } else {
              historicoEstado.undo += 1;
              historicoEstado.redo = 0;
            }
          });

          function avisarAlteracaoDeAnotacoes() {
            listenersDeAnotacao.forEach(function (listener) { listener(); });
          }

          var session = {
            on: function (evento, listener) {
              if (evento === 'change') return model.onDidChangeContent(listener);
              if (evento === 'changeAnnotation') listenersDeAnotacao.push(listener);
            },
            getUndoManager: function () {
              return {
                hasUndo: function () { return historicoEstado.undo > 0; },
                hasRedo: function () { return historicoEstado.redo > 0; }
              };
            },
            getAnnotations: function () { return anotacoes.slice(); },
            setAnnotations: function (novasAnotacoes) {
              var chavesVistas = {};
              anotacoes = novasAnotacoes.filter(function (anotacao) {
                var chave = [anotacao.row, anotacao.column, anotacao.__fimColuna, anotacao.code, anotacao.type, anotacao.text].join('|');
                if (chavesVistas[chave]) return false;
                chavesVistas[chave] = true;
                return true;
              });
              monaco.editor.setModelMarkers(model, 'coding-loop', anotacoes.map(function (anotacao) {
                var linha = Math.max(1, Math.min(model.getLineCount(), (anotacao.row || 0) + 1));
                var colunaMaxima = model.getLineMaxColumn(linha);
                var colunaInicial = Math.max(1, Math.min(colunaMaxima, (anotacao.column || 0) + 1));
                var semLocalizacaoExata = anotacao.__semLinha || anotacao.__semLocalizacao;
                if (!semLocalizacaoExata && colunaMaxima > 1 && colunaInicial === colunaMaxima) colunaInicial--;
                var colunaFinalDesejada = typeof anotacao.__fimColuna === 'number' ? anotacao.__fimColuna + 1 : colunaInicial + 1;
                var colunaFinal = semLocalizacaoExata
                  ? colunaInicial
                  : Math.max(colunaInicial + (colunaMaxima > colunaInicial ? 1 : 0), Math.min(colunaMaxima, colunaFinalDesejada));
                return {
                  startLineNumber: linha,
                  startColumn: colunaInicial,
                  endLineNumber: linha,
                  endColumn: colunaFinal,
                  message: anotacao.text || '',
                  code: anotacao.code,
                  severity: anotacao.type === 'warning' ? monaco.MarkerSeverity.Warning : (anotacao.type === 'hint' ? monaco.MarkerSeverity.Hint : (anotacao.type === 'info' ? monaco.MarkerSeverity.Info : monaco.MarkerSeverity.Error))
                };
              }));
              avisarAlteracaoDeAnotacoes();
            },
            getLine: function (linha) { return model.getLineContent(linha + 1); },
            getLength: function () { return model.getLineCount(); }
          };

          var editorAdaptado = {
            session: session,
            getValue: function () { return model.getValue(); },
            setValue: function (valor, cursorPos) {
              model.setValue(valor);
              if (cursorPos === -1) {
                editorMonaco.setPosition({ lineNumber: 1, column: 1 });
                editorMonaco.revealLine(1);
              }
            },
            resize: function () { editorMonaco.layout(); },
            focus: function () { editorMonaco.focus(); },
            undo: function () { editorMonaco.trigger('coding-loop', 'undo'); },
            redo: function () { editorMonaco.trigger('coding-loop', 'redo'); },
            getNativeAnnotations: function () {
              return monaco.editor.getModelMarkers({ resource: model.uri }).filter(function (marker) {
                return marker.owner !== 'coding-loop';
              }).map(function (marker) {
                return {
                  row: marker.startLineNumber - 1,
                  column: marker.startColumn - 1,
                  __fimColuna: Math.max(marker.startColumn, marker.endColumn) - 1,
                  text: traduzirDiagnosticoMonaco(marker.message || 'Diagnóstico do editor.', marker.code && (marker.code.value || marker.code)),
                  type: marker.severity === monaco.MarkerSeverity.Warning ? 'warning' : (marker.severity === monaco.MarkerSeverity.Hint ? 'hint' : (marker.severity === monaco.MarkerSeverity.Info ? 'info' : 'error')),
                  code: marker.code && (marker.code.value || marker.code)
                };
              });
            },
            getModelUri: function () { return model.uri.toString(); },
            localizarMarcadoresNativos: function () {
              var porOwner = {};
              monaco.editor.getModelMarkers({ resource: model.uri }).forEach(function (marker) {
                if (marker.owner === 'coding-loop') return;
                var mensagemTraduzida = traduzirDiagnosticoMonaco(marker.message, marker.code && (marker.code.value || marker.code));
                if (mensagemTraduzida === marker.message) registrarDiagnosticoSemTraducao(marker.message);
                if (mensagemTraduzida === marker.message) return;
                if (!porOwner[marker.owner]) porOwner[marker.owner] = [];
                porOwner[marker.owner].push(marker);
              });
              Object.keys(porOwner).forEach(function (owner) {
                var marcadoresDoOwner = monaco.editor.getModelMarkers({ resource: model.uri, owner: owner });
                monaco.editor.setModelMarkers(model, owner, marcadoresDoOwner.map(function (marker) {
                  var informacoesRelacionadas = marker.relatedInformation && marker.relatedInformation.map(function (informacao) {
                    return Object.assign({}, informacao, { message: traduzirDiagnosticoMonaco(informacao.message) });
                  });
                  return Object.assign({}, marker, {
                    message: traduzirDiagnosticoMonaco(marker.message, marker.code && (marker.code.value || marker.code)),
                    relatedInformation: informacoesRelacionadas
                  });
                }));
              });
            },
            dispose: function () {
              if (editorDescartado) return;
              editorDescartado = true;
              if (editorAdaptado.ouvinteMarcadoresNativos) editorAdaptado.ouvinteMarcadoresNativos.dispose();
              listenersDeAnotacao = [];
              anotacoes = [];
              editorMonaco.dispose();
              model.dispose();
            },
            on: function (evento, listener) {
              if (evento === 'change') return model.onDidChangeContent(listener);
              if (evento === 'focus') return editorMonaco.onDidFocusEditorText(listener);
            }
          };
          // Todo editor criado — principal ou adicional — recebe a mesma
          // conexão de localização dos markers nativos do Monaco.
          editorAdaptado.ouvinteMarcadoresNativos = conectarTraducaoDeMarcadores(editorAdaptado);
          return editorAdaptado;
        }

        function conectarTraducaoDeMarcadores(editor, aoAtualizar) {
          return monaco.editor.onDidChangeMarkers(function (recursos) {
            var esteEditorMudou = recursos.some(function (recurso) { return recurso.toString() === editor.getModelUri(); });
            if (!esteEditorMudou) return;
            // setModelMarkers também dispara este evento. Ignoramos essa
            // segunda passagem para não redesenhar os mesmos diagnósticos nem
            // registrar uma mensagem já localizada como se estivesse em inglês.
            if (editor.localizandoMarcadores) return;
            editor.localizandoMarcadores = true;
            try {
              editor.localizarMarcadoresNativos();
            } finally {
              editor.localizandoMarcadores = false;
            }
            if (aoAtualizar) aoAtualizar(editor);
            else if (editor.aoAtualizarMarcadores) editor.aoAtualizarMarcadores(editor);
          });
        }

        var carregandoCodigoDaEtapa = true;
        var codigoInicial = (window.getCodigoInicialParaEditor && window.getCodigoInicialParaEditor()) || {};

        // Estes modelos preservam a interface dos exercícios antigos e recebem
        // apenas anotações manuais. Como não ficam visíveis, plaintext evita
        // que os workers validem uma segunda cópia do mesmo HTML/CSS/JS.
        htmlEditor = criarEditor('html-editor', 'plaintext', codigoInicial.html || '');
        cssEditor = criarEditor('css-editor', 'plaintext', codigoInicial.css || '');
        jsEditor = criarEditor('js-editor', 'plaintext', codigoInicial.js || '');
        [htmlEditor, cssEditor, jsEditor].forEach(function (editor) { editor.localizarMarcadoresNativos(); });
        var arquivosExtras = [];

        function obterConteudoDosArquivos(linguagens) {
          return arquivosExtras.filter(function (arquivo) {
            return linguagens.indexOf(arquivo.linguagem) >= 0;
          }).map(function (arquivo) { return arquivo.editor.getValue(); }).join('\n');
        }

        function registrarAutocompleteDoProjeto() {
          var tipos = monaco.languages.CompletionItemKind;
          var alcance = function (model, position) {
            var palavra = model.getWordUntilPosition(position);
            return new monaco.Range(position.lineNumber, palavra.startColumn, position.lineNumber, palavra.endColumn);
          };
          var sugestoesDoProjeto = function (linguagem) {
            var html = obterConteudoDosArquivos(['html']);
            var css = obterConteudoDosArquivos(['css', 'scss']);
            var js = obterConteudoDosArquivos(['javascript', 'typescript', 'javascriptreact']);
            var itens = [];
            var adicionar = function (rotulo, detalhe, tipo, inserir) {
              if (!rotulo) return;
              itens.push({ label: rotulo, kind: tipo, detail: detalhe, insertText: inserir || rotulo, range: null });
            };
            if (linguagem === 'html') {
              Array.from(new Set((html.match(/\bid\s*=\s*["']([^"']+)/gi) || []).map(function (texto) { return texto.replace(/^.*?["']/, '').trim(); }))).forEach(function (id) { adicionar('#' + id, 'ID do projeto', tipos.Reference); });
              Array.from(new Set((html.match(/\bclass\s*=\s*["']([^"']+)/gi) || []).flatMap(function (texto) { return (texto.replace(/^.*?["']/, '').match(/[^\s"']+/g) || []); }))).forEach(function (classe) { adicionar('.' + classe, 'Classe do projeto', tipos.Reference); });
              itens.push(
                { label: 'Estrutura HTML', kind: tipos.Snippet, detail: 'Snippet', insertText: '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${1:Minha página}</title>\n</head>\n<body>\n  ${0}\n</body>\n</html>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: null },
                { label: 'Imagem acessível', kind: tipos.Snippet, detail: 'Snippet', insertText: '<img src="${1:imagem.jpg}" alt="${2:Descrição da imagem}">', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: null }
              );
            }
            if (linguagem === 'css' || linguagem === 'scss') {
              Array.from(new Set((html.match(/\bclass\s*=\s*["']([^"']+)/gi) || []).flatMap(function (texto) { return (texto.replace(/^.*?["']/, '').match(/[^\s"']+/g) || []); }))).forEach(function (classe) { adicionar('.' + classe, 'Classe encontrada no HTML', tipos.Class); });
              Array.from(new Set((html.match(/\bid\s*=\s*["']([^"']+)/gi) || []).map(function (texto) { return texto.replace(/^.*?["']/, '').trim(); }))).forEach(function (id) { adicionar('#' + id, 'ID encontrado no HTML', tipos.Reference); });
              itens.push({ label: 'Flex centralizado', kind: tipos.Snippet, detail: 'Snippet', insertText: 'display: flex;\njustify-content: center;\nalign-items: center;', range: null });
            }
            if (linguagem === 'javascript' || linguagem === 'typescript' || linguagem === 'javascriptreact') {
              Array.from(new Set((js.match(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g) || []).map(function (texto) { return texto.match(/([A-Za-z_$][\w$]*)$/)[1]; }))).forEach(function (nome) { adicionar(nome, 'Símbolo do projeto', tipos.Variable); });
              arquivosExtras.forEach(function (arquivo) { adicionar(arquivo.nome, 'Arquivo do projeto', tipos.File); });
              itens.push({ label: 'Evento click', kind: tipos.Snippet, detail: 'Snippet', insertText: "${1:elemento}.addEventListener('click', () => {\n  ${0}\n});", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: null });
            }
            return itens;
          };
          ['html', 'css', 'scss', 'javascript', 'typescript', 'javascriptreact'].forEach(function (linguagem) {
            monaco.languages.registerCompletionItemProvider(linguagem, {
              triggerCharacters: ['.', '#', '<', '"', "'"],
              provideCompletionItems: function (model, position) {
                return { suggestions: sugestoesDoProjeto(linguagem).map(function (item) { item.range = alcance(model, position); return item; }) };
              }
            });
          });
          var opcoesDeDiagnostico = { noSemanticValidation: false, noSyntaxValidation: false, noSuggestionDiagnostics: false };
          var opcoesDeCompilacao = {
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            allowJs: true,
            checkJs: true,
            strict: true,
            strictNullChecks: true,
            noImplicitAny: true,
            noImplicitReturns: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            allowUnreachableCode: false,
            allowUnusedLabels: false
          };
          if (monaco.languages.typescript.JsxEmit) {
            opcoesDeCompilacao.jsx = monaco.languages.typescript.JsxEmit.ReactJSX;
          }
          monaco.languages.typescript.javascriptDefaults.setCompilerOptions(opcoesDeCompilacao);
          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(opcoesDeDiagnostico);
          monaco.languages.typescript.typescriptDefaults.setCompilerOptions(opcoesDeCompilacao);
          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(opcoesDeDiagnostico);
          if (monaco.languages.json && monaco.languages.json.jsonDefaults) {
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
              validate: true,
              allowComments: true,
              trailingCommas: 'warning',
              schemas: [{
                uri: 'file:///coding-loop/schemas/package.json',
                fileMatch: ['**/package.json'],
                schema: {
                  type: 'object',
                  required: ['name', 'version'],
                  properties: {
                    name: { type: 'string', minLength: 1 },
                    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$' },
                    private: { type: 'boolean' },
                    scripts: { type: 'object', additionalProperties: { type: 'string' } },
                    dependencies: { type: 'object', additionalProperties: { type: 'string' } },
                    devDependencies: { type: 'object', additionalProperties: { type: 'string' } }
                  },
                  additionalProperties: true
                }
              }]
            });
          }
          if (monaco.languages.css && monaco.languages.css.cssDefaults) {
            monaco.languages.css.cssDefaults.setDiagnosticsOptions({ validate: true });
          }
          if (monaco.languages.css && monaco.languages.css.scssDefaults) {
            monaco.languages.css.scssDefaults.setDiagnosticsOptions({ validate: true });
          }

          // Ações rápidas só são oferecidas quando a alteração é inequívoca.
          // Não removemos automaticamente variáveis não usadas, pois o valor
          // inicial delas pode provocar efeitos colaterais importantes.
          var corrigirPontoEVirgula = {
            provideCodeActions: function (model, range, context) {
              var acoes = context.markers.filter(function (marker) {
                return marker.code && (marker.code.value || marker.code) === 'coding-loop:semicolon';
              }).map(function (marker) {
                return {
                  title: 'Adicionar ponto e vírgula',
                  kind: 'quickfix',
                  diagnostics: [marker],
                  isPreferred: true,
                  edit: {
                    edits: [{
                      resource: model.uri,
                      textEdit: {
                        range: new monaco.Range(marker.endLineNumber, marker.endColumn, marker.endLineNumber, marker.endColumn),
                        text: ';'
                      }
                    }]
                  }
                };
              });
              return { actions: acoes, dispose: function () {} };
            }
          };
          monaco.languages.registerCodeActionProvider('css', corrigirPontoEVirgula);
          monaco.languages.registerCodeActionProvider('scss', corrigirPontoEVirgula);

          var corrigirDelimitadorEsperado = {
            provideCodeActions: function (model, range, context) {
              var acoes = [];
              context.markers.forEach(function (marker) {
                var codigo = marker.code && (marker.code.value || marker.code);
                var mensagem = String(marker.message || '');
                if (String(codigo) !== '1005' && !/(?:expected|esperad[oa])/i.test(mensagem)) return;
                var correspondencia = mensagem.match(/["']([;,:}\])])["']/) ||
                  mensagem.match(/(?:expected|esperad[oa])\s+(?:um |uma )?(ponto e vírgula|vírgula|dois-pontos)/i);
                if (!correspondencia) return;
                var nomes = { 'ponto e vírgula': ';', 'vírgula': ',', 'dois-pontos': ':' };
                var delimitador = nomes[String(correspondencia[1]).toLowerCase()] || correspondencia[1];
                if ([';', ',', ':', '}', ']', ')'].indexOf(delimitador) < 0) return;
                acoes.push({
                  title: 'Inserir "' + delimitador + '" esperado',
                  kind: 'quickfix',
                  diagnostics: [marker],
                  isPreferred: true,
                  edit: {
                    edits: [{
                      resource: model.uri,
                      textEdit: {
                        range: new monaco.Range(marker.startLineNumber, marker.startColumn, marker.startLineNumber, marker.startColumn),
                        text: delimitador
                      }
                    }]
                  }
                });
              });
              return { actions: acoes, dispose: function () {} };
            }
          };
          ['javascript', 'typescript', 'json'].forEach(function (linguagem) {
            monaco.languages.registerCodeActionProvider(linguagem, corrigirDelimitadorEsperado);
          });

          monaco.languages.registerCodeActionProvider('html', {
            provideCodeActions: function (model, range, context) {
              var acoes = [];
              context.markers.forEach(function (marker) {
                var codigo = String(marker.code && (marker.code.value || marker.code) || '');
                var tag;
                var alcanceDaEdicao;
                var textoDaEdicao;
                var tituloDaAcao;
                if (codigo.indexOf('coding-loop:html-transformar-fechamento:') === 0) {
                  tag = codigo.slice('coding-loop:html-transformar-fechamento:'.length);
                  if (!tag) return;
                  alcanceDaEdicao = new monaco.Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn);
                  textoDaEdicao = '</' + tag + '>';
                  tituloDaAcao = 'Transformar em </' + tag + '>';
                } else if (codigo.indexOf('coding-loop:html-fechar-antes:') === 0) {
                  var partes = codigo.slice('coding-loop:html-fechar-antes:'.length).split(':');
                  tag = partes[0];
                  var tagDeFechamento = partes[1];
                  if (!tag || !tagDeFechamento) return;
                  var offsetInicial = model.getOffsetAt({ lineNumber: marker.startLineNumber, column: marker.startColumn });
                  var indiceFechamento = model.getValue().toLowerCase().indexOf('</' + tagDeFechamento.toLowerCase(), offsetInicial);
                  if (indiceFechamento < 0) return;
                  var posicaoFechamento = model.getPositionAt(indiceFechamento);
                  alcanceDaEdicao = new monaco.Range(posicaoFechamento.lineNumber, posicaoFechamento.column, posicaoFechamento.lineNumber, posicaoFechamento.column);
                  textoDaEdicao = '</' + tag + '>\n';
                  tituloDaAcao = 'Adicionar </' + tag + '>';
                } else if (codigo.indexOf('coding-loop:html-fechar:') === 0) {
                  tag = codigo.slice('coding-loop:html-fechar:'.length);
                  var ultimaLinha = model.getLineCount();
                  var ultimaColuna = model.getLineMaxColumn(ultimaLinha);
                  alcanceDaEdicao = new monaco.Range(ultimaLinha, ultimaColuna, ultimaLinha, ultimaColuna);
                  textoDaEdicao = (model.getValue().endsWith('\n') ? '' : '\n') + '</' + tag + '>';
                  tituloDaAcao = 'Adicionar </' + tag + '>';
                } else if (codigo === 'coding-loop:html-completar-tag') {
                  tag = 'tag';
                  var linhaDaTag = marker.startLineNumber;
                  var fimDaTag = model.getLineMaxColumn(linhaDaTag);
                  alcanceDaEdicao = new monaco.Range(linhaDaTag, fimDaTag, linhaDaTag, fimDaTag);
                  textoDaEdicao = '>';
                  tituloDaAcao = 'Adicionar ">"';
                } else {
                  return;
                }
                acoes.push({
                  title: tituloDaAcao,
                  kind: 'quickfix',
                  diagnostics: [marker],
                  isPreferred: true,
                  edit: {
                    edits: [{
                      resource: model.uri,
                      textEdit: {
                        range: alcanceDaEdicao,
                        text: textoDaEdicao
                      }
                    }]
                  }
                });
              });
              return { actions: acoes, dispose: function () {} };
            }
          });
        }
        registrarAutocompleteDoProjeto();
        aplicarTemaMonaco(document.documentElement.getAttribute('data-theme'));
        (codigoInicial.files || []).forEach(function (arquivo) {
          if (arquivo && arquivo.linguagem && arquivo.nome) criarArquivoExtra(arquivo.linguagem, arquivo.nome, arquivo.conteudo || '');
        });
        // Migra automaticamente o conteúdo salvo no formato antigo para arquivos reais.
        if (!(codigoInicial.files || []).length) {
          if (codigoInicial.html) criarArquivoExtra('html', 'index.html', codigoInicial.html);
          if (codigoInicial.css) criarArquivoExtra('css', 'style.css', codigoInicial.css);
          if (codigoInicial.js) criarArquivoExtra('javascript', 'script.js', codigoInicial.js);
        }
        carregandoCodigoDaEtapa = false;

        // Os controles agem sobre o último editor que recebeu foco. Assim,
        // continuam previsíveis mesmo quando mais de uma aba está visível.
        var editorAtivoParaHistorico = arquivosExtras.length ? arquivosExtras[0].editor : htmlEditor;
        function atualizarControlesHistorico() {
          if (!editorAtivoParaHistorico) return;
          var historico = editorAtivoParaHistorico.session.getUndoManager();
          if (btnUndo) btnUndo.disabled = !historico.hasUndo();
          if (btnRedo) btnRedo.disabled = !historico.hasRedo();
        }

        [htmlEditor, cssEditor, jsEditor].forEach(function (editor) {
          editor.on('focus', function () {
            editorAtivoParaHistorico = editor;
            atualizarControlesHistorico();
          });
          editor.session.on('change', atualizarControlesHistorico);
        });

        if (btnUndo) {
          btnUndo.addEventListener('click', function () {
            if (!editorAtivoParaHistorico) return;
            editorAtivoParaHistorico.undo();
            editorAtivoParaHistorico.focus();
            atualizarControlesHistorico();
          });
        }

        if (btnRedo) {
          btnRedo.addEventListener('click', function () {
            if (!editorAtivoParaHistorico) return;
            editorAtivoParaHistorico.redo();
            editorAtivoParaHistorico.focus();
            atualizarControlesHistorico();
          });
        }

        atualizarControlesHistorico();

        window.addEventListener('theme:mudou', function (event) {
          aplicarTemaMonaco(event.detail);
        });

        function removerArquivosExtras() {
          arquivosExtras.forEach(function (arquivo) {
            var aba = dragContainer.querySelector('.code-tab[data-target="' + arquivo.idPane + '"]');
            var painel = document.getElementById(arquivo.idPane);
            clearTimeout(arquivo.validacaoTimeout);
            if (arquivo.layoutFrame) cancelAnimationFrame(arquivo.layoutFrame);
            if (arquivo.editor && typeof arquivo.editor.dispose === 'function') arquivo.editor.dispose();
            if (aba) aba.remove();
            if (painel) painel.remove();
          });
          arquivosExtras = [];
        }

        function carregarCodigoDaEtapa() {
          var codigo = (window.getCodigoInicialParaEditor && window.getCodigoInicialParaEditor()) || {};
          carregandoCodigoDaEtapa = true;
          if (codigo.html !== undefined) htmlEditor.setValue(codigo.html, -1);
          if (codigo.css !== undefined) cssEditor.setValue(codigo.css, -1);
          if (codigo.js !== undefined) jsEditor.setValue(codigo.js, -1);
          removerArquivosExtras();
          (codigo.files || []).forEach(function (arquivo) {
            if (arquivo && arquivo.linguagem && arquivo.nome) criarArquivoExtra(arquivo.linguagem, arquivo.nome, arquivo.conteudo || '');
          });
          if (!(codigo.files || []).length) {
            if (codigo.html) criarArquivoExtra('html', 'index.html', codigo.html);
            if (codigo.css) criarArquivoExtra('css', 'style.css', codigo.css);
            if (codigo.js) criarArquivoExtra('javascript', 'script.js', codigo.js);
          }
          sincronizarArquivosPrincipais();
          carregandoCodigoDaEtapa = false;
          atualizarLayoutAbas();
        }

        // Usado pelo índice para calcular o percentual de acerto de cada
        // etapa (ver função `verificar` de cada etapa em MODULOS).
        window.obterCodigoAtualDoEditor = function () {
          var codigoFonte = obterCodigoFonteAgregado();
          return {
            html: codigoFonte.html,
            css: codigoFonte.css,
            js: codigoFonte.js,
            files: arquivosExtras.map(function (arquivo) {
              return { nome: arquivo.nome, linguagem: arquivo.linguagem, conteudo: arquivo.editor.getValue() };
            })
          };
        };

        window.addEventListener('etapa:mudou', function () {
          carregarCodigoDaEtapa();
        });

        var toastTimeout = null;
        function mostrarToast(mensagem) {
          if (!saveToastEl) return;
          saveToastEl.textContent = mensagem;
          saveToastEl.classList.add('is-visible');
          clearTimeout(toastTimeout);
          toastTimeout = setTimeout(function () {
            saveToastEl.classList.remove('is-visible');
          }, 2200);
        }

        function marcarComoNaoSalvo() {
          if (saveProgressDot) saveProgressDot.classList.add('is-visible');
        }

        function marcarComoSalvo() {
          if (saveProgressDot) saveProgressDot.classList.remove('is-visible');
        }

        function salvarCodigoAgora() {
          if (!window.salvarCodigoDoAluno) return Promise.resolve(false);
          var codigoFonte = obterCodigoFonteAgregado();
          var resultado = window.salvarCodigoDoAluno({
            html: codigoFonte.html,
            css: codigoFonte.css,
            js: codigoFonte.js,
            files: arquivosExtras.map(function (arquivo) {
              return { nome: arquivo.nome, linguagem: arquivo.linguagem, conteudo: arquivo.editor.getValue() };
            })
          });
          return Promise.resolve(resultado);
        }

        // Autosave local: agrupa várias teclas em uma única gravação e não
        // mostra toast para não interromper o estudo.
        var autosaveTimeout = null;
        function cancelarSalvamentoAutomatico() {
          clearTimeout(autosaveTimeout);
          autosaveTimeout = null;
        }

        function salvarRascunhoAtual() {
          cancelarSalvamentoAutomatico();
          return salvarCodigoAgora().then(function (salvou) {
            if (salvou) {
              marcarComoSalvo();
              agendarSincronizacaoNuvem();
              agendarBackupNoAparelho();
            }
            return salvou;
          }).catch(function () {
            marcarComoNaoSalvo();
            return false;
          });
        }

        function agendarSalvamentoAutomatico() {
          cancelarSalvamentoAutomatico();
          autosaveTimeout = setTimeout(salvarRascunhoAtual, 700);
        }

        window.salvarRascunhoAtualDaIde = salvarRascunhoAtual;
        window.cancelarSalvamentoAutomaticoDaIde = cancelarSalvamentoAutomatico;
        window.addEventListener('pagehide', salvarRascunhoAtual);
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'hidden') salvarRascunhoAtual();
        });

        window.addEventListener('ide:estado-alterado', marcarComoNaoSalvo);

        function redimensionarEditores() {
          [htmlEditor, cssEditor, jsEditor].concat(arquivosExtras.map(function (arquivo) {
            return arquivo.editor;
          })).forEach(function (editor) {
            if (editor) editor.resize();
          });
          atualizarIndicadoresRolagem();
        }

        function reajustarPaineisParaNovaArea() {
          // Remove medidas em pixels criadas pelos divisores para que os
          // painéis ativos usem toda a área disponível no novo tamanho do IDE.
          limparTamanhosDosPaineis();
          configurarRedimensionadores();

          requestAnimationFrame(function () {
            requestAnimationFrame(redimensionarEditores);
          });
        }

        function atualizarIndicadoresRolagem() {
          if (!tabsScrollWrapper || !tabsScrollViewport) return;
          var margem = 2;
          var larguraDasSetas = 0;
          if (tabsScrollWrapper.classList.contains('has-horizontal-overflow')) {
            tabsScrollWrapper.querySelectorAll('[data-scroll-direction]').forEach(function (botao) {
              larguraDasSetas += botao.offsetWidth;
            });
          }
          var temOverflow = tabsScrollViewport.scrollWidth > tabsScrollViewport.clientWidth + larguraDasSetas + margem;
          tabsScrollWrapper.classList.toggle('has-horizontal-overflow', temOverflow);
          var limite = Math.max(0, tabsScrollViewport.scrollWidth - tabsScrollViewport.clientWidth);
          tabsScrollWrapper.classList.toggle('can-scroll-left', temOverflow && tabsScrollViewport.scrollLeft > margem);
          tabsScrollWrapper.classList.toggle('can-scroll-right', temOverflow && tabsScrollViewport.scrollLeft < limite - margem);
        }

        var TAGS_VAZIAS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

        var ANINHAMENTO_PROIBIDO = {
          p: ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'section', 'article'],
          a: ['a'],
          button: ['button', 'a']
        };

        function linhaDoIndice(codigo, indice) {
          return codigo.slice(0, indice).split('\n').length - 1;
        }

        function removerConteudoDeComentarios(codigo) {
          return codigo.replace(/<!--[\s\S]*?-->/g, function (comentario) {
            return comentario.replace(/[^\n]/g, ' ');
          });
        }

        function verificarErrosHTML(codigoOriginal) {
          if (!codigoOriginal.trim()) return [];
          var codigo = removerConteudoDeComentarios(codigoOriginal);
          var regexTag = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b(?:"[^"]*"|'[^']*'|[^'"<>])*(\/?)>/g;
          var pilha = [];
          var anotacoes = [];
          var match;

          while ((match = regexTag.exec(codigo)) !== null) {
            var nome = match[1].toLowerCase();
            var ehFechamento = match[0].charAt(1) === '/';
            var autoFechada = Boolean(match[2]) || TAGS_VAZIAS.indexOf(nome) !== -1;

            if (ehFechamento) {
            if (pilha.length && pilha[pilha.length - 1].nome === nome) {
              pilha.pop();
            } else {
              var indiceCorrespondente = -1;
              for (var i = pilha.length - 1; i >= 0; i--) {
                if (pilha[i].nome === nome) { indiceCorrespondente = i; break; }
              }
              if (indiceCorrespondente === -1) {
                var anotacaoFechamentoInesperado = anotacaoPorIndice(codigo, match.index, TAGS_VAZIAS.indexOf(nome) !== -1 ? '</' + nome + '> não é permitido: <' + nome + '> não possui fechamento.' : 'Tag de fechamento inesperada: </' + nome + '>');
                anotacaoFechamentoInesperado.__fimColuna = anotacaoFechamentoInesperado.column + match[0].length;
                anotacoes.push(anotacaoFechamentoInesperado);
              } else {
                for (var j = pilha.length - 1; j > indiceCorrespondente; j--) {
                  var itemNaoFechado = pilha[j];
                  var itemAnterior = pilha[j - 1];
                  var conteudoEntreTags = itemAnterior && codigo.slice(itemAnterior.indice + itemAnterior.comprimento, itemNaoFechado.indice);
                  var pareceFechamentoSemBarra = itemAnterior && j - 1 > indiceCorrespondente &&
                    itemAnterior.nome === itemNaoFechado.nome &&
                    conteudoEntreTags && !/<|>/.test(conteudoEntreTags) && /\S/.test(conteudoEntreTags);
                  if (pareceFechamentoSemBarra) {
                    var anotacaoBarraAusente = anotacaoPorIndice(codigo, itemNaoFechado.indice, 'Esta tag parece ser um fechamento de <' + itemNaoFechado.nome + '>, mas está faltando "/".');
                    anotacaoBarraAusente.__fimColuna = anotacaoBarraAusente.column + itemNaoFechado.comprimento;
                    anotacaoBarraAusente.code = 'coding-loop:html-transformar-fechamento:' + itemNaoFechado.nome;
                    anotacoes.push(anotacaoBarraAusente);
                    j--;
                    continue;
                  }
                  var anotacaoFechamento = anotacaoPorIndice(codigo, pilha[j].indice, 'A tag <' + pilha[j].nome + '> deve ser fechada antes de </' + nome + '>.');
                  anotacaoFechamento.__fimColuna = anotacaoFechamento.column + pilha[j].nome.length + 2;
                  anotacaoFechamento.code = 'coding-loop:html-fechar-antes:' + pilha[j].nome + ':' + nome;
                  anotacoes.push(anotacaoFechamento);
                }
                pilha.length = indiceCorrespondente;
              }
            }
            } else if (!autoFechada) {
              var pai = pilha.length ? pilha[pilha.length - 1].nome : null;
              if (pai && ANINHAMENTO_PROIBIDO[pai] && ANINHAMENTO_PROIBIDO[pai].indexOf(nome) !== -1) {
                var anotacaoAninhamento = anotacaoPorIndice(codigo, match.index, '<' + nome + '> não pode ficar dentro de <' + pai + '>.');
                anotacaoAninhamento.__fimColuna = anotacaoAninhamento.column + match[0].length;
                anotacoes.push(anotacaoAninhamento);
              }
              pilha.push({ nome: nome, indice: match.index, comprimento: match[0].length });
            }
          }

          var itensResolvidosComoBarraAusente = {};
          for (var indicePilha = pilha.length - 1; indicePilha > 0; indicePilha--) {
            var itemFinal = pilha[indicePilha];
            var itemFinalAnterior = pilha[indicePilha - 1];
            var textoEntreFinais = codigo.slice(itemFinalAnterior.indice + itemFinalAnterior.comprimento, itemFinal.indice);
            if (itemFinal.nome === itemFinalAnterior.nome && !/<|>/.test(textoEntreFinais) && /\S/.test(textoEntreFinais)) {
              var anotacaoBarraFinal = anotacaoPorIndice(codigo, itemFinal.indice, 'Esta tag parece ser um fechamento de <' + itemFinal.nome + '>, mas está faltando "/".');
              anotacaoBarraFinal.__fimColuna = anotacaoBarraFinal.column + itemFinal.comprimento;
              anotacaoBarraFinal.code = 'coding-loop:html-transformar-fechamento:' + itemFinal.nome;
              anotacoes.push(anotacaoBarraFinal);
              itensResolvidosComoBarraAusente[indicePilha] = true;
              itensResolvidosComoBarraAusente[indicePilha - 1] = true;
              indicePilha--;
            }
          }

          pilha.forEach(function (item, indiceItem) {
            if (itensResolvidosComoBarraAusente[indiceItem]) return;
            var anotacaoAberta = anotacaoPorIndice(codigo, item.indice, 'A tag <' + item.nome + '> foi aberta mas não foi fechada.');
            anotacaoAberta.__fimColuna = anotacaoAberta.column + item.nome.length + 2;
            anotacaoAberta.code = 'coding-loop:html-fechar:' + item.nome;
            anotacoes.push(anotacaoAberta);
          });

          var idsVistos = {};
          var regexId = /\bid\s*=\s*["']([^"']+)["']/g;
          while ((match = regexId.exec(codigo)) !== null) {
            var idAtual = match[1];
            if (idsVistos[idAtual] !== undefined) {
              var anotacaoIdDuplicado = anotacaoPorIndice(codigo, match.index, 'id="' + idAtual + '" já foi usado antes — ids devem ser únicos.', 'warning');
              anotacaoIdDuplicado.__fimColuna = anotacaoIdDuplicado.column + match[0].length;
              anotacoes.push(anotacaoIdDuplicado);
            } else {
              idsVistos[idAtual] = match.index;
            }
          }

          // A expressão principal só encontra tags que já possuem ">". Este
          // segundo passe cobre tags interrompidas no fim da linha/arquivo.
          var codigoSemTagsCompletas = codigo.replace(regexTag, function (tagCompleta) {
            return tagCompleta.replace(/[^\n]/g, ' ');
          });
          var tagIncompleta = /<\/?([a-zA-Z][\w:-]*)[^<>\n]*$/gm;
          while ((match = tagIncompleta.exec(codigoSemTagsCompletas)) !== null) {
            var trechoIncompleto = codigoOriginal.slice(match.index, match.index + match[0].length);
            var aspasDuplas = (trechoIncompleto.match(/"/g) || []).length;
            var aspasSimples = (trechoIncompleto.match(/'/g) || []).length;
            var aspasAbertas = aspasDuplas % 2 !== 0 || aspasSimples % 2 !== 0;
            var anotacaoIncompleta = anotacaoPorIndice(
              codigoOriginal,
              match.index,
              aspasAbertas ? 'Há uma aspa de atributo HTML sem fechamento.' : 'Tag HTML incompleta: está faltando ">".'
            );
            anotacaoIncompleta.__fimColuna = anotacaoIncompleta.column + Math.max(1, match[0].length);
            if (!aspasAbertas) anotacaoIncompleta.code = 'coding-loop:html-completar-tag';
            anotacoes.push(anotacaoIncompleta);
          }

          return anotacoes;
        }

        function tipoDaAnotacao(a) {
          return a.type === 'warning' ? 'warning' : (a.type === 'hint' ? 'hint' : (a.type === 'info' ? 'info' : 'error'));
        }

        function atualizarBadge(tipo, anotacoes) {
          var linguagensPorTipo = { html: ['html'], css: ['css'], js: ['javascript'] };
          var arquivo = arquivosExtras.find(function (item) {
            return (linguagensPorTipo[tipo] || []).indexOf(item.linguagem) >= 0;
          });
          var aba = arquivo
            ? document.querySelector('.code-tab[data-target="' + arquivo.idPane + '"]')
            : document.querySelector('.code-tab[data-target="' + tipo + '-pane"]');
          if (!aba) return;
          var erros = anotacoes.filter(function (a) { return tipoDaAnotacao(a) === 'error'; }).length;
          var avisos = anotacoes.filter(function (a) { return tipoDaAnotacao(a) === 'warning'; }).length;
          var infos = anotacoes.filter(function (a) { return tipoDaAnotacao(a) === 'info'; }).length;
          var dicas = anotacoes.filter(function (a) { return tipoDaAnotacao(a) === 'hint'; }).length;
          var total = anotacoes.length;
          var severidade = erros ? 'error' : (avisos ? 'warning' : (infos ? 'info' : 'hint'));
          aba.classList.toggle('tem-erro', total > 0);
          aba.classList.toggle('erro-warning', total > 0 && severidade === 'warning');
          aba.classList.toggle('erro-info', total > 0 && severidade === 'info');
          aba.classList.toggle('erro-hint', total > 0 && severidade === 'hint');
          var texto = total ? total + ' diagnóstico' + (total === 1 ? '' : 's') + ': ' + erros + ' erro(s), ' + avisos + ' aviso(s), ' + infos + ' informação(ões), ' + dicas + ' dica(s)' : 'Sem diagnósticos';
          var rotulo = aba.querySelector('.tab-text');
          if (rotulo) rotulo.setAttribute('data-diagnostic-count', total ? String(total) : '');
          aba.setAttribute('title', texto);
          aba.setAttribute('aria-label', tipo.toUpperCase() + '. ' + texto);
        }

        function atualizarBadgeDoArquivo(arquivo, anotacoes) {
          var aba = document.querySelector('.code-tab[data-target="' + arquivo.idPane + '"]');
          if (!aba) return;
          var erros = anotacoes.filter(function (item) { return tipoDaAnotacao(item) === 'error'; }).length;
          var avisos = anotacoes.filter(function (item) { return tipoDaAnotacao(item) === 'warning'; }).length;
          var total = anotacoes.length;
          var infos = anotacoes.filter(function (item) { return tipoDaAnotacao(item) === 'info'; }).length;
          var dicas = anotacoes.filter(function (item) { return tipoDaAnotacao(item) === 'hint'; }).length;
          var severidade = erros ? 'error' : (avisos ? 'warning' : (infos ? 'info' : 'hint'));
          aba.classList.toggle('tem-erro', total > 0);
          aba.classList.toggle('erro-warning', total > 0 && severidade === 'warning');
          aba.classList.toggle('erro-info', total > 0 && severidade === 'info');
          aba.classList.toggle('erro-hint', total > 0 && severidade === 'hint');
          var rotulo = aba.querySelector('.tab-text');
          if (rotulo) rotulo.setAttribute('data-diagnostic-count', total ? String(total) : '');
          var texto = total ? total + ' diagnóstico' + (total === 1 ? '' : 's') : 'Sem diagnósticos';
          aba.setAttribute('title', texto);
          aba.setAttribute('aria-label', arquivo.nome + '. ' + texto);
        }

        function anotacaoPorIndice(codigo, indice, texto, tipo) {
          var antes = codigo.slice(0, Math.max(0, indice));
          return { row: antes.split('\n').length - 1, column: antes.length - (antes.lastIndexOf('\n') + 1), text: texto, type: tipo || 'error' };
        }

        function indicePorLinhaEColuna(codigo, linha, coluna) {
          var linhas = codigo.split('\n');
          var numeroDaLinha = Math.max(1, Number(linha) || 1);
          var numeroDaColuna = Math.max(1, Number(coluna) || 1);
          var indice = 0;
          for (var i = 1; i < numeroDaLinha && i <= linhas.length; i++) indice += linhas[i - 1].length + 1;
          return Math.min(codigo.length, indice + Math.min(numeroDaColuna - 1, (linhas[numeroDaLinha - 1] || '').length));
        }

        function indiceDoErroXml(codigo, mensagemDeErro) {
          var texto = String(mensagemDeErro || '');
          var coordenadas = texto.match(/(?:line|linha|line number)\s*[:#]?\s*(\d+)\s*(?:(?:,|:|\s)+|(?:\s+at\s+))(?:column|coluna)\s*[:#]?\s*(\d+)/i)
            || texto.match(/(?:at|em)\s+(?:line|linha)?\s*(\d+)\s*[:;,]\s*(\d+)/i)
            || texto.match(/(\d+)\s*:\s*(\d+)/);
          if (coordenadas) return indicePorLinhaEColuna(codigo, coordenadas[1], coordenadas[2]);
          return -1;
        }

        // O último ponto e vírgula de um bloco é opcional para o CSS, mas
        // exigimos essa convenção na IDE para deixar os exercícios uniformes
        // e evitar erros quando uma nova declaração for acrescentada depois.
        function verificarPontoEVirgulaFinalCSS(codigo) {
          var anotacoes = [];
          var semComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, function (comentario) {
            return comentario.replace(/[^\n]/g, ' ');
          });
          var bloco;
          var regexBloco = /\{([^{}]*)\}/g;
          while ((bloco = regexBloco.exec(semComentarios)) !== null) {
            var conteudo = bloco[1].trim();
            if (conteudo && /(?:^|\s)[-\w]+\s*:/.test(conteudo) && !/;\s*$/.test(conteudo)) {
              var inicioConteudo = bloco.index + 1;
              var fimConteudo = inicioConteudo + bloco[1].length;
              var ultimoCaractere = fimConteudo - 1;
              while (ultimoCaractere >= inicioConteudo && /\s/.test(codigo.charAt(ultimoCaractere))) ultimoCaractere--;
              var anotacao = anotacaoPorIndice(codigo, Math.max(inicioConteudo, ultimoCaractere), 'Finalize a declaração CSS com ";" antes de fechar o bloco.');
              anotacao.__fimColuna = anotacao.column + 1;
              anotacao.code = 'coding-loop:semicolon';
              anotacoes.push(anotacao);
            }
          }
          return anotacoes;
        }

        function validarArquivoDinamico(arquivo) {
          var codigo = arquivo.editor.getValue();
          var anotacoes = [];
          if (arquivo.linguagem === 'html') anotacoes = verificarErrosHTML(codigo);
          else if (arquivo.linguagem === 'css' || arquivo.linguagem === 'scss') anotacoes = verificarPontoEVirgulaFinalCSS(codigo);
          else if ((arquivo.linguagem === 'xml' || arquivo.linguagem === 'svg') && codigo.trim()) {
            var documento = new DOMParser().parseFromString(codigo, 'application/xml');
            var erroXml = documento.querySelector('parsererror');
            if (erroXml) {
              var mensagemXmlOriginal = erroXml.textContent || '';
              var textoErroXml = mensagemXmlOriginal.replace(/\s+/g, ' ').trim();
              var indiceErroXml = indiceDoErroXml(codigo, mensagemXmlOriginal);
              var anotacaoXml = anotacaoPorIndice(codigo, Math.max(0, indiceErroXml), 'XML/SVG inválido: ' + textoErroXml + (indiceErroXml < 0 ? ' O analisador não informou a posição exata.' : ''));
              if (indiceErroXml < 0) anotacaoXml.__semLocalizacao = true;
              anotacoes.push(anotacaoXml);
            }
          } else if (arquivo.linguagem === 'markdown') {
            var linkIncompleto = /\[[^\]\n]*\](?!\s*\()/g;
            var linkEncontrado;
            while ((linkEncontrado = linkIncompleto.exec(codigo)) !== null) {
              var anotacaoLink = anotacaoPorIndice(codigo, linkEncontrado.index, 'Link Markdown incompleto. Use [texto](endereço).', 'warning');
              anotacaoLink.__fimColuna = anotacaoLink.column + linkEncontrado[0].length;
              anotacoes.push(anotacaoLink);
            }
            var destinoIncompleto = /!?\[[^\]\n]*\]\([^)\n]*$/gm;
            while ((linkEncontrado = destinoIncompleto.exec(codigo)) !== null) {
              var anotacaoDestino = anotacaoPorIndice(codigo, linkEncontrado.index, 'O endereço do link ou imagem Markdown precisa terminar com ")".', 'warning');
              anotacaoDestino.__fimColuna = anotacaoDestino.column + linkEncontrado[0].length;
              anotacoes.push(anotacaoDestino);
            }
            var rotuloIncompleto = /!?\[[^\]\n]*$/gm;
            while ((linkEncontrado = rotuloIncompleto.exec(codigo)) !== null) {
              var anotacaoRotulo = anotacaoPorIndice(codigo, linkEncontrado.index, 'O texto do link ou imagem Markdown precisa terminar com "]".', 'warning');
              anotacaoRotulo.__fimColuna = anotacaoRotulo.column + linkEncontrado[0].length;
              anotacoes.push(anotacaoRotulo);
            }
            var inicioDaLinha = 0;
            codigo.split('\n').forEach(function (linhaMarkdown) {
              var linhaSemCercaDeCodigo = linhaMarkdown.replace(/\`\`\`/g, '');
              var crases = (linhaSemCercaDeCodigo.match(/\`/g) || []).length;
              if (crases % 2 !== 0) {
                var anotacaoCrase = anotacaoPorIndice(codigo, inicioDaLinha + linhaMarkdown.lastIndexOf('\`'), 'Trecho de código Markdown sem crase de fechamento.', 'warning');
                anotacaoCrase.__fimColuna = anotacaoCrase.column + 1;
                anotacoes.push(anotacaoCrase);
              }
              var marcadoresNegrito = (linhaMarkdown.match(/\*\*/g) || []).length;
              if (marcadoresNegrito % 2 !== 0) {
                var anotacaoNegrito = anotacaoPorIndice(codigo, inicioDaLinha + linhaMarkdown.lastIndexOf('**'), 'Texto em negrito Markdown sem fechamento "**".', 'warning');
                anotacaoNegrito.__fimColuna = anotacaoNegrito.column + 2;
                anotacoes.push(anotacaoNegrito);
              }
              inicioDaLinha += linhaMarkdown.length + 1;
            });
          }
          // Erros do preview pertencem ao arquivo JavaScript visível e não
          // podem ser apagados pela validação normal do arquivo.
          var anotacoesDeExecucao = arquivo.linguagem === 'javascript'
            ? arquivo.editor.session.getAnnotations().filter(function (anotacao) { return anotacao.__execucao; })
            : [];
          var anotacoesDoArquivo = anotacoes.concat(anotacoesDeExecucao);
          arquivo.editor.session.setAnnotations(anotacoesDoArquivo);
          var anotacoesCompletas = anotacoesDoArquivo.concat(arquivo.editor.getNativeAnnotations());
          atualizarBadgeDoArquivo(arquivo, anotacoesCompletas);
        }

        function agendarValidacaoArquivo(arquivo) {
          clearTimeout(arquivo.validacaoTimeout);
          arquivo.validacaoTimeout = setTimeout(function () { validarArquivoDinamico(arquivo); }, 250);
        }

        function editorVisivelDoTipo(tipo) {
          var linguagensPorTipo = { html: ['html'], css: ['css'], js: ['javascript'] };
          var arquivo = arquivosExtras.find(function (item) {
            return (linguagensPorTipo[tipo] || []).indexOf(item.linguagem) >= 0;
          });
          return arquivo ? arquivo.editor : null;
        }

        // HTML, CSS, JSON e os avisos manuais são validados diretamente no
        // arquivo visível. Os modelos ocultos permanecem só para preservar o
        // formato de compatibilidade dos exercícios antigos.

        var anotacoesExecucaoJS = [];
        function arquivoVisivelDoTipo(tipo) {
          var linguagensPorTipo = { html: ['html'], css: ['css'], js: ['javascript'] };
          return arquivosExtras.find(function (arquivo) {
            return (linguagensPorTipo[tipo] || []).indexOf(arquivo.linguagem) >= 0;
          }) || null;
        }

        function mesclarAnotacoesExecucaoJS() {
          obterArquivosPorLinguagem(['javascript']).forEach(function (arquivo) {
            var estaticas = arquivo.editor.session.getAnnotations().filter(function (a) { return !a.__execucao; });
            var execucaoDesteArquivo = anotacoesExecucaoJS.filter(function (a) { return a.__idPane === arquivo.idPane; });
            arquivo.editor.session.setAnnotations(estaticas.concat(execucaoDesteArquivo));
          });
        }

        function finalizarAtualizacaoJS() {
          obterArquivosPorLinguagem(['javascript']).forEach(function (arquivo) {
            var anotacoes = arquivo.editor.session.getAnnotations().concat(arquivo.editor.getNativeAnnotations());
            atualizarBadgeDoArquivo(arquivo, anotacoes);
          });
        }

        window.addEventListener('ide:resize', function () {
          redimensionarEditores();
        });

        function alternarIcones(iconeExpandir, iconeRecolher, expandido) {
          iconeExpandir.style.display = expandido ? 'none' : 'block';
          iconeRecolher.style.display = expandido ? 'block' : 'none';
        }

        function escaparFechamentoScript(codigo) {
          return codigo.replace(/<\/script>/gi, '<\\/script>');
        }

        function removerIframePreview() {
          var antigoIframe = document.getElementById('preview-output');
          if (antigoIframe) antigoIframe.remove();
        }

        var offsetLinhaJSNoPreview = 0;
        var mapaLinhasJsPreview = [];

        function escaparHtmlParaPreview(texto) {
          return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function renderizarMarkdownBasico(markdown) {
          var html = escaparHtmlParaPreview(markdown);
          html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>').replace(/^##\s+(.+)$/gm, '<h2>$1</h2>').replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
          html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
          html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
          return html.split(/\n{2,}/).map(function (bloco) {
            return /^<h[1-3]>|^<ul>/.test(bloco) ? bloco : '<p>' + bloco.replace(/\n/g, '<br>') + '</p>';
          }).join('\n');
        }

        function obterArquivosPorLinguagem(linguagens) {
          var ordemDasAbas = obterAbasOrdenadas().map(function (aba) { return aba.getAttribute('data-target'); });
          return arquivosExtras.filter(function (arquivo) {
            return linguagens.indexOf(arquivo.linguagem) >= 0;
          }).sort(function (a, b) {
            return ordemDasAbas.indexOf(a.idPane) - ordemDasAbas.indexOf(b.idPane);
          });
        }

        // Fonte única de "código-fonte atual" por linguagem (html/css/js),
        // usada por window.obterCodigoAtualDoEditor e (quando ajustado)
        // salvarCodigoAgora. Mesma regra do preview (montarCodigoPreview):
        // concatena TODOS os arquivos da linguagem, não só o primeiro — o
        // espelho legado (htmlEditor/cssEditor/jsEditor) só reflete o
        // primeiro arquivo de cada linguagem (ver sincronizarArquivosPrincipais),
        // então usá-lo direto corta conteúdo silenciosamente em etapas com
        // múltiplos arquivos CSS/JS.
        function obterCodigoFonteAgregado() {
          var arquivosHtml = obterArquivosPorLinguagem(['html']);
          var arquivosCss = obterArquivosPorLinguagem(['css']);
          var arquivosJs = obterArquivosPorLinguagem(['javascript']);
          return {
            html: arquivosHtml.length ? arquivosHtml[0].editor.getValue() : htmlEditor.getValue(),
            css: arquivosCss.length ? arquivosCss.map(function (arquivo) { return arquivo.editor.getValue(); }).join('\n\n') : cssEditor.getValue(),
            js: arquivosJs.length ? arquivosJs.map(function (arquivo) { return arquivo.editor.getValue(); }).join('\n\n') : jsEditor.getValue()
          };
        }

        function montarCodigoPreview() {
          var arquivosHtml = obterArquivosPorLinguagem(['html']);
          var arquivosCss = obterArquivosPorLinguagem(['css']);
          var arquivosJs = obterArquivosPorLinguagem(['javascript']);
          var arquivosMarkdown = obterArquivosPorLinguagem(['markdown']);
          var arquivosSvg = obterArquivosPorLinguagem(['svg']);
          var html = arquivosHtml.length ? arquivosHtml[0].editor.getValue() : htmlEditor.getValue();
          var css = (arquivosCss.length ? arquivosCss.map(function (arquivo) { return arquivo.editor.getValue(); }).join('\n\n') : cssEditor.getValue());
          var linhaAcumuladaJs = 0;
          mapaLinhasJsPreview = [];
          var partesJs = arquivosJs.map(function (arquivo) {
            var conteudo = escaparFechamentoScript(arquivo.editor.getValue());
            var quantidadeLinhas = conteudo.split('\n').length;
            mapaLinhasJsPreview.push({
              arquivo: arquivo,
              inicio: linhaAcumuladaJs,
              fim: linhaAcumuladaJs + quantidadeLinhas - 1
            });
            linhaAcumuladaJs += quantidadeLinhas + 2;
            return conteudo;
          });
          var js = arquivosJs.length ? partesJs.join('\n\n') : escaparFechamentoScript(jsEditor.getValue());
          if (!html.trim() && arquivosMarkdown.length) html = '<main class="markdown-preview">' + renderizarMarkdownBasico(arquivosMarkdown[0].editor.getValue()) + '</main>';
          if (!html.trim() && arquivosSvg.length) html = arquivosSvg[0].editor.getValue();
          var estiloTemaPreview = previewTemaEscuro
            ? 'html, body { min-height: 100%; background-color: #002b36; color: #fdf6e3; color-scheme: dark; }'
            : 'html, body { min-height: 100%; background-color: #ffffff; color: #1f2933; color-scheme: light; }';

          var handlerErros =
            'window.addEventListener("error", function (e) {\n' +
            '  try { window.parent.postMessage({ tipo: "erro-execucao-js", mensagem: e.message, linha: e.lineno, coluna: e.colno }, "*"); } catch (err) {}\n' +
            '});\n' +
            'window.addEventListener("unhandledrejection", function (e) {\n' +
            '  try {\n' +
            '    var msg = (e.reason && e.reason.message) ? e.reason.message : String(e.reason);\n' +
            '    window.parent.postMessage({ tipo: "erro-execucao-js", mensagem: "Promise rejeitada: " + msg }, "*");\n' +
            '  } catch (err) {}\n' +
            '});\n';

          var prefixo = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<style>\n' + estiloTemaPreview + '\nbody { margin: 0; padding: 0 0 0 6px; }\n.markdown-preview { max-width: 860px; margin: 28px auto; padding: 0 20px; line-height: 1.55; } .markdown-preview code { padding: 2px 4px; border-radius: 3px; background: rgba(128,128,128,.18); }\n/* O CSS do projeto vem por último para ter precedência total. */\n' + css + '\n</style>\n</head>\n<body>\n' + html + '\n<script>\n' + handlerErros;

          offsetLinhaJSNoPreview = prefixo.split('\n').length - 1;

          return prefixo + js + '\n<' + '/script>\n</body>\n</html>';
        }

        function obterEditorPorTipo(tipo) {
          if (tipo === 'html') return htmlEditor;
          if (tipo === 'css') return cssEditor;
          if (tipo === 'js') return jsEditor;
          return null;
        }

        function renderizarPreview() {
          removerIframePreview();
          previewContainer.classList.toggle('preview-area--dark', previewTemaEscuro);

          clearTimeout(timeoutErrosExecucao);
          timeoutErrosExecucao = null;
          filaErrosExecucao = [];
          anotacoesExecucaoJS = [];
          mesclarAnotacoesExecucaoJS();
          finalizarAtualizacaoJS();

          var novoIframe = document.createElement('iframe');
          novoIframe.className = 'preview-iframe';
          novoIframe.classList.toggle('preview-iframe--dark', previewTemaEscuro);
          novoIframe.id = 'preview-output';
          novoIframe.title = 'Preview do código';
          novoIframe.setAttribute('sandbox', 'allow-scripts');
          previewContainer.appendChild(novoIframe);
          novoIframe.srcdoc = montarCodigoPreview();
        }

        var MAX_ANOTACOES_EXECUCAO = 20;
        var filaErrosExecucao = [];
        var timeoutErrosExecucao = null;

        function processarFilaErrosExecucao() {
          timeoutErrosExecucao = null;

          filaErrosExecucao.forEach(function (dado) {
            var linha = 0;
            var semLinha = true;
            var arquivoDoErro = null;
            if (typeof dado.linha === 'number' && dado.linha > 0) {
              var linhaNoCodigoConcatenado = Math.max(0, dado.linha - 1 - offsetLinhaJSNoPreview);
              var trecho = mapaLinhasJsPreview.find(function (item) {
                return linhaNoCodigoConcatenado >= item.inicio && linhaNoCodigoConcatenado <= item.fim;
              });
              if (trecho) {
                arquivoDoErro = trecho.arquivo;
                linha = linhaNoCodigoConcatenado - trecho.inicio;
                linha = Math.min(linha, Math.max(0, arquivoDoErro.editor.session.getLength() - 1));
                semLinha = false;
              }
            }
            if (!arquivoDoErro) arquivoDoErro = arquivoVisivelDoTipo('js');
            if (!arquivoDoErro) return;

            var chave = arquivoDoErro.idPane + '|' + (semLinha ? 'sem-linha' : linha) + '|' + dado.mensagem;
            var existente = anotacoesExecucaoJS.some(function (a) { return a.__chave === chave; });

            if (existente) return;

            if (anotacoesExecucaoJS.length >= MAX_ANOTACOES_EXECUCAO) return;

            anotacoesExecucaoJS.push({
              row: linha,
              column: (typeof dado.coluna === 'number' && dado.coluna > 0) ? dado.coluna - 1 : 0,
              text: 'Erro em execução: ' + dado.mensagem,
              type: 'error',
              __execucao: true,
              __semLinha: semLinha,
              __chave: chave,
              __idPane: arquivoDoErro.idPane
            });
          });

          filaErrosExecucao = [];
          mesclarAnotacoesExecucaoJS();
          finalizarAtualizacaoJS();
        }

        window.addEventListener('message', function (e) {
          if (!e.data || e.data.tipo !== 'erro-execucao-js') return;
          var iframeAtual = document.getElementById('preview-output');
          if (!iframeAtual || e.source !== iframeAtual.contentWindow) return;

          filaErrosExecucao.push({
            linha: e.data.linha,
            coluna: e.data.coluna,
            mensagem: String(e.data.mensagem || 'Erro desconhecido')
          });

          if (!timeoutErrosExecucao) {
            timeoutErrosExecucao = setTimeout(processarFilaErrosExecucao, 200);
          }
        });

        function atualizarJanela() {
          mainWindowContainer.classList.toggle('is-collapsed', !IDE_ABERTO);
          contentWrapper.classList.toggle('hide-entire-window', !IDE_ABERTO);
          btnIdeCollapse.classList.toggle('is-active', !IDE_ABERTO);
          btnIdeCollapse.setAttribute('aria-pressed', String(!IDE_ABERTO));

          if (learningPlatformRoot) {
            learningPlatformRoot.classList.toggle('ide-recolhido', !IDE_ABERTO);
          }

          if (!IDE_ABERTO && mainWindowContainer.classList.contains('is-fullscreen')) {
            mainWindowContainer.classList.remove('is-fullscreen');
            document.body.classList.remove('ide-fullscreen-lock');

            if (irmaoOriginal && irmaoOriginal.parentNode === paiOriginal) {
              paiOriginal.insertBefore(mainWindowContainer, irmaoOriginal);
            } else {
              paiOriginal.appendChild(mainWindowContainer);
            }
            alternarIcones(iconMaximize, iconMinimize, false);
            btnMaximizeToggle.setAttribute('aria-pressed', 'false');
          }

          setTimeout(redimensionarEditores, 50);
        }

        function abrirJanela() {
          if (!IDE_ABERTO) {
            IDE_ABERTO = true;
            atualizarJanela();
          }
        }

        function definirPreviewMaximizado(maximizado) {
          prefPreviewMaximized = maximizado;
          contentWrapper.classList.toggle('preview-maximized', maximizado);
          btnPreviewMaximize.classList.toggle('is-active', maximizado);
          btnPreviewMaximize.setAttribute('aria-pressed', String(maximizado));
          alternarIcones(iconPreviewMax, iconPreviewRestore, maximizado);
        }

        function sincronizarPreviewComAbas(quantidadeAbasAtivas) {
          if (!chkTogglePreview.checked || !previewContainer.classList.contains('show-preview')) return;
          definirPreviewMaximizado(quantidadeAbasAtivas === 0);
        }

        function mostrarPreview() {
          abrirJanela();
          chkTogglePreview.checked = true;
          btnRun.classList.add('active');
          contentWrapper.classList.add('with-preview');
          previewContainer.classList.add('show-preview');

          contentWrapper.classList.toggle('preview-vertical', prefPreviewVertical);
          btnPreviewLayout.classList.toggle('is-active', prefPreviewVertical);
          btnPreviewLayout.setAttribute('aria-pressed', String(prefPreviewVertical));

          contentWrapper.classList.toggle('preview-maximized', prefPreviewMaximized);
          btnPreviewMaximize.classList.toggle('is-active', prefPreviewMaximized);
          btnPreviewMaximize.setAttribute('aria-pressed', String(prefPreviewMaximized));
          alternarIcones(iconPreviewMax, iconPreviewRestore, prefPreviewMaximized);

          // Sem editores visíveis, o preview passa a ocupar toda a área.
          sincronizarPreviewComAbas(obterAbasOrdenadas().filter(function (aba) {
            return aba.querySelector('.editor-toggle-checkbox').checked;
          }).length);

          renderizarPreview();
          limparTamanhosDosPaineis();
          configurarRedimensionadores();
          setTimeout(redimensionarEditores, 50);
        }

        function fecharPreview() {
          chkTogglePreview.checked = false;
          btnRun.classList.remove('active');
          removerIframePreview();
          previewContainer.classList.remove('show-preview');
          contentWrapper.classList.remove('with-preview');

          contentWrapper.classList.remove('preview-maximized');
          contentWrapper.classList.remove('preview-vertical');
          alternarIcones(iconPreviewMax, iconPreviewRestore, false);
          btnPreviewMaximize.classList.remove('is-active');
          btnPreviewMaximize.setAttribute('aria-pressed', 'false');
          btnPreviewLayout.classList.remove('is-active');
          btnPreviewLayout.setAttribute('aria-pressed', 'false');
          limparTamanhosDosPaineis();
          configurarRedimensionadores();
          setTimeout(redimensionarEditores, 50);
        }

        function agendarAtualizacaoPreview() {
          if (!IDE_ABERTO || !chkTogglePreview.checked || !previewContainer.classList.contains('show-preview')) return;
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(renderizarPreview, 300);
        }

        function obterAbasOrdenadas() {
          return Array.prototype.slice.call(dragContainer.querySelectorAll('.code-tab'));
        }

        function abaEstaAtiva(idPane) {
          var aba = dragContainer.querySelector('.code-tab[data-target="' + idPane + '"]');
          var checkbox = aba && aba.querySelector('.editor-toggle-checkbox');
          return Boolean(checkbox && checkbox.checked);
        }

        function registrarAbaDeArquivo(aba, checkbox, botaoFechar) {
          checkbox.addEventListener('change', function () {
            abrirJanela();
            atualizarLayoutAbas();
          });
          aba.addEventListener('click', function (e) {
            if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          });
          if (botaoFechar) {
            botaoFechar.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              var idPane = aba.getAttribute('data-target');
              var indice = arquivosExtras.findIndex(function (arquivo) { return arquivo.idPane === idPane; });
              if (indice >= 0) {
                var arquivoFechado = arquivosExtras[indice];
                clearTimeout(arquivoFechado.validacaoTimeout);
                if (arquivoFechado.layoutFrame) cancelAnimationFrame(arquivoFechado.layoutFrame);
                arquivoFechado.editor.dispose();
                arquivosExtras.splice(indice, 1);
                anotacoesExecucaoJS = anotacoesExecucaoJS.filter(function (anotacao) { return anotacao.__idPane !== arquivoFechado.idPane; });
                mapaLinhasJsPreview = mapaLinhasJsPreview.filter(function (trecho) { return trecho.arquivo !== arquivoFechado; });
                if (editorAtivoParaHistorico === arquivoFechado.editor) {
                  editorAtivoParaHistorico = arquivosExtras.length ? arquivosExtras[Math.min(indice, arquivosExtras.length - 1)].editor : htmlEditor;
                  atualizarControlesHistorico();
                }
              }
              var painel = document.getElementById(idPane);
              if (painel) painel.remove();
              aba.remove();
              sincronizarArquivosPrincipais();
              atualizarLayoutAbas();
              agendarAtualizacaoPreview();
              agendarSalvamentoAutomatico();
            });
          }
        }

        function sincronizarArquivosPrincipais() {
          var principal = function (linguagens) {
            return arquivosExtras.find(function (arquivo) { return linguagens.indexOf(arquivo.linguagem) >= 0; });
          };
          var html = principal(['html']);
          var css = principal(['css']);
          var js = principal(['javascript']);
          if (htmlEditor.getValue() !== (html ? html.editor.getValue() : '')) htmlEditor.setValue(html ? html.editor.getValue() : '', -1);
          if (cssEditor.getValue() !== (css ? css.editor.getValue() : '')) cssEditor.setValue(css ? css.editor.getValue() : '', -1);
          if (jsEditor.getValue() !== (js ? js.editor.getValue() : '')) jsEditor.setValue(js ? js.editor.getValue() : '', -1);
        }

        function linguagemDoArquivo(nome) {
          var extensao = (nome.match(/\.([a-z0-9]+)$/i) || [])[1];
          var linguagens = { html: 'html', htm: 'html', css: 'css', scss: 'scss', js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', jsx: 'javascriptreact', svg: 'svg', json: 'json', xml: 'xml', md: 'markdown', markdown: 'markdown' };
          return linguagens[String(extensao || '').toLowerCase()] || null;
        }

        function nomeUnicoDoArquivo(nomeDesejado) {
          var nome = String(nomeDesejado || 'arquivo.txt').replace(/\\/g, '/');
          var existe = function (candidato) {
            return arquivosExtras.some(function (arquivo) { return arquivo.nome.toLowerCase() === candidato.toLowerCase(); });
          };
          if (!existe(nome)) return nome;
          var partes = nome.match(/^(.*?)(\.[^./]+)?$/);
          var base = partes && partes[1] ? partes[1] : nome;
          var extensao = partes && partes[2] ? partes[2] : '';
          var numero = 2;
          while (existe(base + '-' + numero + extensao)) numero++;
          return base + '-' + numero + extensao;
        }

        function referenciasLocaisDoArquivo(arquivo) {
          var codigo = arquivo.editor.getValue();
          var referencias = [];
          var adicionar = function (caminho) {
            caminho = String(caminho || '').replace(/[?#].*$/, '').trim();
            if (!caminho || /^(?:https?:|\/\/|data:|#|mailto:|tel:)/i.test(caminho) || caminho.indexOf('..') === 0) return;
            var nome = caminho.replace(/^\.\//, '').replace(/^\/+/, '');
            if (nome && linguagemDoArquivo(nome)) referencias.push(nome);
          };
          if (arquivo.linguagem === 'html') {
            (codigo.match(/<(?:link|script|img|object|iframe)\b[^>]*(?:href|src)\s*=\s*["'][^"']+["'][^>]*>/gi) || []).forEach(function (tag) {
              var atributo = tag.match(/(?:href|src)\s*=\s*["']([^"']+)["']/i);
              if (atributo) adicionar(atributo[1]);
            });
          } else if (arquivo.linguagem === 'css' || arquivo.linguagem === 'scss') {
            var importacaoCss = /@(?:import|use|forward)\s+(?:url\(\s*)?["']([^"']+)["']/gi;
            var achadoCss;
            while ((achadoCss = importacaoCss.exec(codigo)) !== null) adicionar(achadoCss[1]);
          } else if (['javascript', 'typescript', 'javascriptreact'].indexOf(arquivo.linguagem) >= 0) {
            var importacaoJs = /(?:\bfrom\s*|\bimport\s*\(|\bimport\s+|\bfetch\s*\()\s*["']([^"']+)["']/gi;
            var achadoJs;
            while ((achadoJs = importacaoJs.exec(codigo)) !== null) adicionar(achadoJs[1]);
          } else if (['svg', 'xml', 'markdown'].indexOf(arquivo.linguagem) >= 0) {
            var referenciaGenerica = /(?:href|src)\s*=\s*["']([^"']+)["']|!?\[[^\]]*\]\(([^)]+)\)/gi;
            var achadoGenerico;
            while ((achadoGenerico = referenciaGenerica.exec(codigo)) !== null) adicionar(achadoGenerico[1] || achadoGenerico[2]);
          }
          return referencias.filter(function (nome, indice) { return referencias.indexOf(nome) === indice; });
        }

        function sincronizarDependenciasLocais() {
          var referencias = [];
          arquivosExtras.slice().forEach(function (arquivo) {
            referencias = referencias.concat(referenciasLocaisDoArquivo(arquivo));
          });
          referencias.filter(function (nome, indice) { return referencias.indexOf(nome) === indice; }).forEach(function (nome) {
            var existe = arquivosExtras.some(function (arquivo) { return arquivo.nome.toLowerCase() === nome.toLowerCase(); });
            var linguagem = linguagemDoArquivo(nome);
            if (!existe && linguagem) criarArquivoExtra(linguagem, nome, '');
          });
        }

        function criarArquivoExtra(linguagem, nome, conteudo) {
          var extensoes = { svg: 'svg', markdown: 'md', json: 'json', xml: 'xml', typescript: 'ts', scss: 'scss', javascriptreact: 'jsx', html: 'html', css: 'css', javascript: 'js' };
          var sufixo = extensoes[linguagem] || 'txt';
          var identificador = 'arquivo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
          var idPane = identificador + '-pane';
          var nomeArquivo = nomeUnicoDoArquivo(nome || ('novo-arquivo.' + sufixo));
          var aba = document.createElement('div');
          aba.className = 'tab-btn code-tab';
          aba.setAttribute('data-target', idPane);
          aba.draggable = true;
          aba.innerHTML = '<input checked class="editor-toggle-checkbox" type="checkbox"><span class="tab-text"></span><span class="file-tab-actions"><button aria-label="Limpar conteúdo deste arquivo" class="tab-action-btn file-clear-btn" draggable="false" title="Limpar arquivo" type="button"><img alt="" class="file-action-icon file-clear-icon" src="assets/images/icons.svg/lixeira.svg"></button><button aria-label="Fechar arquivo" class="tab-action-btn file-close-btn" draggable="false" title="Fechar arquivo" type="button">×</button></span>';
          var rotulos = { html: 'HTML', css: 'CSS', javascript: 'JavaScript', svg: 'SVG', markdown: 'Markdown', json: 'JSON', xml: 'XML', typescript: 'TypeScript', scss: 'SCSS', javascriptreact: 'JSX' };
          aba.querySelector('.tab-text').textContent = rotulos[linguagem] || linguagem.toUpperCase();
          aba.setAttribute('aria-label', nomeArquivo);
          dragContainer.appendChild(aba);

          var painel = document.createElement('div');
          painel.className = 'tab-pane';
          painel.id = idPane;
          var container = document.createElement('div');
          container.className = 'code-editor-container';
          container.id = identificador + '-editor';
          painel.appendChild(container);
          editorsContainer.appendChild(painel);

          var arquivo = { idPane: idPane, nome: nomeArquivo, linguagem: linguagem, editor: criarEditor(container.id, linguagem, conteudo || '', nomeArquivo) };
          arquivosExtras.push(arquivo);
          registrarAbaDeArquivo(aba, aba.querySelector('.editor-toggle-checkbox'), aba.querySelector('.file-close-btn'));
          aba.querySelector('.file-clear-btn').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (!window.confirm('Deseja limpar o conteúdo de ' + arquivo.nome + '?')) return;
            arquivo.editor.setValue('', -1);
            arquivo.editor.focus();
            mostrarToast(arquivo.nome + ' foi limpo.');
          });
          arquivo.editor.on('change', function () {
            sincronizarArquivosPrincipais();
            sincronizarDependenciasLocais();
            agendarValidacaoArquivo(arquivo);
            agendarAtualizacaoPreview();
            if (!carregandoCodigoDaEtapa) agendarSalvamentoAutomatico();
          });
          arquivo.editor.on('focus', function () {
            editorAtivoParaHistorico = arquivo.editor;
            atualizarControlesHistorico();
          });
          arquivo.editor.session.on('change', function () {
            atualizarControlesHistorico();
          });
          arquivo.editor.aoAtualizarMarcadores = function (editor) {
            var anotacoesCompletas = editor.session.getAnnotations().concat(editor.getNativeAnnotations());
            atualizarBadgeDoArquivo(arquivo, anotacoesCompletas);
          };
          arquivo.ouvinteMarcadoresNativos = arquivo.editor.ouvinteMarcadoresNativos;
          atualizarLayoutAbas();
          // O container acabou de deixar o estado display:none. Forçar o
          // layout imediatamente impede que decorations e hovers do Monaco
          // usem as dimensões 0×0 calculadas durante a criação da aba.
          arquivo.layoutFrame = requestAnimationFrame(function () {
            arquivo.layoutFrame = null;
            arquivo.editor.resize();
          });
          sincronizarArquivosPrincipais();
          if (!carregandoCodigoDaEtapa) sincronizarDependenciasLocais();
          agendarValidacaoArquivo(arquivo);
          arquivo.editor.focus();
          if (!carregandoCodigoDaEtapa) agendarSalvamentoAutomatico();
        }

        function atualizarLayoutAbas() {
          var idsAtivos = [];
          obterAbasOrdenadas().forEach(function (aba) {
            var target = aba.getAttribute('data-target');
            var ativa = abaEstaAtiva(target);
            aba.classList.toggle('active', ativa);
            if (ativa) idsAtivos.push(target);
          });

          editorsContainer.classList.remove('split-2', 'split-3');
          Array.prototype.slice.call(editorsContainer.querySelectorAll('.tab-pane')).forEach(function (pane) {
            pane.classList.remove('show-pane');
          });

          idsAtivos.forEach(function (idPane) {
            var pane = document.getElementById(idPane);
            if (pane) {
              editorsContainer.appendChild(pane);
              pane.classList.add('show-pane');
            }
          });

          if (idsAtivos.length === 2) editorsContainer.classList.add('split-2');
          if (idsAtivos.length === 3) editorsContainer.classList.add('split-3');

          contentWrapper.classList.toggle('no-tabs-active', idsAtivos.length === 0);
          sincronizarPreviewComAbas(idsAtivos.length);

          limparTamanhosDosPaineis();
          configurarRedimensionadores();
          setTimeout(redimensionarEditores, 50);
        }

        [htmlEditor, cssEditor, jsEditor].forEach(function (editor) {
          editor.on('change', agendarAtualizacaoPreview);
          editor.on('change', function () {
            if (!carregandoCodigoDaEtapa) {
              marcarComoNaoSalvo();
              agendarSalvamentoAutomatico();
            }
          });
        });

        btnIdeCollapse.addEventListener('click', function () {
          IDE_ABERTO = !IDE_ABERTO;
          atualizarJanela();
          if (IDE_ABERTO) atualizarLayoutAbas();
        });

        [chkToggleHtml, chkToggleCss, chkToggleJs].filter(Boolean).forEach(function (checkbox) {
          checkbox.addEventListener('change', function () {
            abrirJanela();
            atualizarLayoutAbas();
          });
        });

        Array.prototype.slice.call(document.querySelectorAll('.code-tab')).forEach(function (aba) {
          aba.addEventListener('click', function (e) {
            if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
            var checkbox = aba.querySelector('.editor-toggle-checkbox');
            if (checkbox) {
              checkbox.checked = !checkbox.checked;
              checkbox.dispatchEvent(new Event('change'));
            }
          });
        });

        Array.prototype.slice.call(document.querySelectorAll('.clear-editor-btn')).forEach(function (botao) {
          botao.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var editor = obterEditorPorTipo(botao.getAttribute('data-editor'));
            if (editor && window.confirm('Deseja limpar este editor?')) {
              editor.setValue('', -1);
              agendarAtualizacaoPreview();
            }
          });
        });

        function separarCodigoImportado(conteudo) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(conteudo, 'text/html');

          var css = Array.prototype.map.call(doc.querySelectorAll('style'), function (el) {
            return el.textContent;
          }).join('\n\n').trim();

          var js = Array.prototype.map.call(doc.querySelectorAll('script:not([src])'), function (el) {
            return el.textContent;
          }).join('\n\n').trim();

          Array.prototype.forEach.call(doc.querySelectorAll('style, script:not([src])'), function (el) {
            el.remove();
          });

          var html = (doc.body ? doc.body.innerHTML : conteudo).trim();

          return { html: html, css: css, js: js };
        }

        function importarNoEditorDaLinguagem(linguagem, nome, conteudo) {
          var arquivoExistente = arquivosExtras.find(function (arquivo) { return arquivo.linguagem === linguagem; });
          if (arquivoExistente) {
            arquivoExistente.editor.setValue(conteudo, -1);
            return arquivoExistente;
          }
          criarArquivoExtra(linguagem, nome, conteudo);
          return arquivosExtras[arquivosExtras.length - 1];
        }

        function importarArquivoPorTipo(file, conteudo) {
          var linguagem = linguagemDoArquivo(file.name);
          if (linguagem === 'html') {
            var partes = separarCodigoImportado(conteudo);
            importarNoEditorDaLinguagem('html', file.name, partes.html);
            if (partes.css) importarNoEditorDaLinguagem('css', 'style.css', partes.css);
            if (partes.js) importarNoEditorDaLinguagem('javascript', 'script.js', partes.js);
            return partes.css || partes.js
              ? 'HTML, CSS e JavaScript importados nos editores correspondentes.'
              : 'HTML importado no editor HTML.';
          }
          if (linguagem) {
            importarNoEditorDaLinguagem(linguagem, file.name, conteudo);
            return file.name + ' importado no editor ' + linguagem.toUpperCase() + '.';
          }
          var partesDesconhecidas = separarCodigoImportado(conteudo);
          importarNoEditorDaLinguagem('html', file.name, partesDesconhecidas.html);
          if (partesDesconhecidas.css) importarNoEditorDaLinguagem('css', 'style.css', partesDesconhecidas.css);
          if (partesDesconhecidas.js) importarNoEditorDaLinguagem('javascript', 'script.js', partesDesconhecidas.js);
          return 'Código importado e distribuído entre HTML, CSS e JavaScript.';
        }

        if (btnImportFile) btnImportFile.addEventListener('click', function () { inputImportFile.click(); });
        inputImportFile.addEventListener('change', function () {
          var file = inputImportFile.files[0];
          if (!file) {
            return;
          }
          var reader = new FileReader();
          reader.onload = function () {
            var conteudo = String(reader.result || '');
            var mensagemImportacao = importarArquivoPorTipo(file, conteudo);
            mostrarToast(mensagemImportacao);

            abrirJanela();
            atualizarLayoutAbas();
            agendarAtualizacaoPreview();
            if (!mensagemImportacao) mostrarToast('Arquivo importado.');
          };
          reader.readAsText(file);
          inputImportFile.value = '';
        });

        function baixarArquivo(conteudo, nome, tipo) {
          var blob = new Blob([conteudo], { type: tipo || 'text/plain;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = nome;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        }

        function arquivosCorrelacionadosParaExportacao(arquivoInicial) {
          var relacionados = arquivosRelacionados(arquivoInicial);
          // Os três editores-base são co-dependentes no preview. Por isso,
          // ao exportar HTML, CSS e JavaScript participam do projeto mesmo
          // quando o aluno ainda não adicionou referências externas.
          if (arquivoInicial.linguagem === 'html') {
            arquivosExtras.filter(function (arquivo) {
              return ['css', 'scss', 'javascript', 'typescript', 'javascriptreact'].indexOf(arquivo.linguagem) >= 0;
            }).forEach(function (arquivo) {
              if (relacionados.indexOf(arquivo) < 0) relacionados.push(arquivo);
            });
          }
          return relacionados;
        }

        function tipoMimeDoArquivo(arquivo) {
          var tipos = { html: 'text/html;charset=utf-8', css: 'text/css;charset=utf-8', javascript: 'text/javascript;charset=utf-8', svg: 'image/svg+xml;charset=utf-8', markdown: 'text/markdown;charset=utf-8', json: 'application/json;charset=utf-8', xml: 'application/xml;charset=utf-8', typescript: 'text/typescript;charset=utf-8', scss: 'text/x-scss;charset=utf-8', javascriptreact: 'text/jsx;charset=utf-8' };
          return tipos[arquivo.linguagem] || 'text/plain;charset=utf-8';
        }

        function exportarHtmlComDependencias(arquivoHtml, externo) {
          var relacionados = arquivosCorrelacionadosParaExportacao(arquivoHtml);
          // SCSS, TypeScript e JSX exigem compilação. Mantê-los como arquivos
          // fonte evita gerar um style.css/script.js que o navegador não
          // consegue interpretar.
          var css = relacionados.filter(function (arquivo) { return arquivo.linguagem === 'css'; }).map(function (arquivo) { return arquivo.editor.getValue(); }).join('\n\n');
          var js = relacionados.filter(function (arquivo) { return arquivo.linguagem === 'javascript'; }).map(function (arquivo) { return arquivo.editor.getValue(); }).join('\n\n');
          var fontesQueExigemCompilacao = relacionados.filter(function (arquivo) {
            return ['scss', 'typescript', 'javascriptreact'].indexOf(arquivo.linguagem) >= 0;
          });
          var corpo = arquivoHtml.editor.getValue();
          var nomeHtml = arquivoHtml.nome || 'index.html';
          var documento = externo
            ? '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n' + corpo + '\n  <script src="script.js"></script>\n</body>\n</html>\n'
            : '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <style>\n' + css + '\n  </style>\n</head>\n<body>\n' + corpo + '\n  <script>\n' + escaparFechamentoScript(js) + '\n  </script>\n</body>\n</html>\n';
          baixarArquivo(documento, nomeHtml, 'text/html;charset=utf-8');
          if (externo) {
            baixarArquivo(css, 'style.css', 'text/css;charset=utf-8');
            baixarArquivo(js, 'script.js', 'text/javascript;charset=utf-8');
            relacionados.filter(function (arquivo) {
              return arquivo !== arquivoHtml && ['css', 'javascript'].indexOf(arquivo.linguagem) < 0;
            }).forEach(function (arquivo) {
              baixarArquivo(arquivo.editor.getValue(), arquivo.nome, tipoMimeDoArquivo(arquivo));
            });
          } else {
            fontesQueExigemCompilacao.forEach(function (arquivo) {
              baixarArquivo(arquivo.editor.getValue(), arquivo.nome, tipoMimeDoArquivo(arquivo));
            });
          }
          var temFontesSeparadas = fontesQueExigemCompilacao.length > 0;
          mostrarToast(externo
            ? 'Projeto e arquivos relacionados exportados!'
            : (temFontesSeparadas ? 'HTML exportado; fontes TS/JSX/SCSS foram preservadas separadamente.' : 'Projeto reunido em um arquivo HTML!'));
        }

        function arquivosRelacionados(arquivoInicial) {
          var encontrados = [];
          var visitar = function (arquivo) {
            if (!arquivo || encontrados.indexOf(arquivo) >= 0) return;
            encontrados.push(arquivo);
            referenciasLocaisDoArquivo(arquivo).forEach(function (nome) {
              var dependencia = arquivosExtras.find(function (item) { return item.nome.toLowerCase() === nome.toLowerCase(); });
              visitar(dependencia);
            });
          };
          visitar(arquivoInicial);
          return encontrados;
        }

        function exportarArquivosRelacionados(arquivoInicial) {
          arquivosCorrelacionadosParaExportacao(arquivoInicial).forEach(function (arquivo) {
            baixarArquivo(arquivo.editor.getValue(), arquivo.nome, tipoMimeDoArquivo(arquivo));
          });
          mostrarToast('Arquivos relacionados exportados!');
        }

        function configurarDialogoDeExportacao(arquivo) {
          var html = arquivo.linguagem === 'html';
          if (exportCodeTitle) exportCodeTitle.textContent = html ? 'Exportar projeto HTML' : 'Exportar arquivos relacionados';
          if (exportInternalTitle) exportInternalTitle.textContent = html ? 'Projeto em um arquivo' : 'Somente este arquivo';
          if (exportInternalDescription) exportInternalDescription.textContent = html ? 'HTML com CSS e JavaScript correlacionados internamente' : 'Exporta apenas ' + arquivo.nome;
          if (exportExternalTitle) exportExternalTitle.textContent = html ? 'Projeto em arquivos separados' : 'Exportar dependências externas';
          if (exportExternalDescription) exportExternalDescription.textContent = html ? 'HTML, CSS, JavaScript e arquivos relacionados separados' : 'Exporta este arquivo e todas as dependências locais relacionadas';
        }

        function arquivoPadraoParaExportacao() {
          return arquivosExtras.find(function (arquivo) { return arquivo.linguagem === 'html'; }) || arquivosExtras[0] || null;
        }

        function exportarArquivosPorExtensao(extensoesSelecionadas) {
          var grupos = {
            html: ['html'], css: ['css', 'scss'], javascript: ['javascript', 'typescript', 'javascriptreact'],
            svg: ['svg'], json: ['json'], xml: ['xml'], markdown: ['markdown']
          };
          var arquivos = arquivosExtras.filter(function (arquivo) {
            return extensoesSelecionadas.some(function (extensao) { return (grupos[extensao] || []).indexOf(arquivo.linguagem) >= 0; });
          });
          if (!arquivos.length) {
            mostrarToast('Não há arquivos nas extensões selecionadas.');
            return;
          }
          arquivos.forEach(function (arquivo) { baixarArquivo(arquivo.editor.getValue(), arquivo.nome, tipoMimeDoArquivo(arquivo)); });
          mostrarToast(arquivos.length + ' arquivo(s) exportado(s) pelas extensões selecionadas!');
        }

        function exportarCodigoUnico() {
          baixarArquivo(montarCodigoPreview(), 'codigo-editado.html', 'text/html;charset=utf-8');
          mostrarToast('Documento único exportado!');
        }

        function exportarCodigosSeparados() {
          var codigoFonte = obterCodigoFonteAgregado();
          var html = codigoFonte.html;
          var css = codigoFonte.css;
          var js = codigoFonte.js;
          var indexHtml = '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <link rel="stylesheet" href="style.css">\n  <title>Código editado</title>\n</head>\n<body>\n' + html + '\n  <script src="script.js"></script>\n</body>\n</html>\n';
          baixarArquivo(indexHtml, 'index.html', 'text/html;charset=utf-8');
          baixarArquivo(css, 'style.css', 'text/css;charset=utf-8');
          baixarArquivo(js, 'script.js', 'text/javascript;charset=utf-8');
          mostrarToast('Arquivos separados exportados!');
        }

        function exportarCodigoHtml() {
          baixarArquivo(obterCodigoFonteAgregado().html, 'index.html', 'text/html;charset=utf-8');
          mostrarToast('Arquivo HTML exportado!');
        }

        function exportarCodigoCss() {
          baixarArquivo(obterCodigoFonteAgregado().css, 'style.css', 'text/css;charset=utf-8');
          mostrarToast('Arquivo CSS exportado!');
        }

        function exportarCodigoJs() {
          baixarArquivo(obterCodigoFonteAgregado().js, 'script.js', 'text/javascript;charset=utf-8');
          mostrarToast('Arquivo JavaScript exportado!');
        }

        function exportarCodigoSvg() {
          var documento = new DOMParser().parseFromString(obterCodigoFonteAgregado().html, 'text/html');
          var svg = documento.querySelector('svg');
          if (!svg) {
            mostrarToast('Nenhum SVG foi encontrado no editor HTML.');
            return;
          }
          if (!svg.hasAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          baixarArquivo(svg.outerHTML, 'imagem.svg', 'image/svg+xml;charset=utf-8');
          mostrarToast('Arquivo SVG exportado!');
        }

        if (btnExportFile) btnExportFile.addEventListener('click', function () {
          var arquivo = arquivoPadraoParaExportacao();
          if (!arquivo) {
            mostrarToast('Crie ou importe um arquivo antes de exportar.');
            return;
          }
          arquivoDeExportacaoPendente = arquivo;
          configurarDialogoDeExportacao(arquivo);
          if (exportCodeDialog && typeof exportCodeDialog.showModal === 'function') {
            exportCodeDialog.showModal();
          } else {
            exportarHtmlComDependencias(arquivo, false);
          }
        });

        if (exportCodeDialog) {
          exportCodeDialog.addEventListener('close', function () {
            if (arquivoDeExportacaoPendente) {
              var arquivo = arquivoDeExportacaoPendente;
              if (exportCodeDialog.returnValue === 'by-type') {
                if (exportTypesDialog && typeof exportTypesDialog.showModal === 'function') exportTypesDialog.showModal();
                else mostrarToast('A seleção por extensão não está disponível neste navegador.');
                return;
              }
              arquivoDeExportacaoPendente = null;
              if (exportCodeDialog.returnValue === 'internal') {
                if (arquivo.linguagem === 'html') exportarHtmlComDependencias(arquivo, false);
                else {
                  baixarArquivo(arquivo.editor.getValue(), arquivo.nome, 'text/plain;charset=utf-8');
                  mostrarToast(arquivo.nome + ' exportado!');
                }
              }
              if (exportCodeDialog.returnValue === 'external') {
                if (arquivo.linguagem === 'html') exportarHtmlComDependencias(arquivo, true);
                else exportarArquivosRelacionados(arquivo);
              }
              return;
            }
            if (exportCodeDialog.returnValue === 'single') exportarCodigoUnico();
            if (exportCodeDialog.returnValue === 'separate') exportarCodigosSeparados();
            if (exportCodeDialog.returnValue === 'html') exportarCodigoHtml();
            if (exportCodeDialog.returnValue === 'css') exportarCodigoCss();
            if (exportCodeDialog.returnValue === 'js') exportarCodigoJs();
            if (exportCodeDialog.returnValue === 'svg') exportarCodigoSvg();
          });
        }

        if (exportTypesDialog) {
          exportTypesDialog.addEventListener('close', function () {
            if (exportTypesDialog.returnValue !== 'selected') {
              arquivoDeExportacaoPendente = null;
              return;
            }
            var extensoesSelecionadas = Array.prototype.slice.call(exportTypesDialog.querySelectorAll('input[name="extensions"]:checked')).map(function (input) { return input.value; });
            arquivoDeExportacaoPendente = null;
            exportarArquivosPorExtensao(extensoesSelecionadas);
          });
        }

        if (btnNewFile && newFileMenu) {
          var barraDeAbasDoMenu = btnNewFile.closest('.browser-tabs');
          function fecharMenuNovoArquivo() {
            newFileMenu.hidden = true;
            btnNewFile.setAttribute('aria-expanded', 'false');
            if (barraDeAbasDoMenu) barraDeAbasDoMenu.classList.remove('is-new-file-menu-open');
          }
          btnNewFile.addEventListener('click', function () {
            if (!newFileMenu.hidden) return fecharMenuNovoArquivo();
            var retangulo = btnNewFile.getBoundingClientRect();
            newFileMenu.style.top = Math.min(window.innerHeight - 250, retangulo.bottom + 5) + 'px';
            newFileMenu.style.left = Math.min(window.innerWidth - 238, Math.max(8, retangulo.left)) + 'px';
            newFileMenu.hidden = false;
            btnNewFile.setAttribute('aria-expanded', 'true');
            if (barraDeAbasDoMenu) barraDeAbasDoMenu.classList.add('is-new-file-menu-open');
          });
          newFileMenu.addEventListener('click', function (event) {
            var botao = event.target.closest('button[data-language]');
            if (!botao) return;
            var linguagem = botao.getAttribute('data-language');
            var nomes = { html: 'pagina.html', css: 'estilo.css', javascript: 'script.js', svg: 'imagem.svg', markdown: 'README.md', json: 'dados.json', xml: 'dados.xml', typescript: 'app.ts', scss: 'estilo.scss', javascriptreact: 'App.jsx' };
            criarArquivoExtra(linguagem, nomes[linguagem] || 'arquivo.txt', '');
            fecharMenuNovoArquivo();
          });
          document.addEventListener('pointerdown', function (event) {
            if (!newFileMenu.hidden && !newFileMenu.contains(event.target) && !btnNewFile.contains(event.target)) fecharMenuNovoArquivo();
          });
          document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !newFileMenu.hidden) fecharMenuNovoArquivo();
          });
        }


        chkTogglePreview.addEventListener('change', function () {
          if (chkTogglePreview.checked) mostrarPreview();
          else fecharPreview();
        });

        btnMaximizeToggle.addEventListener('click', function () {
          abrirJanela();
          var telaCheia = mainWindowContainer.classList.toggle('is-fullscreen');
          if (telaCheia) {
            document.body.appendChild(mainWindowContainer);
            document.body.classList.add('ide-fullscreen-lock');
            atualizarAlturaReal();
          } else {
            if (irmaoOriginal && irmaoOriginal.parentNode === paiOriginal) {
              paiOriginal.insertBefore(mainWindowContainer, irmaoOriginal);
            } else {
              paiOriginal.appendChild(mainWindowContainer);
            }
            document.body.classList.remove('ide-fullscreen-lock');
          }
          alternarIcones(iconMaximize, iconMinimize, telaCheia);
          btnMaximizeToggle.setAttribute('aria-pressed', String(telaCheia));
          reajustarPaineisParaNovaArea();
        });

        window.addEventListener('resize', function () {
          if (mainWindowContainer.classList.contains('is-fullscreen')) {
            atualizarAlturaReal();
            redimensionarEditores();
          }
          atualizarIndicadoresRolagem();
        });


        btnPreviewLayout.addEventListener('click', function () {
          abrirJanela();
          var vertical = contentWrapper.classList.toggle('preview-vertical');
          prefPreviewVertical = vertical;
          btnPreviewLayout.classList.toggle('is-active', vertical);
          btnPreviewLayout.setAttribute('aria-pressed', String(vertical));

          limparTamanhosDosPaineis();
          configurarRedimensionadores();
          setTimeout(redimensionarEditores, 150);
        });

        btnPreviewMaximize.addEventListener('click', function () {
          abrirJanela();
          definirPreviewMaximizado(!contentWrapper.classList.contains('preview-maximized'));

          limparTamanhosDosPaineis();
          configurarRedimensionadores();
          setTimeout(redimensionarEditores, 150);
        });

        if (btnPreviewTheme) {
          btnPreviewTheme.addEventListener('click', function () {
            previewTemaEscuro = !previewTemaEscuro;
            btnPreviewTheme.classList.toggle('is-active', previewTemaEscuro);
            btnPreviewTheme.setAttribute('aria-pressed', String(previewTemaEscuro));
            btnPreviewTheme.title = previewTemaEscuro ? 'Tema Claro do Preview' : 'Tema Escuro do Preview';
            btnPreviewTheme.setAttribute('aria-label', btnPreviewTheme.title);
            alternarIcones(iconPreviewThemeLight, iconPreviewThemeDark, previewTemaEscuro);
            if (previewContainer.classList.contains('show-preview')) renderizarPreview();
          });
        }

        dragContainer.addEventListener('dragstart', function (e) {
          var aba = e.target.closest('.code-tab[draggable="true"]');
          if (!aba) { e.preventDefault(); return; }
          itemArrastado = aba;
          aba.classList.add('dragging');
        });

        dragContainer.addEventListener('dragover', function (e) {
          var abaAlvo = e.target.closest('.code-tab[draggable="true"]');
          if (!abaAlvo || abaAlvo === itemArrastado) return;
          e.preventDefault();
          var passouDoMeio = (e.clientX - abaAlvo.getBoundingClientRect().left) > abaAlvo.getBoundingClientRect().width / 2;
          if (passouDoMeio) abaAlvo.after(itemArrastado);
          else abaAlvo.before(itemArrastado);
        });

        dragContainer.addEventListener('dragend', function () {
          if (itemArrastado) {
            itemArrastado.classList.remove('dragging');
            itemArrastado = null;
          }
          atualizarLayoutAbas();
          agendarAtualizacaoPreview();
          agendarSalvamentoAutomatico();
        });

        atualizarJanela();
        atualizarLayoutAbas();
        if (chkTogglePreview.checked) mostrarPreview();
        setTimeout(redimensionarEditores, 100);
      }
  } // fim de iniciarEditorDeCodigo

  /* ==========================================================
     BOOT — guarda a página (redireciona pra Landing se não
     houver sessão), carrega o progresso local do aluno
     e só então liga a teoria (módulos/etapas) e o editor Monaco.
     ========================================================== */
  async function bootIde() {
    if (!CL.auth || !CL.api) {
      console.error(
        '[ide] CL.auth/CL.api não encontrados. Confira se firebase-init.js, ' +
        'auth.js e api.js estão sendo carregados ANTES de ide.js em ide.html.'
      );
      return;
    }

    // Liga o listener do Firebase Auth (equivalente ao que CL.boot.init
    // faz em app.js, mas o IDE não carrega app.js inteiro — só o
    // necessário: firebase-init/auth/api).
    CL.auth.init();

    // Sem sessão válida, CL.auth.guard() já redireciona pra Landing
    // (?reason=unauthenticated) e devolve false. Nesse caso não faz
    // sentido montar o editor nem carregar os dados de estudo.
    var autenticado = await CL.auth.guard();
    if (!autenticado) return;

    if (CL.curso && CL.curso.conteudoPronto) {
      try {
        await CL.curso.conteudoPronto;
      } catch (erroConteudo) {
        // Um arquivo complementar não pode manter toda a IDE numa tela
        // parada. curso-data.js já contém a estrutura-base necessária.
        console.error('[ide] parte do conteúdo complementar não carregou:', erroConteudo);
      }
    }

    var progressoCarregado = {};
    var exerciciosCarregado = {};
    var posicaoCarregada = null;

    // Timeout defensivo para adaptadores futuros de persistência. A
    // implementação local atual normalmente termina imediatamente.
    // deixar a tela inteira travada esperando. Se passar de 6s, a
    // IDE libera a tela com o progresso vazio (igual já acontecia
    // no catch abaixo pra erro de rede) — o carregamento real
    // continua em segundo plano e, se chegar depois, os dados são
    // aplicados aos editores/etapas assim que resolverem.
    function comTimeout(promise, ms) {
      return Promise.race([
        promise.then(function (valor) { return { expirou: false, valor: valor }; }),
        new Promise(function (resolve) {
          setTimeout(function () { resolve({ expirou: true, valor: null }); }, ms);
        })
      ]);
    }

    try {
      var carregamentoEstudo = Promise.all([
        CL.api.listProgress(),
        CL.api.listExercises(),
        CL.api.getProfile()
      ]);

      var corrida = await comTimeout(carregamentoEstudo, 6000);

      if (corrida.expirou) {
        if (CL.config && CL.config.debug) {
          console.warn('[ide] A leitura dos dados demorou mais de 6s; liberando a tela com progresso vazio nesta sessão.');
        }
        if (CL.ui && typeof CL.ui.showToast === 'function') {
          CL.ui.showToast('A leitura do progresso demorou — abrindo temporariamente sem os dados salvos.', 'warning', 8000);
        }
        // Não deixamos a UI travada esperando, mas também não tentamos
        // "reaplicar" o resultado tardio numa tela já montada — a
        // função que desenha a teoria (iniciarTeoria) registra
        // listeners e não foi feita pra rodar duas vezes com
        // segurança. O aluno pode recarregar a página quando a rede
        // melhorar pra puxar o progresso salvo; enquanto isso, salvar
        // (CL.api.saveProgress/saveExercise) continua funcionando
        // normalmente a partir de agora.
      } else {
        var resultados = corrida.valor;
        progressoCarregado = resultados[0] || {};
        exerciciosCarregado = resultados[1] || {};
        posicaoCarregada = (resultados[2] && resultados[2].idePosition) || null;
      }
    } catch (erro) {
      // CL.api._handleError já mostrou um toast avisando o aluno;
      // seguimos com os caches vazios pra não travar a página numa
      // tela em branco (o aluno começa do zero nesta sessão, mas
      // volta a salvar normalmente a partir daqui).
      if (CL.config && CL.config.debug) {
        console.error('[ide] falha ao carregar os dados de estudo:', erro);
      }
    }

    iniciarTeoria(progressoCarregado, exerciciosCarregado, posicaoCarregada);

    // O Monaco tenta três origens sem impedir a teoria e seus botões de
    // funcionar caso uma CDN esteja lenta ou indisponível.
    if (await garantirCarregadorMonaco()) iniciarEditorDeCodigo();
    else mostrarFalhaDoEditor();
  }

  bootIde();

})();

/* ========================================================== 
   REDIMENSIONADOR DE PAINÉIS (Teoria <-> IDE)
   Não depende de autenticação nem de dados de estudo.
   ========================================================== */
    (function () {
      var root = document.querySelector('.learning-platform-root');
      var theoryPane = document.querySelector('.theory-pane');
      var idePane = document.querySelector('.ide-container-pane');
      var resizer = document.getElementById('pane-resizer');

      if (!root || !theoryPane || !idePane || !resizer) return;

      var MIN_THEORY_HORIZONTAL = 260;
      var MIN_IDE_HORIZONTAL = 300;
      var DEFAULT_RATIO = 1 / 3;
      var ratioAtual = DEFAULT_RATIO;
      var arrastando = false;
      var vertical = false;
      var frameAgendado = null;
      var inicioCoord = 0;
      var tamanhoInicial = 0;
      var pointerIdCapturado = null;

      function atualizarOrientacao() {
        vertical = getComputedStyle(root).flexDirection === 'column';
        resizer.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');
        resizer.style.cursor = vertical ? 'row-resize' : 'col-resize';
      }

      function limites(total) {
        if (vertical) {
          var minimoTeoria = Math.max(60, Math.min(100, total * 0.2));
          var minimoIde = Math.max(80, Math.min(120, total * 0.25));
          return { min: minimoTeoria, max: Math.max(minimoTeoria, total - minimoIde) };
        }
        var minimoTeoriaH = Math.min(MIN_THEORY_HORIZONTAL, total * 0.45);
        var minimoIdeH = Math.min(MIN_IDE_HORIZONTAL, total * 0.45);
        return { min: minimoTeoriaH, max: Math.max(minimoTeoriaH, total - minimoIdeH) };
      }

      function posicionarResizer(tamanhoTeoriaDefinido) {
        atualizarOrientacao();
        var tamanhoTeoria = typeof tamanhoTeoriaDefinido === 'number'
          ? tamanhoTeoriaDefinido
          : (vertical ? theoryPane.getBoundingClientRect().height : theoryPane.getBoundingClientRect().width);
        if (vertical) {
          resizer.style.left = '0';
          resizer.style.top = tamanhoTeoria + 'px';
        } else {
          resizer.style.top = '0';
          resizer.style.left = tamanhoTeoria + 'px';
        }
      }

      function aplicarTamanho(px, atualizarRatio) {
        atualizarOrientacao();
        var rect = root.getBoundingClientRect();
        var total = vertical ? rect.height : rect.width;
        if (!total) return;
        var faixa = limites(total);
        var tamanhoTeoria = Math.round(Math.max(faixa.min, Math.min(px, faixa.max)));
        var tamanhoIde = Math.max(0, total - tamanhoTeoria);

        theoryPane.style.flex = '0 0 ' + tamanhoTeoria + 'px';
        idePane.style.flex = '0 0 ' + tamanhoIde + 'px';
        theoryPane.style.minWidth = '0';
        theoryPane.style.minHeight = '0';
        idePane.style.minWidth = '0';
        idePane.style.minHeight = '0';
        theoryPane.style.maxWidth = vertical ? '' : 'none';
        theoryPane.style.width = vertical ? '100%' : tamanhoTeoria + 'px';
        theoryPane.style.height = vertical ? tamanhoTeoria + 'px' : '100%';
        idePane.style.width = vertical ? '100%' : tamanhoIde + 'px';
        idePane.style.height = vertical ? tamanhoIde + 'px' : '100%';

        if (atualizarRatio !== false) ratioAtual = tamanhoTeoria / total;
        resizer.setAttribute('aria-valuenow', String(Math.round(ratioAtual * 100)));
        posicionarResizer(tamanhoTeoria);
        window.dispatchEvent(new Event('ide:resize'));
      }

      function agendarTamanho(px) {
        if (frameAgendado) cancelAnimationFrame(frameAgendado);
        frameAgendado = requestAnimationFrame(function () {
          frameAgendado = null;
          aplicarTamanho(px);
        });
      }

      function onPointerMove(event) {
        if (!arrastando) return;
        var coordAtual = vertical ? event.clientY : event.clientX;
        var delta = coordAtual - inicioCoord;
        agendarTamanho(tamanhoInicial + delta);
        if (event.cancelable) event.preventDefault();
      }

      function finalizarArraste() {
        if (!arrastando) return;
        arrastando = false;
        if (pointerIdCapturado !== null) {
          try {
            if (resizer.hasPointerCapture && resizer.hasPointerCapture(pointerIdCapturado)) {
              resizer.releasePointerCapture(pointerIdCapturado);
            }
          } catch (_) {}
          pointerIdCapturado = null;
        }
        resizer.classList.remove('is-dragging');
        root.classList.remove('is-resizing-panels');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finalizarArraste);
        window.removeEventListener('pointercancel', finalizarArraste);
      }

      resizer.addEventListener('pointerdown', function (event) {
        if (root.classList.contains('ide-recolhido')) return;
        atualizarOrientacao();
        arrastando = true;
        inicioCoord = vertical ? event.clientY : event.clientX;
        tamanhoInicial = vertical
          ? theoryPane.getBoundingClientRect().height
          : theoryPane.getBoundingClientRect().width;
        pointerIdCapturado = event.pointerId;

        resizer.classList.add('is-dragging');
        root.classList.add('is-resizing-panels');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';

        if (resizer.setPointerCapture) {
          try {
            resizer.setPointerCapture(event.pointerId);
          } catch (_) {}
        }

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', finalizarArraste);
        window.addEventListener('pointercancel', finalizarArraste);
        event.preventDefault();
      });

      resizer.addEventListener('keydown', function (event) {
        atualizarOrientacao();
        var atual = vertical ? theoryPane.getBoundingClientRect().height : theoryPane.getBoundingClientRect().width;
        var passo = event.shiftKey ? 64 : 24;
        var delta = 0;
        if ((!vertical && event.key === 'ArrowLeft') || (vertical && event.key === 'ArrowUp')) delta = -passo;
        if ((!vertical && event.key === 'ArrowRight') || (vertical && event.key === 'ArrowDown')) delta = passo;
        if (event.key === 'Home') aplicarTamanho(0);
        else if (event.key === 'End') aplicarTamanho(Number.MAX_SAFE_INTEGER);
        else if (delta) aplicarTamanho(atual + delta);
        else return;
        event.preventDefault();
      });

      resizer.addEventListener('dblclick', function () {
        atualizarOrientacao();
        var rect = root.getBoundingClientRect();
        var total = vertical ? rect.height : rect.width;
        aplicarTamanho(total * DEFAULT_RATIO);
      });

      window.addEventListener('resize', function () {
        atualizarOrientacao();
        var rect = root.getBoundingClientRect();
        aplicarTamanho((vertical ? rect.height : rect.width) * ratioAtual, false);
      });

      var rectInicial = root.getBoundingClientRect();
      aplicarTamanho((getComputedStyle(root).flexDirection === 'column' ? rectInicial.height : rectInicial.width) * DEFAULT_RATIO);
    })();
