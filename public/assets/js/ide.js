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

  // Diálogos compactos compartilhados pela plataforma de aprendizado e pelo
  // editor. As duas áreas têm inicialização independente, portanto estes
  // helpers não podem pertencer a apenas uma delas.
  var ideConfirmDialog = document.getElementById('ide-confirm-dialog');
  var ideConfirmTitle = document.getElementById('ide-confirm-title');
  var ideConfirmMessage = document.getElementById('ide-confirm-message');
  var ideConfirmButton = ideConfirmDialog && ideConfirmDialog.querySelector('.ide-compact-dialog-confirm');
  var ideConfirmCancelButton = ideConfirmDialog && ideConfirmDialog.querySelector('[value="cancel"]');
  var idePromptDialog = document.getElementById('ide-prompt-dialog');
  var idePromptTitle = document.getElementById('ide-prompt-title');
  var idePromptMessage = document.getElementById('ide-prompt-message');
  var idePromptInput = document.getElementById('ide-prompt-input');
  var idePromptButton = idePromptDialog && idePromptDialog.querySelector('.ide-compact-dialog-confirm');

  function confirmarAcao(mensagem, opcoes) {
    opcoes = opcoes || {};
    if (!ideConfirmDialog || typeof ideConfirmDialog.showModal !== 'function') return Promise.resolve(window.confirm(mensagem));
    ideConfirmTitle.textContent = opcoes.titulo || 'Confirmar ação';
    ideConfirmMessage.textContent = mensagem;
    ideConfirmButton.textContent = opcoes.confirmar || 'Confirmar';
    ideConfirmButton.classList.toggle('is-destructive', Boolean(opcoes.destrutiva));
    ideConfirmCancelButton.hidden = Boolean(opcoes.somenteConfirmar);
    return new Promise(function (resolve) {
      function aoFechar() {
        ideConfirmDialog.removeEventListener('close', aoFechar);
        resolve(ideConfirmDialog.returnValue === 'confirm');
      }
      ideConfirmDialog.addEventListener('close', aoFechar);
      ideConfirmDialog.showModal();
    });
  }

  function informarAcao(mensagem, titulo) {
    return confirmarAcao(mensagem, { titulo: titulo || 'Aviso', confirmar: 'Entendi', somenteConfirmar: true });
  }

  function solicitarTexto(mensagem, valorInicial, opcoes) {
    opcoes = opcoes || {};
    if (!idePromptDialog || typeof idePromptDialog.showModal !== 'function') return Promise.resolve(window.prompt(mensagem, valorInicial));
    idePromptTitle.textContent = opcoes.titulo || 'Informar nome';
    idePromptMessage.textContent = mensagem;
    idePromptButton.textContent = opcoes.confirmar || 'Continuar';
    idePromptInput.value = valorInicial || '';
    return new Promise(function (resolve) {
      function aoFechar() {
        idePromptDialog.removeEventListener('close', aoFechar);
        resolve(idePromptDialog.returnValue === 'confirm' ? idePromptInput.value : null);
      }
      idePromptDialog.addEventListener('close', aoFechar);
      idePromptDialog.showModal();
      requestAnimationFrame(function () {
        idePromptInput.focus();
        idePromptInput.select();
      });
    });
  }

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
    const moduleNavTitleEl = document.getElementById('module-nav-title');
    const headerStepTabsWrapperEl = document.getElementById('header-step-tabs-wrapper');
    const headerStepTabsEl = document.getElementById('header-step-tabs');
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
        CL.api.deleteProgress(chave).catch(function () { });
      }
      if (CL.api && typeof CL.api.deleteExercise === 'function') {
        CL.api.deleteExercise(chave).catch(function () { });
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
          if (!numero) return;
          confirmarAcao('O progresso e o código salvo desta etapa serão apagados.', { titulo: 'Refazer etapa', confirmar: 'Refazer', destrutiva: true }).then(function (confirmado) {
            if (!confirmado) return;
            resetarProgressoEtapa(getModuloAtual().id, numero);
            renderIndice();
          });
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
            confirmarAcao('O progresso e o código salvo desta etapa serão apagados.', { titulo: 'Refazer etapa', confirmar: 'Refazer', destrutiva: true }).then(function (confirmado) {
              if (!confirmado) return;
              resetarProgressoEtapa(modulo.id, numero);
              renderIndice();
            });
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
      if (moduleNavTitleEl) moduleNavTitleEl.classList.remove('is-visible');
      if (headerStepTabsWrapperEl) headerStepTabsWrapperEl.hidden = false;
      toggleIndiceBtn.classList.remove('is-active');
      toggleIndiceBtn.setAttribute('aria-expanded', 'false');
    }

    function abrirIndice() {
      renderIndice();
      indicePanelEl.hidden = false;
      if (moduleNavTitleEl) {
        var modulo = getModuloAtual();
        // criarModulo/registrarModulo (curso-data.js) não gravam `numero` no
        // módulo, então "modulo.numero" era undefined. O número vem do ID
        // (css-modulo-02 → 2); na falta dele, da posição do módulo no curso.
        var numeroDoModulo = modulo.numero || Number((String(modulo.id).match(/modulo-(\d+)$/) || [])[1]) || (currentModuleIndex + 1);
        moduleNavTitleEl.textContent = 'Módulo ' + numeroDoModulo + ': ' + modulo.nome;
        moduleNavTitleEl.classList.add('is-visible');
      }
      if (headerStepTabsWrapperEl) headerStepTabsWrapperEl.hidden = true;
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
    });

    // Permite que outros scripts leiam a etapa atual sem depender da ordem
    // de carregamento dos <script>.
    window.getEtapaAtual = function () {
      return getEtapasDoModulo()[currentStep - 1];
    };

    const ABAS_DA_ETAPA = ['conteudo', 'exercicio', 'desafio', 'questoes'];
    let abaAtualDaEtapa = 'conteudo';
    const desbloqueioDasAbas = {};
    const abasFixadasPorEtapa = {};
    const proporcoesDosPaineisPorEtapa = {};
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

    function obterAbasFixadas() {
      const chave = chaveDesbloqueioDaEtapa();
      if (!abasFixadasPorEtapa[chave]) abasFixadasPorEtapa[chave] = {};
      return abasFixadasPorEtapa[chave];
    }

    function obterAbasVisiveis() {
      const fixadas = obterAbasFixadas();
      return ABAS_DA_ETAPA.filter(function (nome) {
        return Boolean(fixadas[nome]) || nome === abaAtualDaEtapa;
      });
    }

    function renderBotaoAba(nome, rotulo) {
      const rotuloEscapado = escaparHtml(rotulo);
      return '<span class="step-tab-control" role="presentation">' +
        '<input class="step-tab-pin" type="checkbox" data-step-pin="' + nome + '" aria-label="Fixar painel: ' + rotuloEscapado + '" title="Fixar painel: ' + rotuloEscapado + '">' +
        '<button type="button" class="step-tab" data-step-tab="' + nome + '" role="tab">' +
        '<span>' + rotuloEscapado + '</span>' + ICONE_ABA_BLOQUEADA +
        '</button>' +
        '</span>';
    }

    function pesosPainelParaEtapa(abasVisiveis) {
      const chave = chaveDesbloqueioDaEtapa() + ':' + abasVisiveis.join(',');
      if (!proporcoesDosPaineisPorEtapa[chave] || proporcoesDosPaineisPorEtapa[chave].length !== abasVisiveis.length) {
        proporcoesDosPaineisPorEtapa[chave] = abasVisiveis.map(function () { return 1; });
      }
      return proporcoesDosPaineisPorEtapa[chave];
    }

    function atualizarColunasDosPaineis(wrapper, abasVisiveis, pesos) {
      const colunas = [];
      abasVisiveis.forEach(function (_, indice) {
        colunas.push('minmax(120px, ' + Math.max(0.1, pesos[indice] || 1) + 'fr)');
        if (indice < abasVisiveis.length - 1) colunas.push('8px');
      });
      wrapper.style.gridTemplateColumns = colunas.join(' ');
    }

    function redimensionarParDeAbas(divisor, delta) {
      const wrapper = divisor.parentElement;
      const nomes = wrapper._abasVisiveis || [];
      const indice = Number(divisor.getAttribute('data-divider-index'));
      const abasVisiveis = nomes;
      if (!abasVisiveis[indice] || !abasVisiveis[indice + 1]) return;
      const pesos = pesosPainelParaEtapa(abasVisiveis);
      const antes = wrapper.querySelector('[data-step-section="' + abasVisiveis[indice] + '"]');
      const depois = wrapper.querySelector('[data-step-section="' + abasVisiveis[indice + 1] + '"]');
      if (!antes || !depois) return;
      const larguraAntes = antes.getBoundingClientRect().width;
      const larguraDepois = depois.getBoundingClientRect().width;
      const total = larguraAntes + larguraDepois;
      const minimo = Math.min(120, total / 2);
      const novaLarguraAntes = Math.max(minimo, Math.min(total - minimo, larguraAntes + delta));
      const pesoTotal = pesos[indice] + pesos[indice + 1];
      pesos[indice] = pesoTotal * (novaLarguraAntes / total);
      pesos[indice + 1] = pesoTotal - pesos[indice];
      atualizarColunasDosPaineis(wrapper, abasVisiveis, pesos);
      divisor.setAttribute('aria-valuenow', String(Math.round((novaLarguraAntes / total) * 100)));
    }

    function iniciarRedimensionamentoDasAbas(divisor, evento) {
      const inicio = evento.clientX;
      const indice = Number(divisor.getAttribute('data-divider-index'));
      const wrapper = divisor.parentElement;
      const nomes = wrapper._abasVisiveis || [];
      const anterior = wrapper.querySelector('[data-step-section="' + nomes[indice] + '"]');
      if (!anterior) return;
      const larguraInicial = anterior.getBoundingClientRect().width;
      divisor.classList.add('is-dragging');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      if (divisor.setPointerCapture) divisor.setPointerCapture(evento.pointerId);

      function mover(movimento) {
        redimensionarParDeAbas(divisor, (movimento.clientX - inicio) - (anterior.getBoundingClientRect().width - larguraInicial));
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

    function controlarRedimensionamentoDasAbas(divisor, evento) {
      const passo = evento.shiftKey ? 64 : 24;
      if (evento.key === 'ArrowLeft') redimensionarParDeAbas(divisor, -passo);
      else if (evento.key === 'ArrowRight') redimensionarParDeAbas(divisor, passo);
      else if (evento.key === 'Home' || evento.key === 'End') {
        const wrapper = divisor.parentElement;
        const indice = Number(divisor.getAttribute('data-divider-index'));
        const nomes = wrapper._abasVisiveis || [];
        const antes = wrapper.querySelector('[data-step-section="' + nomes[indice] + '"]');
        const depois = wrapper.querySelector('[data-step-section="' + nomes[indice + 1] + '"]');
        if (!antes || !depois) return;
        const alvo = evento.key === 'Home' ? 120 - antes.getBoundingClientRect().width : depois.getBoundingClientRect().width - 120;
        redimensionarParDeAbas(divisor, alvo);
      } else return;
      evento.preventDefault();
    }

    function restaurarTamanhoIgualDasAbas(divisor) {
      const wrapper = divisor.parentElement;
      const nomes = wrapper._abasVisiveis || [];
      const pesos = pesosPainelParaEtapa(nomes);
      const indice = Number(divisor.getAttribute('data-divider-index'));
      const total = pesos[indice] + pesos[indice + 1];
      pesos[indice] = total / 2;
      pesos[indice + 1] = total / 2;
      atualizarColunasDosPaineis(wrapper, nomes, pesos);
    }

    function configurarPainelDasAbas(card) {
      const wrapper = card.querySelector('[data-step-panels]');
      if (!wrapper) return [];
      const abasVisiveis = obterAbasVisiveis();
      const pesos = pesosPainelParaEtapa(abasVisiveis);
      wrapper._abasVisiveis = abasVisiveis;
      atualizarColunasDosPaineis(wrapper, abasVisiveis, pesos);
      wrapper.querySelectorAll('.step-panel-resizer').forEach(function (divisor) { divisor.remove(); });

      card.querySelectorAll('[data-step-section]').forEach(function (section) {
        section.hidden = abasVisiveis.indexOf(section.getAttribute('data-step-section')) < 0;
      });

      abasVisiveis.slice(0, -1).forEach(function (nome, indice) {
        const secao = wrapper.querySelector('[data-step-section="' + nome + '"]');
        const seguinte = abasVisiveis[indice + 1];
        const divisor = document.createElement('div');
        divisor.className = 'step-panel-resizer';
        divisor.setAttribute('role', 'separator');
        divisor.setAttribute('aria-orientation', 'vertical');
        divisor.setAttribute('aria-label', 'Redimensionar ' + nome + ' e ' + seguinte);
        divisor.setAttribute('aria-valuemin', '0');
        divisor.setAttribute('aria-valuemax', '100');
        divisor.setAttribute('aria-valuenow', '50');
        divisor.setAttribute('data-divider-index', String(indice));
        divisor.tabIndex = 0;
        divisor.addEventListener('pointerdown', function (evento) { iniciarRedimensionamentoDasAbas(divisor, evento); });
        divisor.addEventListener('keydown', function (evento) { controlarRedimensionamentoDasAbas(divisor, evento); });
        divisor.addEventListener('dblclick', function () { restaurarTamanhoIgualDasAbas(divisor); });
        secao.after(divisor);
      });
      return abasVisiveis;
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
        return '<p class="step-questions-empty">Este quiz não tem perguntas. Você pode seguir para a próxima etapa.</p>';
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

    const PASTAS_DE_CONTEUDO = {
      'programming-logic': { pasta: 'logprog', prefixo: 'logprog' },
      'cyber-security': { pasta: 'cyber-security', prefixo: 'cyber-security' },
      html: { pasta: 'html', prefixo: 'html' },
      css: { pasta: 'css', prefixo: 'css' },
      js: { pasta: 'js', prefixo: 'js' }
    };
    const configuracaoConteudoAtual = PASTAS_DE_CONTEUDO[cursoAtualId];
    const abasDoCursoEmArquivos = Boolean(configuracaoConteudoAtual);
    const htmlDasAbasCarregado = {};
    const cssDasAbasCarregado = {};
    const jsDasAbasCarregado = {};
    const carregamentosDasAbas = {};

    function urlArquivoDaAba(numeroEtapa, nomeAba, extensao) {
      const moduloAtual = getModuloAtual();
      const numeroModulo = String(Number(moduloAtual.id.match(/modulo-(\d+)$/)[1])).padStart(2, '0');
      const etapa = String(numeroEtapa).padStart(2, '0');
      const prefixo = configuracaoConteudoAtual.prefixo;
      const nome = 'assets/content/' + configuracaoConteudoAtual.pasta + '/' + prefixo + '-modulo-' + numeroModulo +
        '/' + prefixo + '-etapa-' + etapa + '/' + prefixo + '-modulo-' + numeroModulo +
        '-etapa-' + etapa + '-' + nomeAba + '.' + extensao;
      return new URL(nome, document.baseURI).href;
    }

    function carregarHtmlDaAba(url) {
      if (!htmlDasAbasCarregado[url]) {
        htmlDasAbasCarregado[url] = fetch(url).then(function (resposta) {
          if (!resposta.ok) throw new Error('Não foi possível carregar ' + url);
          return resposta.text();
        }).catch(function (erro) {
          delete htmlDasAbasCarregado[url];
          throw erro;
        });
      }
      return htmlDasAbasCarregado[url];
    }

    function carregarRecursoDaAba(url, tipo) {
      const cache = tipo === 'css' ? cssDasAbasCarregado : jsDasAbasCarregado;
      if (cache[url]) return cache[url];
      cache[url] = new Promise(function (resolve, reject) {
        const recurso = document.createElement(tipo === 'css' ? 'link' : 'script');
        recurso.onload = resolve;
        recurso.onerror = function () {
          delete cache[url];
          reject(new Error('Não foi possível carregar ' + url));
        };
        if (tipo === 'css') {
          recurso.rel = 'stylesheet';
          recurso.href = url;
        } else {
          recurso.src = url;
          recurso.async = true;
        }
        document.head.appendChild(recurso);
      });
      return cache[url];
    }

    function carregarConteudoDaAba(etapa, numeroEtapa, nomeAba, secao) {
      if (!abasDoCursoEmArquivos || !secao) return;
      const chave = getModuloAtual().id + ':' + numeroEtapa + ':' + nomeAba;
      if (carregamentosDasAbas[chave]) return carregamentosDasAbas[chave];

      const alvo = secao.querySelector('[data-step-content]');
      if (!alvo) return;
      secao.setAttribute('aria-busy', 'true');

      const htmlUrl = urlArquivoDaAba(numeroEtapa, nomeAba, 'html');
      const cssUrl = urlArquivoDaAba(numeroEtapa, nomeAba, 'css');
      const jsUrl = urlArquivoDaAba(numeroEtapa, nomeAba, 'js');
      carregamentosDasAbas[chave] = carregarHtmlDaAba(htmlUrl).then(function (markup) {
        alvo.innerHTML = markup;
        return carregarRecursoDaAba(cssUrl, 'css');
      }).then(function () {
        return carregarRecursoDaAba(jsUrl, 'js');
      }).then(function () {
        if (nomeAba === 'questoes') {
          const chaveQuestoes = getModuloAtual().id + ':' + numeroEtapa;
          const questoesPorEtapa = CL.curso.questoesPorEtapa || {};
          etapa.questoes = questoesPorEtapa[chaveQuestoes] || [];
          const listaQuestoes = alvo.querySelector('[data-step-questions]');
          if (listaQuestoes) listaQuestoes.innerHTML = renderSecaoQuestoes(etapa);
        }
        secao.setAttribute('data-assets-loaded', 'true');
      }).catch(function (erro) {
        delete carregamentosDasAbas[chave];
        alvo.textContent = 'Não foi possível carregar o conteúdo desta aba. Tente novamente.';
        console.error('[ide] falha ao carregar arquivos da aba:', erro);
      }).finally(function () {
        secao.removeAttribute('aria-busy');
      });
      return carregamentosDasAbas[chave];
    }

    // Barra de abas (Conteúdo/Exercício/Questões/Desafio) do header. É
    // renderizada uma única vez — os rótulos não mudam entre módulos/
    // etapas, só o estado (bloqueada/ativa), tratado por
    // atualizarAbasDaEtapa(). Antes, esse bloco era gerado dentro de
    // cada .step-card em renderEtapas() (uma cópia por etapa do
    // módulo); agora vive só no header, entre o botão "Índice do
    // curso" e o dropdown de configurações de backup.
    function renderAbasDoHeader() {
      if (!headerStepTabsEl) return;
      headerStepTabsEl.innerHTML =
        renderBotaoAba('conteudo', 'Conteúdo') +
        renderBotaoAba('exercicio', 'Exercício') +
        renderBotaoAba('desafio', 'Desafio') +
        renderBotaoAba('questoes', 'Quiz');
      if (window.CLScrollableControls) window.CLScrollableControls.refresh(headerStepTabsWrapperEl);
    }

    function renderEtapas() {
      theoryContentEl.innerHTML = getEtapasDoModulo().map(function (etapa, i) {
        const numero = i + 1;
        const conteudo = abasDoCursoEmArquivos ? '<div data-step-content></div>' : etapa.texto;
        const questoes = abasDoCursoEmArquivos ? '<div data-step-content></div>' : renderSecaoQuestoes(etapa);
        const exercicio = abasDoCursoEmArquivos
          ? '<div data-step-content></div>'
          : '<div class="task-box"><strong>Missão:</strong> ' + etapa.missao + '</div>';
        const desafio = abasDoCursoEmArquivos
          ? '<div data-step-content></div>'
          : (etapa.desafio || desafioPadraoDaEtapa(etapa));
        function botaoAvancarDaAba(nomeAba) {
          return (
          '<div class="step-nav-footer">' +
          '<button type="button" class="step-nav-btn step-nav-btn--next" data-step-action="next" data-step-next-from="' + nomeAba + '" title="Avançar" aria-label="Avançar">' +
          '<span></span>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>' +
          '</button>' +
          '</div>'
          );
        }

        return (
          '<section class="step-card' + (i === 0 ? ' active' : '') + '" data-step="' + numero + '">' +
          '<div class="step-panels" data-step-panels>' +
          '<div class="step-section" id="step-' + numero + '-panel-conteudo" data-step-section="conteudo" role="tabpanel">' + conteudo + botaoAvancarDaAba('conteudo') + '</div>' +
          '<div class="step-section" id="step-' + numero + '-panel-exercicio" data-step-section="exercicio" role="tabpanel" hidden><h3>Exercício</h3>' + exercicio + botaoAvancarDaAba('exercicio') + '</div>' +
          '<div class="step-section" id="step-' + numero + '-panel-desafio" data-step-section="desafio" role="tabpanel" hidden><h3>Desafio</h3>' + desafio + botaoAvancarDaAba('desafio') + '</div>' +
          '<div class="step-section" id="step-' + numero + '-panel-questoes" data-step-section="questoes" role="tabpanel" hidden><h3>Quiz</h3>' + questoes + botaoAvancarDaAba('questoes') + '</div>' +
          '</div>' +
          '</section>'
        );
      }).join('');
    }

    function atualizarAbasDaEtapa() {
      const card = theoryContentEl.querySelector('.step-card.active');
      if (!card) return;
      const maximoDesbloqueado = indiceMaximoDesbloqueado();
      const abasVisiveis = configurarPainelDasAbas(card);
      const abasFixadas = obterAbasFixadas();
      // As abas agora vivem uma única vez no header (fora de theoryContentEl),
      // então o estado (ativa/bloqueada) é aplicado ali, não dentro do card.
      if (headerStepTabsEl) {
        headerStepTabsEl.querySelectorAll('[data-step-tab]').forEach(function (tab) {
          const nome = tab.getAttribute('data-step-tab');
          const indice = ABAS_DA_ETAPA.indexOf(nome);
          const desbloqueada = indice <= maximoDesbloqueado;
          const ativa = desbloqueada && nome === abaAtualDaEtapa;
          tab.classList.toggle('is-active', ativa);
          tab.classList.toggle('is-locked', !desbloqueada);
          tab.disabled = !desbloqueada;
          tab.setAttribute('aria-selected', String(ativa));
          tab.setAttribute('aria-disabled', String(!desbloqueada));
          tab.setAttribute('aria-controls', 'step-' + currentStep + '-panel-' + nome);
          tab.tabIndex = ativa ? 0 : -1;
          tab.title = desbloqueada ? '' : 'Conclua “' + (ABAS_DA_ETAPA[indice - 1] || 'Conteúdo') + '” para liberar esta aba.';
          const pin = headerStepTabsEl.querySelector('[data-step-pin="' + nome + '"]');
          if (pin) {
            pin.checked = Boolean(abasFixadas[nome]);
            pin.disabled = !desbloqueada;
            pin.setAttribute('aria-disabled', String(!desbloqueada));
          }
        });
      }
      if (abasDoCursoEmArquivos) {
        const etapa = getEtapasDoModulo()[currentStep - 1];
        abasVisiveis.forEach(function (nomeAba) {
          const secao = card.querySelector('[data-step-section="' + nomeAba + '"]');
          carregarConteudoDaAba(etapa, currentStep, nomeAba, secao);
        });
      }
      card.querySelectorAll('[data-step-action="next"]').forEach(function (avancar) {
        const nomeAba = avancar.getAttribute('data-step-next-from');
        const avancarTexto = nomeAba === 'conteudo' ? 'Ir para exercício' : (nomeAba === 'exercicio' ? 'Ir para desafio' : (nomeAba === 'desafio' ? 'Ir para Quiz' : (currentStep === getTotalEtapas() ? 'Concluir módulo' : 'Próxima etapa')));
        avancar.title = avancarTexto;
        avancar.setAttribute('aria-label', avancarTexto);
        avancar.querySelector('span').textContent = avancarTexto;
      });
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

    // Botão de avanço dentro de cada etapa (rodapé-direita, ver
    // renderEtapas). Delegado no container, já
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
      const btnAvancarEtapa = e.target.closest('[data-step-action="next"]');
      if (btnAvancarEtapa) {
        const abaDeOrigem = btnAvancarEtapa.getAttribute('data-step-next-from');
        if (ABAS_DA_ETAPA.indexOf(abaDeOrigem) !== -1) abaAtualDaEtapa = abaDeOrigem;
        avancarNaEtapa();
      }
    });

    // Abas Conteúdo/Questões/Exercício/Desafio: vivem uma única vez no
    // header (ver renderAbasDoHeader), não mais dentro de cada
    // .step-card — por isso clique e navegação por teclado são
    // delegados em headerStepTabsEl, não em theoryContentEl.
    if (headerStepTabsEl) {
      headerStepTabsEl.addEventListener('change', function (e) {
        const pin = e.target.closest('[data-step-pin]');
        if (!pin || pin.disabled) return;
        const nome = pin.getAttribute('data-step-pin');
        const fixadas = obterAbasFixadas();
        if (pin.checked) {
          fixadas[nome] = true;
        } else {
          delete fixadas[nome];
          if (abaAtualDaEtapa === nome) {
            const proximaFixada = ABAS_DA_ETAPA.find(function (aba) { return Boolean(fixadas[aba]); });
            const proximaDisponivel = ABAS_DA_ETAPA.find(function (aba, indice) {
              return aba !== nome && indice <= indiceMaximoDesbloqueado();
            });
            abaAtualDaEtapa = proximaFixada || proximaDisponivel || 'conteudo';
          }
        }
        atualizarAbasDaEtapa();
      });

      headerStepTabsEl.addEventListener('click', function (e) {
        const aba = e.target.closest('[data-step-tab]');
        if (aba && !aba.disabled) {
          abaAtualDaEtapa = aba.getAttribute('data-step-tab');
          atualizarAbasDaEtapa();
        }
      });

      headerStepTabsEl.addEventListener('keydown', function (e) {
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
        const ativa = headerStepTabsEl.querySelector('[data-step-tab="' + abaAtualDaEtapa + '"]');
        if (ativa) ativa.focus();
      });
    }

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
      if (typeof window.obterDadosDoProjeto === 'function') {
        const dadosProjeto = window.obterDadosDoProjeto();
        if (Object.keys(dadosProjeto.arquivos).length) await salvarProjetoNoAparelho(dadosProjeto);
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

    // ===== Backup do PROJETO do aluno (arquivo separado do progresso) =====
    // Mesmos destinos/credenciais do backup do curso, outro arquivo:
    // coding-loop-projeto.json (Drive/OneDrive/pasta do aparelho).
    async function enviarProjetoGoogleDrive(data, interativo) {
      const settings = CL.api.getBackupSettings();
      const token = await obterTokenGoogleDrive(Boolean(interativo));
      const content = JSON.stringify(data, null, 2);
      const arquivo = CL.api.PROJECT_BACKUP_FILE;
      let response;
      if (settings.driveProjectFileId) {
        response = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(settings.driveProjectFileId) + '?uploadType=media', {
          method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: content
        });
        if (response.status === 404) { CL.api.saveBackupSettings({ driveProjectFileId: null }); return enviarProjetoGoogleDrive(data, interativo); }
      } else {
        const boundary = 'coding-loop-projeto-' + Date.now();
        const metadata = { name: arquivo, parents: ['appDataFolder'], mimeType: 'application/json' };
        response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
          body: '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + content + '\r\n--' + boundary + '--'
        });
      }
      if (!response.ok) throw new Error('Não foi possível salvar o projeto no Google Drive.');
      const file = await response.json();
      CL.api.saveBackupSettings({ driveProjectFileId: file.id || settings.driveProjectFileId, lastProjectCloudAt: new Date().toISOString() });
    }

    async function restaurarProjetoGoogleDrive() {
      const settings = CL.api.getBackupSettings();
      const token = await obterTokenGoogleDrive(true);
      let fileId = settings.driveProjectFileId;
      if (!fileId) {
        const list = await fetch("https://www.googleapis.com/drive/v3/files?q=name%3D'" + CL.api.PROJECT_BACKUP_FILE + "'&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id)&spaces=appDataFolder", { headers: { Authorization: 'Bearer ' + token } });
        const files = await list.json();
        fileId = files.files && files.files[0] && files.files[0].id;
      }
      if (!fileId) throw new Error('Nenhum backup de projeto foi encontrado no Google Drive.');
      const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media', { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) throw new Error('Não foi possível ler o projeto do Google Drive.');
      return CL.api.readProjectBackupResponse(response);
    }

    async function enviarProjetoOneDrive(data, interativo) {
      const token = await obterTokenOneDrive(Boolean(interativo));
      const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/' + CL.api.PROJECT_BACKUP_FILE + ':/content', {
        method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data, null, 2)
      });
      if (!response.ok) throw new Error('Não foi possível salvar o projeto no OneDrive.');
      const file = await response.json();
      CL.api.saveBackupSettings({ oneDriveProjectFileId: file.id, lastProjectCloudAt: new Date().toISOString() });
    }

    async function restaurarProjetoOneDrive() {
      const token = await obterTokenOneDrive(true);
      const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/' + CL.api.PROJECT_BACKUP_FILE + ':/content', { headers: { Authorization: 'Bearer ' + token } });
      if (response.status === 404) throw new Error('Nenhum backup de projeto foi encontrado no OneDrive.');
      if (!response.ok) throw new Error('Não foi possível ler o projeto do OneDrive.');
      return CL.api.readProjectBackupResponse(response);
    }

    async function salvarProjetoNoAparelho(dados) {
      const pasta = await obterPastaBackupAparelho();
      if (!pasta || !await pastaBackupTemPermissao(pasta, false)) throw new Error('Escolha a pasta novamente para permitir a cópia no aparelho.');
      const arquivo = await pasta.getFileHandle(CL.api.PROJECT_BACKUP_FILE, { create: true });
      const gravacao = await arquivo.createWritable();
      try { await gravacao.write(JSON.stringify(dados, null, 2)); } finally { await gravacao.close(); }
    }

    async function restaurarProjetoDoAparelho() {
      const pasta = await obterPastaBackupAparelho();
      if (!pasta || !await pastaBackupTemPermissao(pasta, true)) throw new Error('Escolha novamente a pasta usada para o backup.');
      try {
        const arquivo = await pasta.getFileHandle(CL.api.PROJECT_BACKUP_FILE);
        const file = await arquivo.getFile();
        if (file.size > CL.api.MAX_PROJECT_BACKUP_BYTES) throw new Error('Backup do projeto excede o limite de 8 MB.');
        return CL.api.parseProjectBackup(await file.text());
      } catch (error) {
        throw new Error('Nenhum backup de projeto foi encontrado na pasta escolhida.');
      }
    }

    // O editor (outro escopo) usa estes pontos de entrada.
    window.nuvemDoProjeto = {
      enviarDrive: enviarProjetoGoogleDrive, restaurarDrive: restaurarProjetoGoogleDrive,
      enviarOneDrive: enviarProjetoOneDrive, restaurarOneDrive: restaurarProjetoOneDrive,
      salvarNoAparelho: salvarProjetoNoAparelho, restaurarDoAparelho: restaurarProjetoDoAparelho
    };
    window.agendarSincronizacaoDoProjeto = function () {
      const settings = CL.api.getBackupSettings();
      const destinos = settings.destinations || [];
      const nuvemAtiva = (destinos.includes('drive') && settings.googleDriveConnected) || (destinos.includes('onedrive') && settings.oneDriveConnected);
      if (nuvemAtiva) {
        CL.api.saveBackupSettings({ projectCloudPending: true });
        agendarSincronizacaoNuvem();
      }
      if (destinos.includes('device')) agendarBackupNoAparelho();
    };

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

    window.agendarBackupNoAparelhoDaIde = function () { agendarBackupNoAparelho(); };

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

    window.agendarSincronizacaoNuvemDaIde = function () { agendarSincronizacaoNuvem(); };

    async function sincronizarNuvemAutomaticamente(forcar) {
      if (sincronizacaoNuvemEmAndamento || (!forcar && !sincronizacaoNuvemPendente)) return false;
      const settings = CL.api.getBackupSettings();
      const destinos = settings.destinations || [];
      const tarefas = [];
      const dados = CL.api.exportStudyData();
      if (destinos.includes('drive') && settings.googleDriveConnected) tarefas.push(enviarBackupGoogleDrive(dados, false));
      if (destinos.includes('onedrive') && settings.oneDriveConnected) tarefas.push(enviarBackupOneDrive(dados, false));
      const dadosProjeto = (settings.projectCloudPending && typeof window.obterDadosDoProjeto === 'function') ? window.obterDadosDoProjeto() : null;
      const enviarProjeto = Boolean(dadosProjeto && Object.keys(dadosProjeto.arquivos).length);
      if (enviarProjeto) {
        if (destinos.includes('drive') && settings.googleDriveConnected) tarefas.push(enviarProjetoGoogleDrive(dadosProjeto, false));
        if (destinos.includes('onedrive') && settings.oneDriveConnected) tarefas.push(enviarProjetoOneDrive(dadosProjeto, false));
      }
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
        CL.api.saveBackupSettings({ cloudSyncPending: false, cloudSyncFailureCount: 0, cloudSyncRetryAt: null, lastCloudSyncAt: dados.exportedAt, projectCloudPending: false });
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
        informarAcao('Não foi possível entrar na conta do Google Drive. Verifique as permissões e tente novamente.', 'Google Drive');
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
        informarAcao(mensagemErroOneDrive(error), 'OneDrive');
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
        informarAcao('A escolha de pasta é compatível com navegadores baseados em Chromium, como Chrome e Edge.', 'Pasta de backup');
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
        informarAcao(error.message || 'Não foi possível configurar a pasta de backup.', 'Pasta de backup');
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
            campo.checked = true;
            confirmarAcao('Os backups existentes não serão apagados.', { titulo: 'Desabilitar sincronização com ' + nome, confirmar: 'Desabilitar', destrutiva: true }).then(function (confirmado) {
              if (!confirmado) return;
              campo.checked = false;
              atualizarEstadoSincronizacao();
              atualizarEstadoAparelho();
            });
            return;
          }
          atualizarEstadoSincronizacao();
          atualizarEstadoAparelho();
        });
      });
      backupSettingsForm.addEventListener('change', atualizarEstadoBotaoSalvarBackup);
    }

    async function confirmarERestaurar(backup, origem, criarCopia, conflito) {
      if (!backup) return informarAcao('Nenhum backup foi encontrado em ' + origem + '.', 'Restaurar backup');
      if (!CL.api.validateStudyData(backup)) return informarAcao('Arquivo de progresso inválido. Seus dados não foram alterados.', 'Restaurar backup');
      if (conflito === 'newest') {
        const atual = CL.api._studyIndex && CL.api._studyIndex();
        const dataAtual = atual && atual.updatedAt ? new Date(atual.updatedAt).getTime() : 0;
        const dataBackup = backup.index && backup.index.updatedAt ? new Date(backup.index.updatedAt).getTime() : 0;
        if (dataAtual && dataBackup && dataAtual >= dataBackup) return informarAcao('O progresso atual é o mais recente; nenhuma restauração foi feita.', 'Restaurar backup');
      }
      const dataBackup = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('pt-BR') : 'data não informada';
      if (!await confirmarAcao('O progresso atual será substituído pelo backup de ' + origem + ' (' + dataBackup + ').', { titulo: 'Restaurar backup', confirmar: 'Restaurar', destrutiva: true })) return;
      try {
        if (criarCopia) CL.api.saveLocalBackup();
        CL.api.importStudyData(backup);
      } catch (error) { informarAcao(error.message, 'Restaurar backup'); return; }
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
      if (!destinations.length) return informarAcao('Escolha ao menos um local de backup nas configurações.', 'Restaurar backup');
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
      if (fecharSemSalvar) {
        event.preventDefault();
        confirmarAcao('As alterações desta configuração não serão salvas.', { titulo: 'Sair sem salvar', confirmar: 'Sair', destrutiva: true }).then(function (confirmado) {
          if (confirmado && backupSettingsDialog && backupSettingsDialog.open) backupSettingsDialog.close('cancel');
        });
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
      leitura.then(function (backup) { confirmarERestaurar(backup, nome, criarCopiaAntesRestaurar, conflito); }).catch(function (error) { informarAcao(error.message, 'Restaurar backup'); });
    });
    if (restoreBackupSource) restoreBackupSource.addEventListener('change', atualizarVersoesDeRestauracao);
    window.addEventListener('pagehide', function () {
      CL.api.saveLocalBackup();
      if ((CL.api.getBackupSettings().destinations || []).includes('device')) salvarBackupNoAparelho().catch(function () { });
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
    renderAbasDoHeader();
    updateStepsUI();
    // A Learn Platform sempre começa no índice. O conteúdo de uma etapa
    // só é exibido quando o aluno a seleciona na trilha/lista.
    abrirIndice();
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
      var previewTabsContainer = document.getElementById('preview-tabs');
      var btnPreviewLayout = document.getElementById('btn-preview-layout');
      var btnPreviewMaximize = document.getElementById('btn-preview-maximize');
      var btnPreviewTheme = document.getElementById('btn-preview-theme');
      var iconPreviewMax = document.getElementById('icon-preview-max');
      var iconPreviewRestore = document.getElementById('icon-preview-restore');
      var iconPreviewThemeLight = document.getElementById('icon-preview-theme-light');
      var iconPreviewThemeDark = document.getElementById('icon-preview-theme-dark');
      var previewSplitResizer = document.getElementById('preview-split-resizer');
      var exportCodeDialog = document.getElementById('export-code-dialog');
      // O toggle "Live" deixou de ser um botão único no topo — agora cada
      // arquivo tem o seu (dentro do cabeçalho estilo aba de navegador em
      // montarBarraDoArquivo). O checkbox #chk-toggle-preview continua
      // sendo o estado compartilhado; isto aqui só mantém os botões
      // visuais de cada arquivo sincronizados com ele.
      function atualizarBotaoPreviewToggle() {
        Array.prototype.forEach.call(document.querySelectorAll('.file-preview-toggle'), function (botao) {
          botao.setAttribute('aria-pressed', chkTogglePreview.checked ? 'true' : 'false');
          botao.classList.toggle('is-active', chkTogglePreview.checked);
        });
      }
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
          previewSplitResizer.setAttribute('aria-orientation', 'horizontal');
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

      var ALTURA_MINIMA_PREVIEW = 2;

      function aplicarTamanhoAoPar(divisor, antes, depois, eixo, novoAntes) {
        if (!antes || !depois) return;
        var tamanhoAntes = eixo === 'x' ? antes.getBoundingClientRect().width : antes.getBoundingClientRect().height;
        var tamanhoDepois = eixo === 'x' ? depois.getBoundingClientRect().width : depois.getBoundingClientRect().height;
        var total = tamanhoAntes + tamanhoDepois;
        var minimoEditor = Math.min(140, total * 0.42);
        var minimoDepois = eixo === 'y' && depois === previewContainer ? ALTURA_MINIMA_PREVIEW : minimoEditor;
        var minimoAntes = eixo === 'y' && depois === previewContainer ? Math.min(minimoEditor, total) : minimoEditor;
        var tamanhoLimitado = Math.max(minimoAntes, Math.min(novoAntes, total - minimoDepois));
        var novoDepois = total - tamanhoLimitado;

        antes.style.flex = '0 0 ' + tamanhoLimitado + 'px';
        depois.style.flex = '0 0 ' + novoDepois + 'px';
        divisor.setAttribute('aria-valuenow', String(Math.round((tamanhoLimitado / total) * 100)));
        redimensionarEditores();
      }

      // Reencaixa editores/Preview quando o CONTAINER do IDE muda de
      // tamanho por causa externa ao divisor interno (o pane-resizer
      // Teoria<->IDE, no mobile, dispara 'ide:resize'). Sem isso, os dois
      // painéis ficam com flex-basis em px CONGELADO (flex-shrink:0) do
      // último ajuste manual: ou ultrapassam o espaço disponível quando o
      // #window-content-wrapper encolhe, ou sobra vão vazio embaixo do
      // Preview quando ele cresce. Reescala os dois mantendo a proporção
      // atual entre eles, nos dois sentidos.
      function reencaixarSplitEditorPreview() {
        if (!previewContainer.classList.contains('show-preview')) return;
        if (contentWrapper.classList.contains('preview-vertical') || prefPreviewMaximized) return;

        var alturaDivisorPreview = previewSplitResizer && previewSplitResizer.classList.contains('is-visible')
          ? previewSplitResizer.getBoundingClientRect().height
          : 0;
        var disponivel = contentWrapper.clientHeight - alturaDivisorPreview;
        if (disponivel <= 0) return;

        var alturaEditores = editorsContainer.getBoundingClientRect().height;
        var alturaPreview = previewContainer.getBoundingClientRect().height;
        var total = alturaEditores + alturaPreview;
        if (total <= 0) return;
        if (Math.abs(total - disponivel) <= 1) return; // já preenche certinho, nada a corrigir

        var minimoPreview = ALTURA_MINIMA_PREVIEW;
        var minimo = Math.min(Math.min(140, disponivel * 0.42), Math.max(0, disponivel - minimoPreview));
        var proporcao = alturaEditores / total;
        if (!Number.isFinite(proporcao)) proporcao = 0.5;
        var novaAlturaEditores = Math.max(minimo, Math.min(disponivel - minimo, disponivel * proporcao));
        var novaAlturaPreview = disponivel - novaAlturaEditores;

        editorsContainer.style.flex = '0 0 ' + novaAlturaEditores + 'px';
        previewContainer.style.flex = '0 0 ' + novaAlturaPreview + 'px';
        if (previewSplitResizer) {
          previewSplitResizer.setAttribute('aria-valuenow', String(Math.round((novaAlturaEditores / disponivel) * 100)));
        }
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

      function criarEditor(id, linguagem, valorInicial, nomeDoArquivo, origemDoArquivo) {
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
        // Exercício e projeto do aluno têm raízes virtuais diferentes: assim um
        // index.html do projeto não colide com o index.html do exercício e os
        // imports relativos de um não enxergam os arquivos do outro.
        var raizVirtual = nomeDoArquivo ? (origemDoArquivo === 'projeto' ? 'file:///coding-loop/meu-projeto/' : 'file:///coding-loop/projeto/') : ('file:///coding-loop/estado-legado/' + encodeURIComponent(id) + '/');
        var model = monaco.editor.createModel(valorInicial, linguagemMonaco, monaco.Uri.parse(raizVirtual + caminhoDoArquivo));
        // Tamanho de tabulação é opção do modelo, não do editor de view —
        // aplicada aqui para nascer de acordo com a preferência salva.
        model.updateOptions({ tabSize: preferenciasDoEditor.tabSize, insertSpaces: true });
        var editorMonaco = monaco.editor.create(document.getElementById(id), {
          model: model,
          automaticLayout: true,
          fontSize: preferenciasDoEditor.fontSize,
          minimap: { enabled: preferenciasDoEditor.minimap },
          lineNumbersMinChars: 2,
          // Antes 4px com glyphMargin desativado. Agora a gutter também
          // desenha o glifo de severidade (erro/aviso) ao lado do número
          // da linha — item 4 da avaliação técnica do Monaco.
          lineDecorationsWidth: 12,
          glyphMargin: true,
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'mouseover',
          wordWrap: preferenciasDoEditor.wordWrap,
          scrollBeyondLastLine: false,
          renderWhitespace: preferenciasDoEditor.renderWhitespace,
          renderValidationDecorations: 'on',
          overviewRulerLanes: 3,
          hideCursorInOverviewRuler: false,
          // Recursos nativos do Monaco sem custo de manutenção (item 3):
          // ajudam bastante iniciantes lendo HTML/CSS aninhado.
          stickyScroll: { enabled: true },
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          wordBasedSuggestions: 'allDocuments',
          formatOnPaste: true
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
          // Acesso controlado à API nativa do Monaco — pré-requisito para
          // formatar documento, alternar minimap, busca, hover/CodeLens
          // etc. a partir de botões de toolbar fora de criarEditor().
          getMonacoEditor: function () { return editorMonaco; },
          getModel: function () { return model; },
          executarComando: function (idAcao) {
            var acao = editorMonaco.getAction(idAcao);
            return acao ? acao.run() : undefined;
          },
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

      // Precisa ser declarada ANTES de qualquer criarArquivoExtra: a
      // restauração dos arquivos salvos (mais abaixo) já monta a barra de
      // cada arquivo durante a inicialização. Declarada depois, ela ainda
      // seria `undefined` e o erro derrubava a inicialização inteira —
      // nenhum botão da barra superior chegava a receber listener.
      var ICONES_DE_LINGUAGEM = {
        html: svgFavicon('#E44D26', '#fff', '5'),
        css: svgFavicon('#1572B6', '#fff', '3'),
        scss: svgFavicon('#CF649A', '#fff', 'Sc', 7.5),
        javascript: svgFavicon('#F7DF1E', '#1a1a1a', 'JS'),
        typescript: svgFavicon('#3178C6', '#fff', 'TS'),
        javascriptreact: svgFavicon('#20232A', '#61DAFB', 'JSX', 6),
        markdown: svgFavicon('#1a1a1a', '#fff', 'M↓', 7.5),
        svg: svgFavicon('#1a1a1a', '#FFB13B', 'SVG', 6.5),
        json: svgFavicon('#5A5A5A', '#F5DE19', '{ }', 6.5),
        xml: svgFavicon('#E37933', '#fff', '</>', 6),
        plaintext: svgFavicon('#6b7280', '#fff', 'TXT', 6)
      };

      // Ícones de arquivo do VS Code (Material Icon Theme, licença MIT — github.com/material-extensions/vscode-material-icon-theme).
      var ICONES_VSCODE = {"html":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#e65100\" d=\"m4 4 2 22 10 2 10-2 2-22Zm19.72 7H11.28l.29 3h11.86l-.802 9.335L15.99 25l-6.635-1.646L8.93 19h3.02l.19 2 3.86.77 3.84-.77.29-4H8.84L8 8h16Z\"/></svg>","css":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#7e57c2\" d=\"M20 18h-2v-2h-2v2c0 .193 0 .703 1.254 1.033A3.345 3.345 0 0 1 20 22h2v2h2v-2c0-.388-.562-.851-1.254-1.034C20.356 20.34 20 18.84 20 18m-3.254 2.966C14.356 20.34 14 18.84 14 18h-2v-2h-2v8h2v-2h4v2h2v-2c0-.388-.562-.851-1.254-1.034\"/><path fill=\"#7e57c2\" d=\"M24 4H4v20a4 4 0 0 0 4 4h16.16A3.84 3.84 0 0 0 28 24.16V8a4 4 0 0 0-4-4m2 14h-2v-2h-2v2c0 .193 0 .703 1.254 1.033A3.345 3.345 0 0 1 26 22v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2 2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2 2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1 2-2h2a2 2 0 0 1 2 2Z\"/></svg>","sass":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ec407a\" d=\"M27.837 5.673a4.33 4.33 0 0 0-2.293-2.701c-2.362-1.261-6.11-1.298-9.548-.092a26.3 26.3 0 0 0-8.76 4.966c-2.752 2.542-3.438 4.925-3.189 6.194.523 2.668 3.274 4.539 5.485 6.042.418.284.822.559 1.175.816-1.429.76-4.261 2.444-5.088 4.248a3.88 3.88 0 0 0-.118 3.332A2.37 2.37 0 0 0 6.869 29.8a5.6 5.6 0 0 0 1.49.2 6.35 6.35 0 0 0 5.19-2.856 6.74 6.74 0 0 0 .864-5.382 7.3 7.3 0 0 1 2.044-.03 3.92 3.92 0 0 1 2.816 1.311 1.82 1.82 0 0 1 .423 1.262 1.55 1.55 0 0 1-.772 1.05c-.234.14-.586.355-.504.803.036.194.198.633.894.512a2.93 2.93 0 0 0 2.145-2.651 4 4 0 0 0-1.197-2.904 5.94 5.94 0 0 0-4.396-1.626 10.6 10.6 0 0 0-2.672.304 20 20 0 0 0-2.203-1.846c-1.712-1.3-3.33-2.529-3.235-4.26.125-2.263 2.468-4.532 6.964-6.744 4.016-1.976 7.254-2.037 8.944-1.438a2 2 0 0 1 1.204.883 2.77 2.77 0 0 1-.36 2.47 9.71 9.71 0 0 1-7.425 4.304 3.86 3.86 0 0 1-3.238-.757c-.278-.302-.593-.645-1.074-.383q-.565.31-.225 1.189a3.9 3.9 0 0 0 2.407 1.92 11.7 11.7 0 0 0 7.128-.671c3.527-1.35 6.681-5.202 5.756-8.787M11.895 24.475a4 4 0 0 1-.192.468 4.5 4.5 0 0 1-.753 1.081 2.83 2.83 0 0 1-2.533 1.107c-.056-.032-.078-.146-.085-.193a3.28 3.28 0 0 1 1.076-2.284 11.3 11.3 0 0 1 2.644-1.933 3.85 3.85 0 0 1-.157 1.754\"/></svg>","less":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#0277bd\" d=\"M8 3a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2H3v2h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2v-2H8v-5a2 2 0 0 0-2-2 2 2 0 0 0 2-2V5h2V3m6 0a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1v2h-1a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2v-2h2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5h-2V3z\"/></svg>","javascript":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><path fill=\"#ffca28\" d=\"M2 2v12h12V2zm6 6h1v4a1.003 1.003 0 0 1-1 1H7a1.003 1.003 0 0 1-1-1v-1h1v1h1zm3 0h2v1h-2v1h1a1.003 1.003 0 0 1 1 1v1a1.003 1.003 0 0 1-1 1h-2v-1h2v-1h-1a1.003 1.003 0 0 1-1-1V9a1.003 1.003 0 0 1 1-1\"/></svg>","typescript":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" xml:space=\"preserve\" viewBox=\"0 0 16 16\"><path fill=\"#0288d1\" d=\"M2 2v12h12V2zm4 6h3v1H8v4H7V9H6zm5 0h2v1h-2v1h1a1.003 1.003 0 0 1 1 1v1a1.003 1.003 0 0 1-1 1h-2v-1h2v-1h-1a1.003 1.003 0 0 1-1-1V9a1.003 1.003 0 0 1 1-1\"/></svg>","react":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#00bcd4\" d=\"M16 12c7.444 0 12 2.59 12 4s-4.556 4-12 4-12-2.59-12-4 4.556-4 12-4m0-2c-7.732 0-14 2.686-14 6s6.268 6 14 6 14-2.686 14-6-6.268-6-14-6\"/><path fill=\"#00bcd4\" d=\"M16 14a2 2 0 1 0 2 2 2 2 0 0 0-2-2\"/><path fill=\"#00bcd4\" d=\"M10.458 5.507c2.017 0 5.937 3.177 9.006 8.493 3.722 6.447 3.757 11.687 2.536 12.392a.9.9 0 0 1-.457.1c-2.017 0-5.938-3.176-9.007-8.492C8.814 11.553 8.779 6.313 10 5.608a.9.9 0 0 1 .458-.1m-.001-2A2.87 2.87 0 0 0 9 3.875C6.13 5.532 6.938 12.304 10.804 19c3.284 5.69 7.72 9.493 10.74 9.493A2.87 2.87 0 0 0 23 28.124c2.87-1.656 2.062-8.428-1.804-15.124-3.284-5.69-7.72-9.493-10.74-9.493Z\"/><path fill=\"#00bcd4\" d=\"M21.543 5.507a.9.9 0 0 1 .457.1c1.221.706 1.186 5.946-2.536 12.393-3.07 5.316-6.99 8.493-9.007 8.493a.9.9 0 0 1-.457-.1C8.779 25.686 8.814 20.446 12.536 14c3.07-5.316 6.99-8.493 9.007-8.493m0-2c-3.02 0-7.455 3.804-10.74 9.493C6.939 19.696 6.13 26.468 9 28.124a2.87 2.87 0 0 0 1.457.369c3.02 0 7.455-3.804 10.74-9.493C25.061 12.304 25.87 5.532 23 3.876a2.87 2.87 0 0 0-1.457-.369\"/></svg>","react_ts":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#0288d1\" d=\"M16 12c7.444 0 12 2.59 12 4s-4.556 4-12 4-12-2.59-12-4 4.556-4 12-4m0-2c-7.732 0-14 2.686-14 6s6.268 6 14 6 14-2.686 14-6-6.268-6-14-6\"/><path fill=\"#0288d1\" d=\"M16 14a2 2 0 1 0 2 2 2 2 0 0 0-2-2\"/><path fill=\"#0288d1\" d=\"M10.458 5.507c2.017 0 5.937 3.177 9.006 8.493 3.722 6.447 3.757 11.687 2.536 12.392a.9.9 0 0 1-.457.1c-2.017 0-5.938-3.176-9.007-8.492C8.814 11.553 8.779 6.313 10 5.608a.9.9 0 0 1 .458-.1m-.001-2A2.87 2.87 0 0 0 9 3.875C6.13 5.532 6.938 12.304 10.804 19c3.284 5.69 7.72 9.493 10.74 9.493A2.87 2.87 0 0 0 23 28.124c2.87-1.656 2.062-8.428-1.804-15.124-3.284-5.69-7.72-9.493-10.74-9.493Z\"/><path fill=\"#0288d1\" d=\"M21.543 5.507a.9.9 0 0 1 .457.1c1.221.706 1.186 5.946-2.536 12.393-3.07 5.316-6.99 8.493-9.007 8.493a.9.9 0 0 1-.457-.1C8.779 25.686 8.814 20.446 12.536 14c3.07-5.316 6.99-8.493 9.007-8.493m0-2c-3.02 0-7.455 3.804-10.74 9.493C6.939 19.696 6.13 26.468 9 28.124a2.87 2.87 0 0 0 1.457.369c3.02 0 7.455-3.804 10.74-9.493C25.061 12.304 25.87 5.532 23 3.876a2.87 2.87 0 0 0-1.457-.369\"/></svg>","json":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 -960 960 960\"><path fill=\"#f9a825\" d=\"M560-160v-80h120q17 0 28.5-11.5T720-280v-80q0-38 22-69t58-44v-14q-36-13-58-44t-22-69v-80q0-17-11.5-28.5T680-720H560v-80h120q50 0 85 35t35 85v80q0 17 11.5 28.5T840-560h40v160h-40q-17 0-28.5 11.5T800-360v80q0 50-35 85t-85 35zm-280 0q-50 0-85-35t-35-85v-80q0-17-11.5-28.5T120-400H80v-160h40q17 0 28.5-11.5T160-600v-80q0-50 35-85t85-35h120v80H280q-17 0-28.5 11.5T240-680v80q0 38-22 69t-58 44v14q36 13 58 44t22 69v80q0 17 11.5 28.5T280-240h120v80z\"/></svg>","xml":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#8bc34a\" d=\"M13 9h5.5L13 3.5zM6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4c0-1.11.89-2 2-2m.12 13.5 3.74 3.74 1.42-1.41-2.33-2.33 2.33-2.33-1.42-1.41zm11.16 0-3.74-3.74-1.42 1.41 2.33 2.33-2.33 2.33 1.42 1.41z\"/></svg>","markdown":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#42a5f5\" d=\"m14 10-4 3.5L6 10H4v12h4v-6l2 2 2-2v6h4V10zm12 6v-6h-4v6h-4l6 8 6-8z\"/></svg>","svg":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ffb300\" d=\"M29.168 14.03a2.7 2.7 0 0 0-1.968-.83 2.51 2.51 0 0 0-1.929.8h-4.443l3.078-3.078a2.835 2.835 0 0 0 2.857-2.842 2.6 2.6 0 0 0-.831-1.969 2.82 2.82 0 0 0-2.014-.788 2.67 2.67 0 0 0-1.968.788 2.36 2.36 0 0 0-.812 1.922L18 11.17V6.726a2.51 2.51 0 0 0 .8-1.929 2.7 2.7 0 0 0-.832-1.968 2.745 2.745 0 0 0-3.936 0 2.7 2.7 0 0 0-.832 1.968 2.51 2.51 0 0 0 .8 1.93v4.443l-3.138-3.138a2.36 2.36 0 0 0-.812-1.922 2.66 2.66 0 0 0-1.968-.788 2.83 2.83 0 0 0-2.014.788 2.6 2.6 0 0 0-.831 1.969 2.74 2.74 0 0 0 .831 2.013 2.8 2.8 0 0 0 2.026.829l3.078 3.078H6.729a2.51 2.51 0 0 0-1.929-.8 2.7 2.7 0 0 0-1.968.831 2.745 2.745 0 0 0 0 3.937 2.7 2.7 0 0 0 1.968.832 2.51 2.51 0 0 0 1.929-.8h4.443l-3.078 3.077a2.835 2.835 0 0 0-2.857 2.842 2.6 2.6 0 0 0 .831 1.969 2.82 2.82 0 0 0 2.014.788 2.67 2.67 0 0 0 1.968-.788 2.36 2.36 0 0 0 .812-1.922L14 20.827v4.444a2.51 2.51 0 0 0-.8 1.929 2.784 2.784 0 0 0 4.768 1.968A2.7 2.7 0 0 0 18.8 27.2a2.51 2.51 0 0 0-.8-1.929v-4.444l3.138 3.138a2.36 2.36 0 0 0 .812 1.922 2.66 2.66 0 0 0 1.968.788 2.83 2.83 0 0 0 2.014-.788 2.6 2.6 0 0 0 .831-1.969 2.74 2.74 0 0 0-.831-2.013 2.8 2.8 0 0 0-2.026-.829L20.828 18h4.443a2.51 2.51 0 0 0 1.93.8 2.784 2.784 0 0 0 1.967-4.769Z\"/></svg>","document":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\"><path d=\"M0 0h24v24H0z\"/><path fill=\"#42a5f5\" d=\"M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8zm4 18H6V4h7v5h5z\"/></svg>","python":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#0288d1\" d=\"M9.86 2A2.86 2.86 0 0 0 7 4.86v1.68h4.29c.39 0 .71.57.71.96H4.86A2.86 2.86 0 0 0 2 10.36v3.781a2.86 2.86 0 0 0 2.86 2.86h1.18v-2.68a2.85 2.85 0 0 1 2.85-2.86h5.25c1.58 0 2.86-1.271 2.86-2.851V4.86A2.86 2.86 0 0 0 14.14 2zm-.72 1.61c.4 0 .72.12.72.71s-.32.891-.72.891c-.39 0-.71-.3-.71-.89s.32-.711.71-.711\"/><path fill=\"#fdd835\" d=\"M17.959 7v2.68a2.85 2.85 0 0 1-2.85 2.859H9.86A2.85 2.85 0 0 0 7 15.389v3.75a2.86 2.86 0 0 0 2.86 2.86h4.28A2.86 2.86 0 0 0 17 19.14v-1.68h-4.291c-.39 0-.709-.57-.709-.96h7.14A2.86 2.86 0 0 0 22 13.64V9.86A2.86 2.86 0 0 0 19.14 7zM8.32 11.513l-.004.004.038-.004zm6.54 7.276c.39 0 .71.3.71.89a.71.71 0 0 1-.71.71c-.4 0-.72-.12-.72-.71s.32-.89.72-.89\"/></svg>","java":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#f44336\" d=\"M4 26h24v2H4zM28 4H7a1 1 0 0 0-1 1v13a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-4h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 8h-4V6h4Z\"/></svg>","c":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#0288d1\" d=\"M19.563 22A5.57 5.57 0 0 1 14 16.437v-2.873A5.57 5.57 0 0 1 19.563 8H24V2h-4.437A11.563 11.563 0 0 0 8 13.563v2.873A11.564 11.564 0 0 0 19.563 28H24v-6Z\"/></svg>","cpp":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#0288d1\" d=\"M28 14v-4h-2v4h-6v-4h-2v4h-4v2h4v4h2v-4h6v4h2v-4h4v-2z\"/><path fill=\"#0288d1\" d=\"M13.563 22A5.57 5.57 0 0 1 8 16.437v-2.873A5.57 5.57 0 0 1 13.563 8H18V2h-4.437A11.563 11.563 0 0 0 2 13.563v2.873A11.564 11.564 0 0 0 13.563 28H18v-6Z\"/></svg>","h":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#0288d1\" d=\"M18.5 11a5.49 5.49 0 0 0-4.5 2.344V4H8v24h6V17a2 2 0 0 1 4 0v11h6V16.5a5.5 5.5 0 0 0-5.5-5.5\"/></svg>","hpp":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#0288d1\" d=\"M28 6V2h-2v4h-6V2h-2v4h-4v2h4v4h2V8h6v4h2V8h4V6zm-15.5 5A5.49 5.49 0 0 0 8 13.344V4H2v24h6V17a2 2 0 0 1 4 0v11h6V16.5a5.5 5.5 0 0 0-5.5-5.5\"/></svg>","csharp":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#0288d1\" d=\"M30 14v-2h-2V8h-2v4h-2V8h-2v4h-2v2h2v2h-2v2h2v4h2v-4h2v4h2v-4h2v-2h-2v-2Zm-4 2h-2v-2h2Zm-12.437 6A5.57 5.57 0 0 1 8 16.437v-2.873A5.57 5.57 0 0 1 13.563 8H18V2h-4.437A11.563 11.563 0 0 0 2 13.563v2.873A11.564 11.564 0 0 0 13.563 28H18v-6Z\"/></svg>","php":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#1e88e5\" d=\"M12 18.08c-6.63 0-12-2.72-12-6.08s5.37-6.08 12-6.08S24 8.64 24 12s-5.37 6.08-12 6.08m-5.19-7.95c.54 0 .91.1 1.09.31.18.2.22.56.13 1.03-.1.53-.29.87-.58 1.09q-.42.33-1.29.33h-.87l.53-2.76zm-3.5 5.55h1.44l.34-1.75h1.23c.54 0 .98-.06 1.33-.17.35-.12.67-.31.96-.58.24-.22.43-.46.58-.73.15-.26.26-.56.31-.88.16-.78.05-1.39-.33-1.82-.39-.44-.99-.65-1.82-.65H4.59zm7.25-8.33-1.28 6.58h1.42l.74-3.77h1.14c.36 0 .6.06.71.18s.13.34.07.66l-.57 2.93h1.45l.59-3.07c.13-.62.03-1.07-.27-1.36-.3-.27-.85-.4-1.65-.4h-1.27L12 7.35zM18 10.13c.55 0 .91.1 1.09.31.18.2.22.56.13 1.03-.1.53-.29.87-.57 1.09-.29.22-.72.33-1.3.33h-.85l.5-2.76zm-3.5 5.55h1.44l.34-1.75h1.22c.55 0 1-.06 1.35-.17.35-.12.65-.31.95-.58.24-.22.44-.46.58-.73.15-.26.26-.56.32-.88.15-.78.04-1.39-.34-1.82-.36-.44-.99-.65-1.82-.65h-2.75z\"/></svg>","ruby":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#f44336\" d=\"M18.041 3.177c2.24.382 2.879 1.919 2.843 3.527V6.67l-1.013 13.266-13.132.897h.008c-1.093-.044-3.518-.151-3.634-3.545l1.217-2.222 2.462 5.74 2.097-6.77-.045.009.018-.018 6.85 2.186L13.945 9.3l6.53-.409-5.144-4.212 2.71-1.51v.009M3.113 17.252v.017zM6.916 6.874c2.63-2.622 6.033-4.168 7.34-2.844 1.297 1.306-.072 4.523-2.702 7.135-2.666 2.613-6.015 4.248-7.322 2.933-1.306-1.324.036-4.612 2.675-7.224z\"/></svg>","go":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#00acc1\" d=\"M2 12h4v2H2zm-2 4h6v2H0zm4 4h2v2H4zm16.954-5H14v3h3.239a4.42 4.42 0 0 1-3.531 2 2.65 2.65 0 0 1-2.053-.858 2.86 2.86 0 0 1-.628-2.28A4.515 4.515 0 0 1 15.292 13a2.73 2.73 0 0 1 1.749.584l2.962-1.185A5.6 5.6 0 0 0 15.292 10a7.526 7.526 0 0 0-7.243 6.5 5.614 5.614 0 0 0 5.659 6.5 7.526 7.526 0 0 0 7.243-6.5 6.4 6.4 0 0 0 .003-1.5\"/><path fill=\"#00acc1\" d=\"M26.292 10a7.526 7.526 0 0 0-7.243 6.5 5.614 5.614 0 0 0 5.659 6.5 7.526 7.526 0 0 0 7.243-6.5 5.614 5.614 0 0 0-5.659-6.5m2.681 6.137A4.515 4.515 0 0 1 24.708 20a2.65 2.65 0 0 1-2.053-.858 2.86 2.86 0 0 1-.628-2.28A4.515 4.515 0 0 1 26.292 13a2.65 2.65 0 0 1 2.053.858 2.86 2.86 0 0 1 .628 2.28Z\"/></svg>","rust":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ff7043\" d=\"m30 12-4-2V6h-4l-2-4-4 2-4-2-2 4H6v4l-4 2 2 4-2 4 4 2v4h4l2 4 4-2 4 2 2-4h4v-4l4-2-2-4ZM6 16a9.9 9.9 0 0 1 .842-4H10v8H6.842A9.9 9.9 0 0 1 6 16m10 10a9.98 9.98 0 0 1-7.978-4H16v-2h-2v-2h4c.819.819.297 2.308 1.179 3.37a1.89 1.89 0 0 0 1.46.63h3.34A9.98 9.98 0 0 1 16 26m-2-12v-2h4a1 1 0 0 1 0 2Zm11.158 6H24a2.006 2.006 0 0 1-2-2 2 2 0 0 0-2-2 3 3 0 0 0 3-3q0-.08-.004-.161A3.115 3.115 0 0 0 19.83 10H8.022a9.986 9.986 0 0 1 17.136 10\"/></svg>","swift":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#ff6e40\" d=\"M17.087 19.721c-2.36 1.36-5.59 1.5-8.86.1a13.8 13.8 0 0 1-6.23-5.32c.67.55 1.46 1 2.3 1.4 3.37 1.57 6.73 1.46 9.1 0-3.37-2.59-6.24-5.96-8.37-8.71-.45-.45-.78-1.01-1.12-1.51 8.28 6.05 7.92 7.59 2.41-1.01 4.89 4.94 9.43 7.74 9.43 7.74.16.09.25.16.36.22.1-.25.19-.51.26-.78.79-2.85-.11-6.12-2.08-8.81 4.55 2.75 7.25 7.91 6.12 12.24-.03.11-.06.22-.05.39 2.24 2.83 1.64 5.78 1.35 5.22-1.21-2.39-3.48-1.65-4.62-1.17\"/></svg>","kotlin":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 24 24\"><defs><linearGradient id=\"a\" x1=\"1.725\" x2=\"22.185\" y1=\"22.67\" y2=\"1.982\" gradientTransform=\"translate(1.306 1.129)scale(.89324)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#7c4dff\"/><stop offset=\".5\" stop-color=\"#d500f9\"/><stop offset=\"1\" stop-color=\"#ef5350\"/></linearGradient></defs><path fill=\"url(#a)\" d=\"M2.975 2.976v18.048h18.05v-.03l-4.478-4.511-4.48-4.515 4.48-4.515 4.443-4.477z\"/></svg>","database":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ffca28\" d=\"M16 24c-5.525 0-10-.9-10-2v4c0 1.1 4.475 2 10 2s10-.9 10-2v-4c0 1.1-4.475 2-10 2m0-8c-5.525 0-10-.9-10-2v4c0 1.1 4.475 2 10 2s10-.9 10-2v-4c0 1.1-4.475 2-10 2m0-12C10.477 4 6 4.895 6 6v4c0 1.1 4.475 2 10 2s10-.9 10-2V6c0-1.105-4.477-2-10-2\"/></svg>","console":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><path fill=\"#ff7043\" d=\"M2 2a1 1 0 0 0-1 1v10c0 .554.446 1 1 1h12c.554 0 1-.446 1-1V3a1 1 0 0 0-1-1zm0 3h12v8H2zm1 2 2 2-2 2 1 1 3-3-3-3zm5 3.5V12h5v-1.5z\"/></svg>","yaml":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#ff5252\" d=\"M13 9h5.5L13 3.5zM6 2h8l6 6v12c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2m12 16v-2H9v2zm-4-4v-2H6v2z\"/></svg>","toml":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><path fill=\"#cfd8dc\" d=\"M4 6V4h8v2H9v7H7V6z\"/><path fill=\"#ef5350\" d=\"M4 1v1H2v12h2v1H1V1zm8 0v1h2v12h-2v1h3V1z\"/></svg>","settings":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\"><path d=\"M0 0h24v24H0z\"/><path fill=\"#42a5f5\" d=\"M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.6.6 0 0 0-.18-.03c-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1q.09.03.18.03c.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64zm-1.98-1.71c.04.31.05.52.05.73s-.02.43-.05.73l-.14 1.13.89.7 1.08.84-.7 1.21-1.27-.51-1.04-.42-.9.68c-.43.32-.84.56-1.25.73l-1.06.43-.16 1.13-.2 1.35h-1.4l-.19-1.35-.16-1.13-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7-1.06.43-1.27.51-.7-1.21 1.08-.84.89-.7-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13-.89-.7-1.08-.84.7-1.21 1.27.51 1.04.42.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43.16-1.13.2-1.35h1.39l.19 1.35.16 1.13 1.06.43c.43.18.83.41 1.23.71l.91.7 1.06-.43 1.27-.51.7 1.21-1.07.85-.89.7zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2\"/></svg>","tune":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#fbc02d\" d=\"M12 10h10v2H12z\"/><path fill=\"#fbc02d\" d=\"M16 4h2v8h-2zm4 18h10v2H20zm4 2h2v4h-2zm0-20h2v14h-2zM2 18h10v2H2z\"/><path fill=\"#fbc02d\" d=\"M6 18h2v10H6zM6 4h2v10H6zm10 12h2v12h-2z\"/></svg>","table":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#8bc34a\" d=\"M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m7 1.5V9h5.5zm4 7.5h-4v2h1l-2 1.67L10 13h1v-2H7v2h1l3 2.5L8 18H7v2h4v-2h-1l2-1.67L14 18h-1v2h4v-2h-1l-3-2.5 3-2.5h1z\"/></svg>","vue":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#41b883\" d=\"M1.791 3.851 12 21.471 22.209 3.936V3.85H18.24l-6.18 10.616L5.906 3.851z\"/><path fill=\"#35495e\" d=\"m5.907 3.851 6.152 10.617L18.24 3.851h-3.723L12.084 8.03 9.66 3.85z\"/></svg>","svelte":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 300\"><path fill=\"#ff5722\" d=\"M175.94 24.328c-13.037.252-26.009 3.872-37.471 11.174L79.912 72.818a67.13 67.13 0 0 0-30.355 44.906 70.8 70.8 0 0 0 6.959 45.445 67.2 67.2 0 0 0-10.035 25.102 71.54 71.54 0 0 0 12.236 54.156c23.351 33.41 69.468 43.311 102.81 22.07l58.559-37.158a67.36 67.36 0 0 0 30.355-44.906 70.77 70.77 0 0 0-6.982-45.422 67.65 67.65 0 0 0 10.059-25.102 71.63 71.63 0 0 0-12.236-54.156v-.18c-15.324-21.925-40.453-33.727-65.342-33.246zm5.137 28.68a46.5 46.5 0 0 1 36.09 19.969 42.98 42.98 0 0 1 7.365 32.557 45 45 0 0 1-1.393 5.455l-1.123 3.37-2.986-2.247a75.9 75.9 0 0 0-22.902-11.45l-2.244-.651.201-2.246a13.16 13.16 0 0 0-2.379-8.711 13.99 13.99 0 0 0-14.953-5.412 12.8 12.8 0 0 0-3.594 1.572l-58.578 37.25a12.24 12.24 0 0 0-5.502 8.15 13.1 13.1 0 0 0 2.246 9.834 14.03 14.03 0 0 0 14.93 5.569 13.5 13.5 0 0 0 3.594-1.573l22.453-14.234a41.8 41.8 0 0 1 11.898-5.232 46.48 46.48 0 0 1 49.914 18.502 43.02 43.02 0 0 1 7.363 32.557 40.42 40.42 0 0 1-18.254 27.078l-58.58 37.316a43 43 0 0 1-11.898 5.23A46.545 46.545 0 0 1 82.81 227.14a42.98 42.98 0 0 1-7.341-32.557 38 38 0 0 1 1.39-5.41l1.102-3.37 3.008 2.246a75.9 75.9 0 0 0 22.836 11.361l2.244.65-.201 2.247a13.25 13.25 0 0 0 2.447 8.644 14.03 14.03 0 0 0 15.043 5.569 13.1 13.1 0 0 0 3.592-1.573l58.467-37.316a12.17 12.17 0 0 0 5.502-8.173 12.96 12.96 0 0 0-2.246-9.811 14.03 14.03 0 0 0-15.043-5.568 12.8 12.8 0 0 0-3.592 1.57l-22.453 14.258a42.9 42.9 0 0 1-11.877 5.209 46.52 46.52 0 0 1-49.846-18.5 43.02 43.02 0 0 1-7.297-32.557A40.42 40.42 0 0 1 96.798 96.98l58.646-37.316a42.8 42.8 0 0 1 11.811-5.21 46.5 46.5 0 0 1 13.822-1.444z\"/></svg>","lua":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#42a5f5\" d=\"M30 6a3.86 3.86 0 0 1-1.167 2.833 4.024 4.024 0 0 1-5.666 0A3.86 3.86 0 0 1 22 6a3.86 3.86 0 0 1 1.167-2.833 4.024 4.024 0 0 1 5.666 0A3.86 3.86 0 0 1 30 6m-9.208 5.208A10.6 10.6 0 0 0 13 8a10.6 10.6 0 0 0-7.792 3.208A10.6 10.6 0 0 0 2 19a10.6 10.6 0 0 0 3.208 7.792A10.6 10.6 0 0 0 13 30a10.6 10.6 0 0 0 7.792-3.208A10.6 10.6 0 0 0 24 19a10.6 10.6 0 0 0-3.208-7.792m-1.959 7.625a4.024 4.024 0 0 1-5.666 0 4.024 4.024 0 0 1 0-5.666 4.024 4.024 0 0 1 5.666 0 4.024 4.024 0 0 1 0 5.666\"/></svg>","dart":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#4fc3f7\" d=\"M16.83 2a1.3 1.3 0 0 0-.916.377l-.013.01L7.323 7.34l8.556 8.55v.005l10.283 10.277 1.96-3.529-7.068-16.96-3.299-3.297A1.3 1.3 0 0 0 16.828 2Z\"/><path fill=\"#01579b\" d=\"m7.343 7.32-4.955 8.565-.01.013a1.297 1.297 0 0 0 .004 1.835l.005.005 4.106 4.107 16.064 6.314 3.632-2.015-.098-.098-.025.002L15.995 15.97h-.012z\"/><path fill=\"#01579b\" d=\"m7.321 7.324 8.753 8.755h.013L26.16 26.156l3.835-.73L30 14.089l-4.049-3.965a6.5 6.5 0 0 0-3.618-1.612l.002-.043L7.323 7.325Z\"/><path fill=\"#64b5f6\" d=\"m7.332 7.335 8.758 8.75v.013l10.079 10.071L25.436 30H14.09l-3.967-4.048a6.5 6.5 0 0 1-1.611-3.618l-.045.004Z\"/></svg>","r":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#1976d2\" d=\"M11.956 4.05c-5.694 0-10.354 3.106-10.354 6.947 0 3.396 3.686 6.212 8.531 6.813v2.205h3.53V17.82c.88-.093 1.699-.259 2.475-.497l1.43 2.692h3.996l-2.402-4.048c1.936-1.263 3.147-3.034 3.147-4.97 0-3.841-4.659-6.947-10.354-6.947m1.584 2.712c4.349 0 7.558 1.45 7.558 4.753 0 1.77-.952 3.013-2.505 3.779a1 1 0 0 1-.228-.156c-.373-.165-.994-.352-.994-.352s3.085-.227 3.085-3.302-3.23-3.127-3.23-3.127h-7.092v7.413c-2.64-.766-4.462-2.392-4.462-4.255 0-2.63 3.52-4.753 7.868-4.753m.156 4.12h2.143s.983-.05.983.974c0 1.004-.983 1.004-.983 1.004h-2.143v-1.977m-.031 4.566h.952c.186 0 .28.052.445.207.135.103.28.3.404.476-.57.073-1.17.104-1.801.104z\"/></svg>","prolog":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#ef5350\" d=\"M12 15.385a5.1 5.1 0 0 0 1.862 1.693L12 18.94l-1.862-1.862A5.04 5.04 0 0 0 12 15.385m4.232-4.063a1.693 1.693 0 0 0-1.693 1.693 1.693 1.693 0 0 0 1.693 1.693 1.693 1.693 0 0 0 1.693-1.693c0-.94-.762-1.693-1.693-1.693m-8.464 0a1.693 1.693 0 0 0-1.693 1.693 1.693 1.693 0 0 0 1.693 1.693 1.693 1.693 0 0 0 1.693-1.693c0-.94-.762-1.693-1.693-1.693m8.464-2.116a3.385 3.385 0 0 1 3.385 3.386 3.385 3.385 0 0 1-3.385 3.385 3.385 3.385 0 0 1-3.386-3.385 3.385 3.385 0 0 1 3.386-3.386m-8.464 0a3.385 3.385 0 0 1 3.386 3.386 3.385 3.385 0 0 1-3.386 3.385 3.385 3.385 0 0 1-3.385-3.385 3.385 3.385 0 0 1 3.385-3.386M3.74 2.69c1.49 3.132.415 5.468-.584 7.787a5.1 5.1 0 0 0-.465 2.116 5.08 5.08 0 0 0 5.078 5.078 6 6 0 0 0 .533-.042l2.506 2.505L12 21.31l1.194-1.177 2.505-2.505c.178.025.355.034.533.042a5.08 5.08 0 0 0 5.078-5.078 5.1 5.1 0 0 0-.465-2.116c-.999-2.319-2.074-4.655-.584-7.787-2.235 1.744-5.417 3.123-8.26 3.132-2.845-.008-6.027-1.388-8.261-3.132z\"/></svg>","gradle":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#0097a7\" d=\"M16 10v2h6c-2 0-3-2-6-2\"/><path fill=\"#0097a7\" d=\"M26 4h-2a4 4 0 0 0-4 4h4a1 1 0 0 1 2 0v4H16v-2h-5.317A2.683 2.683 0 0 0 8 12.683v2.634A2.683 2.683 0 0 0 10.683 18H16v2h-5.98A4.02 4.02 0 0 1 6 16v-2c-2 0-4 4-4 8 0 5 1 6 2 6h4v-4h4v4h4v-4h4v4h4v-6a2 2 0 0 0 2-2v-2a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4m-4 12h-2a2 2 0 0 1-2-2h6a2 2 0 0 1-2 2\"/></svg>","visualstudio":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ab47bc\" d=\"m22 11.8-5.7 4.584L22 20.8zM7.24 23.68 4 21.64v-10.8l3.6-1.2 5.16 3.996L23.2 4 28 7v18.6L22 28l-9.192-8.808zm.36-5.28 2.232-2.064L7.6 14.2Z\"/></svg>","powershell":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#03a9f4\" d=\"M29.07 6H7.677A1.535 1.535 0 0 0 6.24 7.113l-4.2 17.774A.852.852 0 0 0 2.93 26h21.393a1.535 1.535 0 0 0 1.436-1.113L29.96 7.112A.852.852 0 0 0 29.07 6M8.626 23.797a1.4 1.4 0 0 1-1.814-.31l-.007-.009a1.075 1.075 0 0 1 .315-1.599l9.6-6.061-6.102-5.852-.01-.01a1.068 1.068 0 0 1 .084-1.625l.037-.03a1.38 1.38 0 0 1 1.8.07l7.233 6.957a1.1 1.1 0 0 1 .236.739 1.08 1.08 0 0 1-.412.79c-.074.04-.146.119-10.951 6.935ZM24 22.94A1.135 1.135 0 0 1 22.803 24h-5.634a1.061 1.061 0 1 1 .001-2.112h5.633A1.134 1.134 0 0 1 24 22.938Z\"/></svg>","image":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><path fill=\"#26a69a\" d=\"M8.5 6h4l-4-4zM3.875 1H9.5l4 4v8.6c0 .773-.616 1.4-1.375 1.4h-8.25c-.76 0-1.375-.627-1.375-1.4V2.4c0-.777.612-1.4 1.375-1.4M4 13.6h8V8l-2.625 2.8L8 9.4zm1.25-7.7c-.76 0-1.375.627-1.375 1.4s.616 1.4 1.375 1.4c.76 0 1.375-.627 1.375-1.4S6.009 5.9 5.25 5.9\"/></svg>","pdf":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#ef5350\" d=\"M13 9h5.5L13 3.5zM6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m4.93 10.44c.41.9.93 1.64 1.53 2.15l.41.32c-.87.16-2.07.44-3.34.93l-.11.04.5-1.04c.45-.87.78-1.66 1.01-2.4m6.48 3.81c.18-.18.27-.41.28-.66.03-.2-.02-.39-.12-.55-.29-.47-1.04-.69-2.28-.69l-1.29.07-.87-.58c-.63-.52-1.2-1.43-1.6-2.56l.04-.14c.33-1.33.64-2.94-.02-3.6a.85.85 0 0 0-.61-.24h-.24c-.37 0-.7.39-.79.77-.37 1.33-.15 2.06.22 3.27v.01c-.25.88-.57 1.9-1.08 2.93l-.96 1.8-.89.49c-1.2.75-1.77 1.59-1.88 2.12-.04.19-.02.36.05.54l.03.05.48.31.44.11c.81 0 1.73-.95 2.97-3.07l.18-.07c1.03-.33 2.31-.56 4.03-.75 1.03.51 2.24.74 3 .74.44 0 .74-.11.91-.3m-.41-.71.09.11c-.01.1-.04.11-.09.13h-.04l-.19.02c-.46 0-1.17-.19-1.9-.51.09-.1.13-.1.23-.1 1.4 0 1.8.25 1.9.35M7.83 17c-.65 1.19-1.24 1.85-1.69 2 .05-.38.5-1.04 1.21-1.69zm3.02-6.91c-.23-.9-.24-1.63-.07-2.05l.07-.12.15.05c.17.24.19.56.09 1.1l-.03.16-.16.82z\"/></svg>","zip":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#afb42b\" d=\"M14 17h-2v-2h-2v-2h2v2h2m0-6h-2v2h2v2h-2v-2h-2V9h2V7h-2V5h2v2h2m5-4H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2\"/></svg>","lock":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ffd54f\" d=\"M25 12h-3V8a6 6 0 0 0-12 0v4H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V13a1 1 0 0 0-1-1M14 8a2 2 0 0 1 4 0v4h-4Zm2 17a4 4 0 1 1 4-4 4 4 0 0 1-4 4\"/></svg>","log":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\"><path d=\"M0 0h24v24H0z\"/><path fill=\"#afb42b\" d=\"M19 5v9h-5v5H5V5zm0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10l6-6V5c0-1.1-.9-2-2-2m-7 11H7v-2h5zm5-4H7V8h10z\"/></svg>","docker":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#0288d1\" d=\"M21.81 10.25c-.06-.04-.56-.43-1.64-.43-.28 0-.56.03-.84.08-.21-1.4-1.38-2.11-1.43-2.14l-.29-.17-.18.27c-.24.36-.43.77-.51 1.19-.2.8-.08 1.56.33 2.21-.49.28-1.29.35-1.46.35H2.62c-.34 0-.62.28-.62.63 0 1.15.18 2.3.58 3.38.45 1.19 1.13 2.07 2 2.61.98.6 2.59.94 4.42.94.79 0 1.61-.07 2.42-.22 1.12-.2 2.2-.59 3.19-1.16A8.3 8.3 0 0 0 16.78 16c1.05-1.17 1.67-2.5 2.12-3.65h.19c1.14 0 1.85-.46 2.24-.85.26-.24.45-.53.59-.87l.08-.24zm-17.96.99h1.76c.08 0 .16-.07.16-.16V9.5c0-.08-.07-.16-.16-.16H3.85c-.09 0-.16.07-.16.16v1.58c.01.09.07.16.16.16m2.43 0h1.76c.08 0 .16-.07.16-.16V9.5c0-.08-.07-.16-.16-.16H6.28c-.09 0-.16.07-.16.16v1.58c.01.09.07.16.16.16m2.47 0h1.75c.1 0 .17-.07.17-.16V9.5c0-.08-.06-.16-.17-.16H8.75c-.08 0-.15.07-.15.16v1.58c0 .09.06.16.15.16m2.44 0h1.77c.08 0 .15-.07.15-.16V9.5c0-.08-.06-.16-.15-.16h-1.77c-.08 0-.15.07-.15.16v1.58c0 .09.07.16.15.16M6.28 9h1.76c.08 0 .16-.09.16-.18V7.25c0-.09-.07-.16-.16-.16H6.28c-.09 0-.16.06-.16.16v1.57c.01.09.07.18.16.18m2.47 0h1.75c.1 0 .17-.09.17-.18V7.25c0-.09-.06-.16-.17-.16H8.75c-.08 0-.15.06-.15.16v1.57c0 .09.06.18.15.18m2.44 0h1.77c.08 0 .15-.09.15-.18V7.25c0-.09-.07-.16-.15-.16h-1.77c-.08 0-.15.06-.15.16v1.57c0 .09.07.18.15.18m0-2.28h1.77c.08 0 .15-.07.15-.16V5c0-.1-.07-.17-.15-.17h-1.77c-.08 0-.15.06-.15.17v1.56c0 .08.07.16.15.16m2.46 4.52h1.76c.09 0 .16-.07.16-.16V9.5c0-.08-.07-.16-.16-.16h-1.76c-.08 0-.15.07-.15.16v1.58c0 .09.07.16.15.16\"/></svg>","http":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#e53935\" d=\"M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2m11.3 10h-5.64a22.5 22.5 0 0 0-2.705-7.616A12.03 12.03 0 0 1 27.3 12M20 16c0 .693-.037 1.357-.094 2h-7.811A22 22 0 0 1 12 16c0-.693.037-1.357.094-2h7.811c.058.643.095 1.307.095 2m-4 12c-.115 0-.226-.014-.34-.017A20.4 20.4 0 0 1 12.368 20h7.264a20.4 20.4 0 0 1-3.292 7.983c-.114.003-.225.017-.34.017m-3.632-16a20.4 20.4 0 0 1 3.292-7.983c.114-.003.225-.017.34-.017s.226.014.34.017A20.4 20.4 0 0 1 19.632 12Zm.683-7.618A22.4 22.4 0 0 0 10.339 12H4.7a12.03 12.03 0 0 1 8.35-7.618ZM4.18 14h5.91c-.052.647-.091 1.307-.091 2s.039 1.353.091 2H4.18a11.2 11.2 0 0 1 0-4m.52 6h5.638a22.4 22.4 0 0 0 2.712 7.618A12.03 12.03 0 0 1 4.7 20m14.255 7.616A22.5 22.5 0 0 0 21.661 20H27.3a12.03 12.03 0 0 1-8.344 7.616ZM27.819 18h-5.91c.052-.647.091-1.307.091-2s-.039-1.353-.091-2h5.91a11.2 11.2 0 0 1 0 4\"/></svg>","graphql":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ec407a\" d=\"M6 20h20v2H6z\"/><circle cx=\"7\" cy=\"21\" r=\"3\" fill=\"#ec407a\"/><circle cx=\"16\" cy=\"27\" r=\"3\" fill=\"#ec407a\"/><circle cx=\"25\" cy=\"21\" r=\"3\" fill=\"#ec407a\"/><path fill=\"#ec407a\" d=\"M6 10h20v2H6z\"/><circle cx=\"7\" cy=\"11\" r=\"3\" fill=\"#ec407a\"/><circle cx=\"16\" cy=\"5\" r=\"3\" fill=\"#ec407a\"/><circle cx=\"25\" cy=\"11\" r=\"3\" fill=\"#ec407a\"/><path fill=\"#ec407a\" d=\"M6 12h2v10H6zm18-2h2v12h-2z\"/><path fill=\"#ec407a\" d=\"m5.014 19.41 11.674 6.866L15.674 28 4 21.134z\"/><path fill=\"#ec407a\" d=\"M26.688 21.724 15.014 28.59 14 26.866 25.674 20zM5.124 10.382l11.415-7.29 1.077 1.686L6.2 12.068z\"/><path fill=\"#ec407a\" d=\"m25.798 12.067-11.415-7.29 1.077-1.685 11.415 7.29zM6.2 19.932l11.416 7.29-1.077 1.686-11.415-7.29z\"/><path fill=\"#ec407a\" d=\"m26.875 21.619-11.415 7.29-1.077-1.687 11.415-7.289zM5.877 22.6 16.04 3.686l1.762.946L7.638 23.546z\"/><path fill=\"#ec407a\" d=\"M24.361 23.545 14.197 4.633l1.761-.947 10.165 18.913z\"/></svg>","prisma":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#00bfa5\" d=\"m27.777 22.617-.459-.946L18.43 3.26a2.25 2.25 0 0 0-1.914-1.256A2 2 0 0 0 16.379 2a2.23 2.23 0 0 0-1.891 1.042L4.348 19.056a2.2 2.2 0 0 0 .025 2.417l4.957 7.488A2.34 2.34 0 0 0 11.29 30a2.4 2.4 0 0 0 .655-.092l14.387-4.149a2.32 2.32 0 0 0 1.458-1.234 2.21 2.21 0 0 0-.013-1.908m-3.538.604-11.268 3.25 4.075-19.033 7.568 15.671-.376.098Z\"/></svg>","tex":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\"><path fill=\"#2196f3\" d=\"M80 192 64 320h32c16-80 16-96 63.242-96H176c8.837 0 16 7.163 16 16v352c0 8.837 0 16-32 16h-32v32h192v-32h-32c-32 0-32-7.163-32-16V240c0-8.837 7.163-16 16-16h16c48 0 48 16 64 96h32l-16-128zm560 0v32c16 0 45.713 0 52.57 16L776 434.666 708.57 592c-6.857 16-52.57 16-68.57 16v32h128v-32s-34.285 0-27.428-16L792 472l51.428 120c3.103 7.24-1.52 16-11.428 16v32h128v-32c-16 0-45.713 0-52.57-16L824 397.334 891.43 240c6.857-16 52.57-16 68.57-16v-32H832v32s34.285 0 27.428 16L808 360l-51.428-120c-3.103-7.24 1.52-16 11.428-16v-32zM320 384v32h32c32 0 32 7.163 32 16v352c0 8.837 0 16-32 16h-32v32h304l16-128h-32c-16 80-16 96-64 96h-64c-32 0-32-7.163-32-16V624h80c8.837 0 16 0 16 32v16h32V544h-32v16c0 32-7.163 32-16 32h-80V432c0-8.837 0-16 32-16h64c48 0 48 16 64 96h32l-16-128z\"/></svg>","ejs":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\"><path fill=\"#ffca28\" d=\"M8.046 4.862.908 12l7.138 7.138 2.71-2.691L6.308 12l4.446-4.447z\"/><ellipse cx=\"14.543\" cy=\"7.812\" stroke=\"#ffca28\" stroke-width=\"1.455\" rx=\"2.101\" ry=\"2.798\"/><path fill=\"#ffca28\" d=\"m20.616 4.152 1.47.69-7.783 15.005-1.47-.69z\"/><ellipse cx=\"20.35\" cy=\"16.198\" stroke=\"#ffca28\" stroke-width=\"1.455\" rx=\"2.101\" ry=\"2.798\"/></svg>","pug":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\"><g transform=\"translate(-.25 -1.71)\"><path fill=\"#ffe0b2\" d=\"M107.4 50.9c-.2-4.4.4-8.3-1.6-11.6-4.8-8.2-16.8-13-40.8-13v.7h-.5.5v-.7c-24 0-36.6 4.8-41.4 13.1-1.9 3.4-1.7 7.2-2 11.6-.2 3.5-1.8 7.2-1.1 11.2.8 5.2 1.1 10.4 1.9 15.2.6 3.9 6 7.2 6.5 10.9 1.4 10.2 12 14.9 36 14.9v.8h-.6.7v-.8c24 0 34.2-4.7 35.5-14.9.5-3.8 5.5-7 6.1-10.9.8-4.8 1.1-10 1.9-15.2.7-4-.9-7.8-1.1-11.3\"/><path fill=\"#ffe0b2\" d=\"M64.6 54.5c4.3.1 7.3 2.8 10.1 5.3 3.3 2.9 8.9 4.9 11.2 7.4s5.3 5 6.4 8.9 1.4 8.9 1.4 10.2.7 1 2.7 0c4.7-2.3 9.9-8.5 9.9-8.5-.6 3.9-5.7 7.4-6.2 11.1C98.9 99.1 89 104 64.5 104h-.1.6\"/><path fill=\"#ffe0b2\" d=\"M80.4 46.7c.9 3.1 4.1 13.6-2.1 10.1 0 0 2.6 1.5 4.2 7.2 1.7 5.7 5.8 6.4 5.8 6.4s6.7 1.3 11.7-3c4.2-3.6 4.9-10 3.1-14.9-1.8-4.8-5-6.3-9.7-7.3-4.7-1.1-14.1-2-13 1.5\"/><circle cx=\"92.3\" cy=\"58.1\" r=\"8.8\"/><circle cx=\"90\" cy=\"54.2\" r=\"2.3\" fill=\"#fafafa\"/><path fill=\"#ffe0b2\" d=\"M78.9 57.7s7.9 5.4 12.2 10.7 4.2 6.3 4.2 6.3l-3.1 1.4s-4.4-8.3-9.8-11.4c-5.5-3.1-6.1-5.7-6.1-5.7zm-14-3.2c-4.3.1-7.5 2.8-10.4 5.3-3.3 2.9-9.1 4.9-11.4 7.4s-5.4 5-6.5 8.9-1.5 8.9-1.5 10.2.2 1.4-2.7 0c-4.7-2.2-9.9-8.5-9.9-8.5.6 3.9 5.7 7.4 6.2 11.1C30.1 99.1 40 104 64.5 104h.5\"/><path fill=\"#4e342e\" d=\"M88.1 71.4C83.3 65.5 75.6 60 64.9 60h-.1c-10.7 0-18.4 5.5-23.2 11.4-5 6.1-4.6 8.5-4.6 14.3 0 21 7.4 15 12.3 17.6 5 2.5 10.2 1.7 15.5 1.7h.1c5.4 0 10.5.7 15.5-1.8 4.9-2.5 12.3 3.7 12.3-17.3.1-5.8.4-8.4-4.6-14.5\"/><path fill=\"#3e2723\" d=\"M64.4 65.2s-.7 9.7-2.1 11.6l2.6-.6z\"/><path fill=\"#3e2723\" d=\"M65.1 65.2s.7 9.7 2.1 11.6l-2.6-.6z\"/><path fill=\"#4e342e\" d=\"M56.7 62.9c-1-2.3 2.6-6 8.3-6.1 5.7 0 9.3 3.7 8.3 6.1S68.7 66 65 66.1c-3.6-.1-7.3-.8-8.3-3.2\"/><path d=\"M65 65.2c0-.4 3.4-.5 5.2-1.7 0 0-3.7 1.2-4.5.7-.8-.4-1-1.6-1-1.6s-.3 1.2-.9 1.6c-.7.4-4.9-.7-4.9-.7s5.6 1.4 5.6 1.7-.1 1.3-.1 2c0 2.5 0 8.7.4 9.2.6.9.4-6.7.4-9.2-.1-.8-.1-1.6-.2-2\"/><path fill=\"#795548\" d=\"M65.2 78.6c1.7 0 4.7 1.2 7.4 3.1-2.6-2.9-5.7-4.9-7.4-4.9-1.8 0-5.6 2.2-8.3 5.4 2.8-2.2 6.4-3.6 8.3-3.6\"/><g fill=\"#3e2723\"><path d=\"M64.5 96.3c-3.8 0-7.5-1.2-10.9-2.1-.7-.2-1.4.3-2.1.1-6.3-2-11.4-5.4-14.5-9.7v1c0 21 7.4 15.1 12.3 17.6 5 2.5 10.2 1.7 15.5 1.7h.1c5.4 0 10.5.7 15.5-1.8 4.9-2.5 12.3 3.6 12.3-17.4 0-.8 0-1.6.1-2.3-2.9 4.7-8.2 8.4-14.8 10.6-.6.2-2-.3-2.6-.2-3.6 1.2-6.8 2.5-10.9 2.5\"/><path d=\"M55 85s-2.5 7.5-.8 10.8l-2.3-1s1.7-7.6 3.1-9.8m19.8 0s2.5 7.5.8 10.8l2.3-1s-1.8-7.6-3.1-9.8\"/></g><path fill=\"#ffe0b2\" d=\"M48.6 46.7c-.9 3.1-4.1 13.6 2.1 10.1 0 0-2.6 1.5-4.2 7.2s-5.8 6.4-5.8 6.4-6.7 1.3-11.7-3c-4.2-3.6-4.9-10-3.1-14.9s5-6.3 9.7-7.3c4.7-1.1 14-2 13 1.5\"/><path d=\"M64.9 76.8c2.7 0 11.1 5.8 11.2 12.9v-.4c0-7.4-6.8-13.3-11.2-13.3s-11.2 6-11.2 13.3v.4c.1-7.1 8.5-12.9 11.2-12.9\"/><g fill=\"#3e2723\"><ellipse cx=\"66.7\" cy=\"61.5\" rx=\".8\" ry=\"1.5\" transform=\"rotate(-14.465 66.71 61.469)\"/><ellipse cx=\"62.4\" cy=\"61.5\" rx=\".8\" ry=\"1.5\" transform=\"rotate(17.235 62.372 61.463)\"/></g><circle cx=\"37.2\" cy=\"58.1\" r=\"8.8\"/><circle cx=\"39.5\" cy=\"54.2\" r=\"2.3\" fill=\"#fafafa\"/><path fill=\"#795548\" d=\"M67.5 58.2c0-.1-2.3 1-2.9 1.1-.6-.1-2.9-1.2-2.9-1.1z\"/><path fill=\"#ffe0b2\" d=\"M50 57.7s-7.9 5.4-12.2 10.7-4.2 6.3-4.2 6.3l3.1 1.4s4.4-8.3 9.8-11.4 6.1-5.7 6.1-5.7z\"/><path fill=\"#ffe0b2\" d=\"M32.7 41.7S30 49.1 24 52.2c0 0 9.4-1.1 8.7-10.5m63.1 0s2.7 7.4 8.7 10.5c0 0-9.4-1.1-8.7-10.5M78.7 55.5s-5.9-6.2-13.8-6.4h.2c-8 .2-13.8 6.4-13.8 6.4 6.9-4.8 12.8-4.7 13.8-4.7-.1 0 6.7-.1 13.6 4.7m-6.9-13s-3-4.2-7-4.3h.2c-3 .1-6.9 4.3-6.9 4.3 3.4-3.3 6.9-3.2 6.9-3.2s3.3-.1 6.8 3.2M37.2 73.2s-4.7 2.3-8.1.9H29c-3-1.7-4.5-6.8-4.5-6.8s3 9 12.7 5.9m54.8 0s4.7 2.3 8.1.9c4-1.7 4.6-6.8 4.6-6.8s-3 9-12.7 5.9\"/><path fill=\"#ffe0b2\" d=\"M42.6 41.2c2.6-.5 6.9-.6 10.3.5 4.3 1.5.8 7 1.7 7.3s2.1-3.8 10.1-3.4c8.1.4 9 4 10.1 3.4s-1.1-10 11-7.8c0 0-12.7-3.4-12.1 5.8 0 0-7.3-5.6-17.5-.6.1 0 2.7-8.6-13.6-5.2m44.3 0c.2 0 .3.1.4.1s-.1-.1-.4-.1M39.1 28.9S28.3 42.5 26.7 47.7c-1.6 5.3-2.8 27-4.2 30.1l-5-21.4 9.2-22.3zm50.8 0s10.8 13.6 12.4 18.8c1.6 5.3 2.8 27 4.2 30.1l5-21.4-9.2-22.3z\"/><path fill=\"#4e342e\" d=\"M89.4 28.9s11.6 9.7 15 20.9 2 24.8 4.6 26.5c3.7 2.4 7.9-11.9 9.3-13.4 2.2-2.4 9.5-8.5 10-9.6s-14.8-17.8-21.5-21.1c-8.1-3.8-18.1-4.1-17.4-3.3\"/><path fill=\"#3e2723\" d=\"M99.3 34.9s13.7 17.5 13.5 39.3l5.5-11.2c-.1 0-4.9-14.3-19-28.1\"/><path fill=\"#4e342e\" d=\"M39.1 28.9s-11.6 9.7-15 20.9-2 24.8-4.6 26.5c-3.7 2.4-7.9-11.9-9.3-13.4C8 60.5.7 54.4.2 53.3S15 35.5 21.7 32.2c8.1-3.8 18.1-4.1 17.4-3.3\"/><path fill=\"#3e2723\" d=\"M29.2 34.9S15.5 52.4 15.7 74.2L10.3 63s4.8-14.3 18.9-28.1\"/><path fill=\"#ffe0b2\" d=\"M21.8 74.6s1 5.4 2.6 7.1.5-1.3.5-1.3-1.7-.9-1.4-7.8-1.7 2-1.7 2m85.3 0s-1 5.4-2.6 7.1-.5-1.3-.5-1.3 1.7-.9 1.4-7.8 1.7 2 1.7 2\"/><g fill=\"#3e2723\"><circle cx=\"54.5\" cy=\"70.5\" r=\".8\"/><circle cx=\"49.9\" cy=\"75.3\" r=\".8\"/><circle cx=\"48.4\" cy=\"70.5\" r=\".8\"/></g><g fill=\"#3e2723\"><circle cx=\"74\" cy=\"70.5\" r=\".8\"/><circle cx=\"78.6\" cy=\"75.3\" r=\".8\"/><circle cx=\"80.1\" cy=\"70.5\" r=\".8\"/></g></g></svg>","handlebars":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ff7043\" d=\"M12.023 12a4 4 0 0 0-3.94 3.182 1 1 0 0 1-.972.818H5.229C4.446 16 4 15.552 4 15v-1H3a1 1 0 0 0-1 1v1c0 3.866 3.134 6 7 6 3.425 0 6.275-1.675 6.881-4.745.545-2.764-1.041-5.24-3.858-5.255\"/><path fill=\"#ff7043\" d=\"M29 14h-1v1c0 .552-.446 1-1.229 1H24.89a1 1 0 0 1-.973-.818A4 4 0 0 0 19.977 12c-2.817.016-4.403 2.491-3.858 5.255C16.725 20.325 19.575 22 23 22c3.866 0 7-2.134 7-6v-1a1 1 0 0 0-1-1\"/></svg>","twig":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 50 50\"><path fill=\"#8bc34a\" d=\"M9.727 47.556c-.125-.223-.297-2.168-.183-2.087.034.025.171.267.304.537s.282.487.332.482c.123-.011.075-1.196-.1-2.454-.331-2.397-1.176-4.434-2.358-5.69-.2-.212-.344-.4-.319-.418.093-.067 1.327.842 1.842 1.358.293.293.735.825.981 1.182.328.474.465.618.51.533.078-.147-.21-9.903-.376-12.7-.074-1.256.063-1.023.61 1.034 1.064 4.007 1.858 7.922 2.342 11.55.086.637.173 1.173.195 1.19s.092.002.157-.033c.888-.484 1.524-.667 2.55-.736.727-.049.945.062.35.177-1.15.223-1.99 1.013-2.344 2.201-.315 1.061-.327 2.707-.024 3.435.152.365.037.425-1.067.56-.716.088-.977.095-1.202.037-.356-.093-1.118-.098-1.195-.009-.031.037-.243.066-.47.066-.38 0-.423-.017-.534-.215zm1.974-3.232c.152-.205.072-.412-.204-.522-.225-.091-.263-.089-.437.024-.21.137-.252.43-.08.554.18.13.607.096.72-.056zm1.248.085a.8.8 0 0 0 .214-.202c.241-.33-.352-.622-.745-.366-.406.264.08.785.531.568m2.288 3.094c-.033-.038.117-.387.334-.774.216-.388.411-.666.433-.619.07.153-.201 1.28-.33 1.373-.15.107-.354.116-.437.02m-7.036-.41c-.29-.344-.221-.434.14-.183.176.124.321.264.321.311 0 .164-.279.086-.46-.129zm8.649-.146c0-.053.102-.18.227-.282.25-.204.312-.113.143.208-.095.18-.37.235-.37.074m8.065-.827c-.243-.025-.48-.088-.527-.14-.11-.125-.114-3.044-.004-3.044.045 0 .132.15.193.331q.189.57.31.124c.094-.337.065-3.471-.039-4.296-.449-3.55-1.865-6.124-4.342-7.89-1.086-.774-2.653-1.437-4.047-1.712-.764-.15-.522-.224.598-.182 2.364.09 4.167.707 5.847 2.002a11 11 0 0 1 2.32 2.501c.453.682.64.854.64.584 0-.07.063-.882.139-1.805.679-8.26 2.396-15.1 4.984-19.86 1.86-3.422 5.108-6.817 7.885-8.244 1.397-.717 2.539-.988 4.02-.952.933.023 1.01.036 1.77.308a6.8 6.8 0 0 1 1.363.661c.612.407 1.309 1.004 1.234 1.058-.025.018-.342-.165-.704-.407-2.657-1.771-5.062-1.52-7.12.742-1.108 1.22-2.652 3.53-3.634 5.443-2.828 5.503-4.541 11.464-5.291 18.413-.163 1.509-.282 3.76-.195 3.703.032-.022.266-.52.518-1.108 1.597-3.723 3.578-6.428 5.79-7.908.672-.45 1.612-.904 1.714-.83.023.016-.17.22-.43.453-1.958 1.755-3.25 3.76-4.233 6.573-.938 2.68-1.366 5.588-1.369 9.299 0 1.742.189 4.385.367 5.102.125.505.08.546-.585.546-.55 0-2.306.138-3.417.27-.413.05-.816.04-1.608-.036-.58-.056-1.13-.119-1.219-.14-.164-.037-.18-.014-.198.302-.012.186-.1.203-.73.139m2.507-6.725c.294-.11.375-.22.375-.517 0-.63-1.309-.706-1.524-.088-.074.212.13.51.42.616.297.109.413.107.73-.011zm2.369-.052c.277-.222.318-.364.174-.611-.4-.69-1.755-.307-1.428.405.121.265.299.35.738.353.227.001.387-.044.516-.147m3.011 6.681c-.027-.05.088-.267.256-.483.879-1.135 1.22-1.545 1.285-1.545.039 0 .055.037.035.083l-.423.963c-.213.484-.445.925-.519.977-.169.122-.57.125-.634.005m2.446-.596c0-.12.853-.683.896-.59.018.04-.056.21-.166.377-.168.258-.238.304-.464.304-.164 0-.266-.035-.266-.09zm-13.04-.124c-.176-.159-.493-.656-.461-.725.018-.038.248.1.512.309s.456.405.428.438c-.076.088-.372.074-.479-.022\"/></svg>","astro":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#7c4dff\" d=\"M12.106 25.849c-1.262-1.156-1.63-3.586-1.105-5.346a5.18 5.18 0 0 0 3.484 1.66 9.68 9.68 0 0 0 5.882-.734c.215-.106.413-.247.648-.39a3.5 3.5 0 0 1 .16 1.555 4.26 4.26 0 0 1-1.798 3.021c-.404.3-.832.569-1.25.852a2.613 2.613 0 0 0-1.15 3.372l.048.161a3.4 3.4 0 0 1-1.5-1.285 3.6 3.6 0 0 1-.578-1.962 9 9 0 0 0-.05-1.037c-.114-.831-.504-1.204-1.238-1.225a1.45 1.45 0 0 0-1.507 1.18c-.012.056-.028.112-.046.178M4.901 20a17.75 17.75 0 0 1 7.4-2l2.913-8.38a.765.765 0 0 1 1.527 0L19.7 18a14.24 14.24 0 0 1 7.399 2S20.704 2.877 20.692 2.842C20.51 2.33 20.202 2 19.787 2h-7.619c-.415 0-.71.33-.904.842z\"/></svg>","mdx":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ffca28\" d=\"m14 10-4 3.5L6 10H4v12h4v-6l2 2 2-2v6h4V10zm12 6v-6h-4v6h-4l6 8 6-8z\"/></svg>","nodejs":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#8bc34a\" d=\"M16 20.003v2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2v-2h4v-2h-4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v2Z\"/><path fill=\"#8bc34a\" d=\"m16 3.003-12 7v14l4 2h6v-13.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v11.5H8l-2-1.034V11.15l10-5.833 10 5.833v11.703l-10 5.833-1.745-1.022L13 29.253l3 1.75 12-7v-14Z\"/></svg>","tsconfig":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#757575\" d=\"M15 2H6a2.006 2.006 0 0 0-2 2v22a2.006 2.006 0 0 0 2 2h6v-4H6v-2h6v-2H6v-2h6v-2H6v-2h6v-2h2V4l8 8h2v-1Z\" data-mit-no-recolor=\"true\"/><path fill=\"#0288d1\" d=\"M12 12v18h18V12Zm8 6h-2v8h-2v-8h-2v-2h6Zm8 0h-4v2h2a2.006 2.006 0 0 1 2 2v2a2.006 2.006 0 0 1-2 2h-4v-2h4v-2h-2a2.006 2.006 0 0 1-2-2v-2a2.006 2.006 0 0 1 2-2h4Z\"/></svg>","git":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#e64a19\" d=\"M13.172 2.828 11.78 4.22l1.91 1.91 2 2A2.986 2.986 0 0 1 20 10.81a3.25 3.25 0 0 1-.31 1.31l2.06 2a2.68 2.68 0 0 1 3.37.57 2.86 2.86 0 0 1 .88 2.117 3.02 3.02 0 0 1-.856 2.109A2.9 2.9 0 0 1 23 19.81a2.93 2.93 0 0 1-2.13-.87 2.694 2.694 0 0 1-.56-3.38l-2-2.06a3 3 0 0 1-.31.12V20a3 3 0 0 1 1.44 1.09 2.92 2.92 0 0 1 .56 1.72 2.88 2.88 0 0 1-.878 2.128 2.98 2.98 0 0 1-2.048.871 2.981 2.981 0 0 1-2.514-4.719A3 3 0 0 1 16 20v-6.38a2.96 2.96 0 0 1-1.44-1.09 2.9 2.9 0 0 1-.56-1.72 2.9 2.9 0 0 1 .31-1.31l-3.9-3.9-7.579 7.572a4 4 0 0 0-.001 5.658l10.342 10.342a4 4 0 0 0 5.656 0l10.344-10.344a4 4 0 0 0 0-5.656L18.828 2.828a4 4 0 0 0-5.656 0\"/></svg>","readme":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 16 16\"><path d=\"M0 0h24v24H0z\"/><path fill=\"#42a5f5\" d=\"M8 1C4.136 1 1 4.136 1 8s3.136 7 7 7 7-3.136 7-7-3.136-7-7-7m1 11H7V7.5h2zm0-6H7V4h2z\"/></svg>","license":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><path fill=\"#ff5722\" d=\"M8 1a5.5 5.5 0 0 0-4 9.26V15l4-1.5 4 1.5v-4.74A5.49 5.49 0 0 0 8 1m0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4\"/></svg>","prettier":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><path fill=\"#f44336\" d=\"M2 8h4v1H2zm0 6h4v1H2zm9-10h3v1h-3zM2 2h3v1H2z\"/><path fill=\"#f9a825\" d=\"M9 2h3v1H9zm1 4h4v1h-4zm-5 6h1v1H5zm-3-2h6v1H2z\"/><path fill=\"#26a69a\" d=\"M2 12h3v1H2zm7-4h5v1H9zM2 4h4v1H2zm3-2h4v1H5z\"/><path fill=\"#ba68c8\" d=\"M2 6h3v1H2zm7-2h2v1H9zm-1 6h4v1H8z\"/></svg>","eslint":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#3f51b5\" d=\"M22.713 4H9.287a.5.5 0 0 0-.432.248l-6.708 11.5a.5.5 0 0 0 0 .504l6.708 11.5a.5.5 0 0 0 .432.248h13.426a.5.5 0 0 0 .432-.248l6.708-11.5a.5.5 0 0 0 0-.504l-6.708-11.5A.5.5 0 0 0 22.713 4m-6.937 20.888-7.5-3.75A.5.5 0 0 1 8 20.691v-9.382a.5.5 0 0 1 .276-.447l7.5-3.75a.5.5 0 0 1 .448 0l7.5 3.75a.5.5 0 0 1 .276.447v9.382a.5.5 0 0 1-.276.447l-7.5 3.75a.5.5 0 0 1-.448 0\"/><path fill=\"#7986cb\" d=\"M22 19.441v-6.882a.5.5 0 0 0-.276-.447l-5.5-2.75a.5.5 0 0 0-.448 0l-5.5 2.75a.5.5 0 0 0-.276.447v6.882a.5.5 0 0 0 .276.447l5.5 2.75a.5.5 0 0 0 .448 0l5.5-2.75a.5.5 0 0 0 .276-.447\"/></svg>","vite":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#a0f\" d=\"M29.313 12h-6.664a1.427 1.427 0 0 1-1.1-2.24l4.398-6.676A.703.703 0 0 0 25.397 2H8.428a.62.62 0 0 0-.55.289l-5.77 8.627A.703.703 0 0 0 2.658 12h8.175a1.427 1.427 0 0 1 1.099 2.24l-4.48 6.676A.702.702 0 0 0 8 22l6.695.002A1.34 1.34 0 0 1 16 23.375v5.934a.652.652 0 0 0 1.168.433l12.694-16.586a.725.725 0 0 0-.55-1.156\"/></svg>","webpack":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#fafafa\" fill-opacity=\".785\" d=\"m19.376 15.988-7.708 4.45-7.709-4.45v-8.9l7.709-4.451 7.708 4.45z\"/><path fill=\"#90caf9\" d=\"M12.286 1.98c-.21 0-.41.059-.57.179l-7.9 4.44c-.32.17-.53.5-.53.88v9c0 .38.21.711.53.881l7.9 4.44c.16.12.36.18.57.18s.41-.06.57-.18l7.9-4.44c.32-.17.53-.5.53-.88v-9c0-.38-.21-.712-.53-.882l-7.9-4.44a.95.95 0 0 0-.57-.179zm0 2.15 7 3.94v2.103h-.016v5.177h.016v.54l-7 3.939-7-3.94V8.07zm0 2.08-4.9 2.83 4.9 2.83 4.9-2.83zm-5 5.08v3.58l4 2.309v-3.58l-4-2.31zm10 0-4 2.308v3.58l4-2.308z\"/><path fill=\"#0277bd\" d=\"m12.286 6.21-4.9 2.83 4.9 2.83 4.9-2.83zm-5 5.08v3.58l4 2.309v-3.58l-4-2.31zm10 0-4 2.308v3.58l4-2.308z\"/></svg>","favicon":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ffd54f\" d=\"m16 24 10 6-4-10 8-8-10-.032L16 2l-4 10H2l8 8-4 10Z\"/></svg>","yarn":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#0288d1\" d=\"M27.575 23.967a9.9 9.9 0 0 0-3.751 1.726 22.6 22.6 0 0 1-5.537 2.504 1.55 1.55 0 0 1-.931.52 59 59 0 0 1-6.11.548c-1.102.008-1.777-.282-1.965-.735a1.49 1.49 0 0 1 .82-1.965 3.6 3.6 0 0 1-.486-.359c-.163-.162-.334-.487-.385-.367-.213.52-.324 1.794-.897 2.366-.786.795-2.273.53-3.153.069-.965-.513.069-1.718.069-1.718a.69.69 0 0 1-.94-.324 4.6 4.6 0 0 1-.632-2.794 5.2 5.2 0 0 1 1.674-2.76 8.84 8.84 0 0 1 .624-4.17 9.9 9.9 0 0 1 3-3.469S7.136 11.015 7.82 9.177c.444-1.196.623-1.187.769-1.239a3.44 3.44 0 0 0 1.375-.811 4.99 4.99 0 0 1 4.178-1.607s1.094-3.357 2.12-2.7a17.4 17.4 0 0 1 1.452 2.735s1.213-.71 1.35-.445a10.74 10.74 0 0 1 .495 5.81 13.3 13.3 0 0 1-2.46 5.127c-.129.214 1.47.889 2.477 3.683.932 2.554.103 4.699.248 4.938.026.043.034.06.034.06s1.068.085 3.213-1.24a8.05 8.05 0 0 1 4.05-1.52 1.026 1.026 0 0 1 .453 2Z\"/></svg>","editorconfig":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" clip-rule=\"evenodd\" image-rendering=\"optimizeQuality\" shape-rendering=\"geometricPrecision\" text-rendering=\"geometricPrecision\" viewBox=\"0 0 3473 3473\"><path fill=\"#ede7f6\" d=\"M989.342 1977.409c41.146-26.835 75.137-93.922 54.564-141.33-56.353 24.151-53.67 79.61-54.564 141.33m636.877 153.851c44.724-14.311 87.66-64.402 63.509-116.283-34.886 24.151-57.248 57.247-63.51 116.284z\"/><g fill=\"#fafafa\"><path d=\"M374.827 2871.899c0 56.352 14.312 117.178 53.67 138.645 144.907 81.4 652.977 17.89 825.614-20.573 90.343-20.573 163.692-87.66 248.668-124.334 191.421-83.187 330.067-150.274 483.025-262.085 110.916-81.399 287.131-310.388 305.915-447.245l-151.169-33.991c-3.578 153.852-38.463 188.737-175.32 224.517-92.132 25.046-271.925 30.413-365.846 14.312-124.334-20.574-180.687-85.871-237.04-160.114-109.128-144.907 24.151-245.985-148.485-255.824-181.582 222.728-501.81 62.614-642.244 40.252-59.93 86.765-200.366 650.294-198.577 779.1 86.766-29.517 141.33 2.684 219.15 33.097 275.503 106.444 34.885 200.366-75.137 172.636-75.137-17.89-98.394-67.086-142.224-98.393m360.48-1285.383c111.81 21.468 211.1 67.982 305.915 115.39 154.747 76.926 182.476 66.192 196.788 173.53 1.789 19.68-1.789 30.413 54.564 48.303 94.816 29.518-54.564-23.257 199.471-22.362 151.169.894 497.337 61.72 609.148 132.384 46.513 29.519 37.568 67.087 194.999 62.615-1.79-185.16-50.986-461.557-123.44-631.51-88.554-205.733-205.733-237.04-444.561-313.966-139.54-44.725-549.217-93.922-676.235-15.207-118.967 74.243-141.33 162.798-252.246 318.439-32.202 45.619-43.83 80.504-64.403 132.384\"/><path d=\"M1720.14 1966.675c89.45 36.674-4.472 273.714-128.806 216.466-40.252-113.6 55.458-178.003 81.398-228.99-53.67-8.05-206.627-32.2-252.246-15.206-59.036 22.363-72.454 148.486-42.041 207.522 143.118 280.87 775.523 220.94 708.436 2.684-26.835-88.555-51.88-102.867-142.224-133.28-72.454-24.15-144.907-49.196-224.517-49.196m-1124.374-31.307c71.56 68.875 233.462 79.61 338.117 84.976 13.418-138.646 25.046-242.407 135.963-234.356 54.564 74.242 25.94 161.902-31.307 218.255 97.5-.894 153.852-74.242 139.54-180.687-82.293-59.036-331.856-177.109-457.084-194.104-34.885 37.569-120.756 243.301-125.229 305.916\"/></g><path d=\"M427.602 2820.913c59.036-5.367 212.889 39.357 225.412 89.449-95.71 11.628-217.361 2.683-225.412-89.45zm-52.775 50.986c43.83 31.307 67.087 80.504 142.224 98.393 110.022 27.73 350.64-66.192 75.137-172.636-77.82-30.413-132.384-62.614-219.15-33.096-1.789-128.807 138.646-692.336 198.577-779.101 140.435 22.362 460.662 182.476 642.244-40.252 172.636 9.84 39.357 110.917 148.485 255.824 56.353 74.243 112.706 139.54 237.04 160.114 93.921 16.1 273.714 10.734 365.846-14.312 136.857-35.78 171.742-70.665 175.32-224.517l151.17 33.99c-18.785 136.858-195 365.847-305.916 447.246-152.958 111.81-291.604 178.898-483.025 262.085-84.976 36.674-158.325 103.761-248.668 124.334-172.637 38.463-680.707 101.972-825.614 20.574-39.358-21.468-53.67-82.294-53.67-138.646M1626.22 2131.26c6.261-59.037 28.623-92.133 63.508-116.284 24.152 51.88-18.784 101.972-63.508 116.284m93.921-164.586c79.61 0 152.063 25.045 224.517 49.197 90.344 30.412 115.39 44.724 142.224 133.279 67.087 218.255-565.318 278.186-708.436-2.684-30.413-59.036-16.995-185.16 42.041-207.522 45.619-16.995 198.577 7.156 252.246 15.207-25.94 50.986-121.65 115.389-81.398 228.99 124.334 57.247 218.255-179.793 128.806-216.467m-730.798 10.734c.894-61.72-1.79-117.179 54.564-141.33 20.573 47.408-13.418 114.495-54.564 141.33m-393.576-42.041c4.473-62.615 90.344-268.347 125.229-305.916 125.228 16.995 374.791 135.068 457.084 194.104 14.312 106.445-42.04 179.793-139.54 180.687 57.247-56.353 85.87-144.013 31.307-218.255-110.917-8.05-122.545 95.71-135.963 234.356-104.655-5.367-266.558-16.1-338.117-84.976m-89.449-71.56c-33.096-91.238-33.096-233.462 107.339-245.09l-71.56 199.471c-18.783 42.936-18.783 33.096-35.779 45.62zm228.99-277.292c20.573-51.88 32.201-86.765 64.403-132.384 110.917-155.641 133.279-244.196 252.246-318.439 127.018-78.715 536.694-29.518 676.235 15.207 238.828 76.926 356.007 108.233 444.561 313.966 72.454 169.953 121.65 446.35 123.44 631.51-157.43 4.472-148.486-33.096-195-62.615-111.81-70.664-457.978-131.49-609.147-132.384-254.035-.895-104.655 51.88-199.471 22.362-56.353-17.89-52.775-28.624-54.564-48.302-14.312-107.34-42.041-96.605-196.788-173.531-94.816-47.408-194.104-93.922-305.915-115.39m1583.247-43.83c-16.995-56.352 14.312-52.775 68.876-91.238 31.307-22.362 56.353-45.619 94.816-67.086 144.013-80.504 412.36-93.922 526.854 1.789 46.514 38.463 122.545 113.6 110.917 211.994-24.151 195.893-158.325 303.232-268.347 392.68-111.811 91.239-297.865 185.16-490.18 122.546-16.101-39.358-3.578-288.92-22.363-381.053-16.995-82.293-8.05-91.238 39.358-140.435 139.54-144.907 441.878-250.457 613.62-126.123 72.454 53.67 51.88 74.243 89.449 115.39 46.513-50.092-40.252-218.256-360.48-207.522-217.36 7.156-311.282 177.109-402.52 169.058m-1302.377-508.964c4.472-124.335 118.967-381.948 233.461-471.397 138.646-107.338 283.554-208.416 496.442-87.66 52.775 29.519 50.092 44.725 55.459 118.073 4.472 70.665-1.79 96.605-19.679 153.852-141.33 456.19-259.402 194.105-712.014 302.338 16.995-148.485 145.802-280.87 217.361-349.746 122.545-118.967 211.1-195.893 395.365-170.847 50.986 84.976 56.352 138.646-5.367 237.934-82.293 132.385-102.867 124.334-90.344 214.678 64.403-16.101 84.082-78.715 113.6-141.33 179.793-375.686-81.398-421.305-241.512-352.429-107.339 45.62-298.76 256.719-361.374 383.736-12.523 25.046-25.94 57.248-37.568 84.977zm708.436 18.784c18.784-111.811 129.7-139.54 129.7-483.92 0-148.485-182.475-281.764-421.304-182.475-204.838 84.082-236.145 148.485-345.273 313.071-102.867 155.642-99.289 326.49-187.843 470.502-25.94 41.147-49.197 55.458-77.82 96.605-20.574 30.413-35.78 68.876-56.354 104.655-42.04 68.876-84.976 118.968-118.967 201.26-107.339 2.684-197.682 4.473-208.416 115.39-14.312 152.063 57.247 189.632 57.247 246.879-.894 61.72-251.351 684.285-181.581 1055.498 19.679 101.972 86.765 102.867 194.104 115.39 258.508 31.307 593.942 20.573 825.614-72.454l420.41-201.26c106.445-59.931 285.343-173.532 364.953-256.72 56.353-58.141 85.87-107.338 134.173-176.214 66.192-96.605 67.981-94.816 82.293-226.306 87.66 16.101 251.352 54.564 305.916 101.972-6.262 61.72-36.674 32.202-36.674 87.66 34.885.895 93.027-42.935 107.339-91.238-36.675-53.67-75.138-44.724-127.913-87.66 42.042-33.096 118.073-48.302 176.215-72.453 125.229-51.88 339.012-209.311 391.787-352.43 42.04-115.389 10.734-307.704-57.248-382.841-71.559-78.715-237.934-118.967-373.897-118.967-161.902 0-329.172 116.283-459.767 166.375-50.092-43.83-53.67-93.922-90.344-142.224-42.04-57.248-315.755-200.366-446.35-228.095\"/><path fill=\"#efebe9\" d=\"M2318.554 1542.686c91.238 8.05 185.16-161.902 402.52-169.058 320.228-10.734 406.993 157.43 360.48 207.521-37.569-41.146-16.995-61.72-89.45-115.389-171.741-124.334-474.079-18.784-613.62 126.123-47.407 49.197-56.352 58.142-39.357 140.435 18.785 92.133 6.262 341.695 22.362 381.053 192.316 62.614 378.37-31.307 490.181-122.545 110.022-89.45 244.196-196.788 268.347-392.681 11.628-98.394-64.403-173.531-110.917-211.994-114.494-95.71-382.841-82.293-526.854-1.79-38.463 21.468-63.51 44.725-94.816 67.087-54.564 38.464-85.871 34.886-68.876 91.238m-1302.377-508.964 43.83-77.821c11.628-27.73 25.045-59.93 37.568-84.977 62.614-127.017 254.035-338.117 361.374-383.736 160.114-68.876 421.305-23.257 241.512 352.43-29.518 62.614-49.197 125.228-113.6 141.329-12.523-90.344 8.05-82.293 90.344-214.678 61.72-99.288 56.353-152.958 5.367-237.934-184.265-25.046-272.82 51.88-395.365 170.847-71.56 68.876-200.366 201.26-217.361 349.746 452.612-108.233 570.685 153.852 712.014-302.338 17.89-57.247 24.151-83.187 19.679-153.852-5.367-73.348-2.684-88.554-55.459-118.073-212.888-120.756-357.796-19.678-496.442 87.66-114.494 89.45-228.989 347.062-233.461 471.397\"/><path fill=\"#eee\" d=\"M506.317 1863.808c16.996-12.523 16.996-2.683 35.78-45.619l71.559-199.47c-140.435 11.627-140.435 153.851-107.339 245.09z\"/><path fill=\"#efebe9\" d=\"M653.014 2910.362c-12.523-50.092-166.376-94.816-225.412-89.45 8.05 92.133 129.701 101.078 225.412 89.45\"/></svg>","babel":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#fdd835\" d=\"M18.23 11.21q-.045-.24-1.32-1.65c-.02-.19.29-.45.9-.8l1.74-1.55c.39-.5.62-1.28.69-2.38l-.02-.26c-.07-.78-.63-1.4-1.69-1.89-.63-.42-1.76-.65-3.38-.68-1.35.11-3.11.59-5.28 1.43-.6.43-1.28.86-2.04 1.28l.01.14.21-.08c.08-.01.13.03.14.11l.13-.07.07-.01.01.06c0 .07-.47.44-1.76 1.35l-.06.12c-.31.02-.61.25-.91.67l.08.12.25-.09.18.24c.32-.33.66-.62 1.03-.87.19.05.29.11.44.16 1.02-.75 2.03-1.3 3.04-1.64l.01.14c-.2.27-.32.42-.38.42l.1.23c.01.19-2.55 7-6.66 14.44l.08.19c.35-.08.58-.17.75-.26l.01.13.4-.03-.67 1.76.14.06c.57-.64 1-1.29 1.3-1.88 1.67-.49 2.94-.97 3.82-1.44.88-.08 1.56-.31 2.02-.7l.92-.47c1.27-.98 2.22-1.67 2.87-2.08 1.33-.98 2.2-1.93 2.6-2.85zm-3.46 2.31L13 14.91c-1.29.85-2 1.3-2.09 1.3-2.07 1.13-3.36 1.72-3.86 1.76l-.05.01c.04-.23.96-2.12 2.75-5.67.78-.06 2.02-.43 3.71-1.1l.41-.03c.85-.08 1.49.09 1.91.49l.03.26c-.31.9-.67 1.44-1.04 1.59m1.09-5.78q-.27.33-1.5 1.11c-.27.03-1.27.42-3.01 1.18l-.28-.05-.01-.12c-.02-.25.09-.57.34-.95.13-.7.28-1.12.44-1.2l1.45-3.28c-.02-.22.29-.35.93-.46l.21-.02.01.18 1.16-.16c1.15-.1 1.75.14 1.8.7l.13-.02-.03-.32.15-.02c.35.19.52.4.54.68.02.18-.08.41-.29.68-.09.01-.14-.06-.15-.18l-.14.01-.03.4c-.58.87-1.01 1.31-1.27 1.34z\"/></svg>","makefile":"<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path fill=\"#ef5350\" d=\"m29.5 24.02-1.6-.92a4.4 4.4 0 0 0 .09-.9A1.3 1.3 0 0 0 28 22a5.6 5.6 0 0 0-.1-1.1l1.6-.92a.493.493 0 0 0 .18-.68l-1.5-2.6a.45.45 0 0 0-.18-.18V6.01a2.006 2.006 0 0 0-2-2H4a2.006 2.006 0 0 0-2 2V22a2.006 2.006 0 0 0 2 2h10.53l-.03.02a.493.493 0 0 0-.18.68l1.5 2.6a.493.493 0 0 0 .68.18l1.6-.92a5.9 5.9 0 0 0 1.9 1.09v1.85a.495.495 0 0 0 .5.5h3a.495.495 0 0 0 .5-.5v-1.85a5.9 5.9 0 0 0 1.9-1.09l1.6.92a.493.493 0 0 0 .68-.18l1.5-2.6a.493.493 0 0 0-.18-.68M24 22.01a1.99 1.99 0 0 1-.88 1.65l-.18.11a2.04 2.04 0 0 1-1.88 0l-.18-.11a1.99 1.99 0 0 1-.88-1.65V22a2 2 0 0 1 .88-1.66l.18-.11a2.04 2.04 0 0 1 1.88 0l.18.11A2 2 0 0 1 24 22Zm2-4.63-.1.06a5.9 5.9 0 0 0-1.9-1.09V14.5a.495.495 0 0 0-.5-.5h-3a.495.495 0 0 0-.5.5v1.85a5.9 5.9 0 0 0-1.9 1.09l-1.6-.92a.493.493 0 0 0-.68.18l-1.5 2.6a.493.493 0 0 0 .18.68l1.6.92A5.6 5.6 0 0 0 16 22v.01L4 22V10.01h22Z\"/></svg>","file":"<svg aria-hidden=\"true\" viewBox=\"0 0 16 16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m8.668 6h3.6641l-3.6641-3.668v3.668m-4.668-4.668h5.332l4 4v8c0 0.73828-0.59375 1.3359-1.332 1.3359h-8c-0.73828 0-1.332-0.59766-1.332-1.3359v-10.664c0-0.74219 0.59375-1.3359 1.332-1.3359m3.332 1.3359h-3.332v10.664h8v-6h-4.668z\" fill=\"#90a4ae\" /></svg>"};
      var ICONE_VSCODE_EXTENSAO = {"html":"html","htm":"html","css":"css","scss":"sass","sass":"sass","less":"less","js":"javascript","mjs":"javascript","cjs":"javascript","ts":"typescript","jsx":"react","tsx":"react_ts","json":"json","xml":"xml","md":"markdown","markdown":"markdown","svg":"svg","txt":"document","py":"python","java":"java","c":"c","cpp":"cpp","h":"h","hpp":"hpp","cs":"csharp","php":"php","rb":"ruby","go":"go","rs":"rust","swift":"swift","kt":"kotlin","sql":"database","sh":"console","bash":"console","yml":"yaml","yaml":"yaml","toml":"toml","ini":"settings","env":"tune","csv":"table","vue":"vue","svelte":"svelte","lua":"lua","dart":"dart","r":"r","pl":"prolog","gradle":"gradle","vb":"visualstudio","bat":"console","ps1":"powershell","png":"image","jpg":"image","jpeg":"image","gif":"image","webp":"image","ico":"image","pdf":"pdf","zip":"zip","lock":"lock","log":"log","dockerfile":"docker","http":"http","graphql":"graphql","prisma":"prisma","tex":"tex","ejs":"ejs","pug":"pug","hbs":"handlebars","twig":"twig","astro":"astro","mdx":"mdx","jsonc":"json","cfg":"settings","conf":"settings"};
      var ICONE_VSCODE_NOME = {"package.json":"nodejs","package-lock.json":"nodejs","tsconfig.json":"tsconfig",".gitignore":"git",".gitattributes":"git","readme.md":"readme","license":"license","dockerfile":"docker","docker-compose.yml":"docker",".prettierrc":"prettier",".eslintrc.json":"eslint",".eslintrc.js":"eslint","vite.config.js":"vite","vite.config.ts":"vite","webpack.config.js":"webpack","favicon.ico":"favicon","yarn.lock":"yarn",".editorconfig":"editorconfig",".babelrc":"babel","makefile":"makefile"};
      var ICONE_VSCODE_PADRAO = "file";
      function iconeDeArquivo(nome, linguagem) {
        var base = String(nome || '').split('/').pop().toLowerCase();
        var extensao = (base.match(/\.([a-z0-9]+)$/) || [])[1];
        var id = ICONE_VSCODE_NOME[base] || (extensao && ICONE_VSCODE_EXTENSAO[extensao]) || null;
        return ICONES_VSCODE[id || ICONE_VSCODE_PADRAO] || ICONES_DE_LINGUAGEM.plaintext;
      }

      // ==================================================================
      // PROJETO DO ALUNO — independente do curso. Guarda só os arquivos e
      // pastas que o aluno cria/importa pelo Explorer. Vive em IndexedDB
      // próprio (não usa o localStorage, que é pequeno e é onde ficam o
      // progresso e os exercícios das etapas). Arquivos do projeto só
      // viram aba quando o aluno os abre.
      // ==================================================================
      var projeto = { nome: 'Meu projeto', arquivos: {}, pastas: {} };
      var projetoTimeout = null;
      var projetoUltimaVersaoEm = 0;
      var INTERVALO_ENTRE_VERSOES_LOCAIS_MS = 10 * 60 * 1000;
      var BANCO_DO_PROJETO = 'coding-loop-projeto';

      // Tudo é por usuário: duas contas no mesmo navegador não veem o projeto
      // uma da outra, e "excluir conta" limpa essas chaves (api.js).
      function uidDoProjeto() {
        try { return (CL.api && typeof CL.api._uid === 'function' && CL.api._uid()) || 'usuario'; } catch (erro) { return 'usuario'; }
      }
      function chaveDoProjeto() { return 'atual:' + uidDoProjeto(); }
      function chaveDasVersoesDoProjeto() { return 'versoes:' + uidDoProjeto(); }

      function abrirBancoDoProjeto() {
        return new Promise(function (resolve, reject) {
          if (!window.indexedDB) { reject(new Error('Sem IndexedDB')); return; }
          var pedido = window.indexedDB.open(BANCO_DO_PROJETO, 1);
          pedido.onupgradeneeded = function () { pedido.result.createObjectStore('projeto'); };
          pedido.onsuccess = function () { resolve(pedido.result); };
          pedido.onerror = function () { reject(pedido.error); };
        });
      }
      function projetoLerChave(chave) {
        return abrirBancoDoProjeto().then(function (db) {
          return new Promise(function (resolve) {
            var pedido = db.transaction('projeto', 'readonly').objectStore('projeto').get(chave);
            pedido.onsuccess = function () { db.close(); resolve(pedido.result === undefined ? null : pedido.result); };
            pedido.onerror = function () { db.close(); resolve(null); };
          });
        }).catch(function () { return null; });
      }
      function projetoGravarChave(chave, valor) {
        return abrirBancoDoProjeto().then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx = db.transaction('projeto', 'readwrite');
            tx.objectStore('projeto').put(valor, chave);
            tx.oncomplete = function () { db.close(); resolve(true); };
            tx.onerror = function () { db.close(); reject(tx.error); };
          });
        });
      }

      // Conteúdo "de verdade" (aba aberta ou modelo) no formato do backup.
      function projetoDados() {
        var arquivos = {};
        Object.keys(projeto.arquivos).forEach(function (caminho) {
          arquivos[caminho] = { linguagem: projeto.arquivos[caminho].linguagem, conteudo: conteudoAtualDoArquivoDoProjeto(caminho) };
        });
        return {
          format: 'coding-loop-project', version: 1, exportedAt: new Date().toISOString(),
          nome: projeto.nome, pastas: Object.keys(projeto.pastas), arquivos: arquivos
        };
      }
      window.obterDadosDoProjeto = projetoDados;

      function projetoTemArquivos() { return Object.keys(projeto.arquivos).length > 0; }

      // Versões locais (para "Restaurar"): ficam no IndexedDB, não no
      // localStorage — um projeto de verdade estouraria a cota de ~5 MB.
      function projetoGuardarVersaoLocal(forcar) {
        if (!projetoTemArquivos()) return Promise.resolve(false);
        if (!forcar && Date.now() - projetoUltimaVersaoEm < INTERVALO_ENTRE_VERSOES_LOCAIS_MS) return Promise.resolve(false);
        projetoUltimaVersaoEm = Date.now();
        var retencao = 1;
        try { retencao = Math.max(1, Number(CL.api.getBackupSettings().retentionCount) || 1); } catch (erro) { /* usa 1 */ }
        return projetoLerChave(chaveDasVersoesDoProjeto()).then(function (versoes) {
          versoes = Array.isArray(versoes) ? versoes : [];
          versoes.unshift(projetoDados());
          versoes.splice(retencao);
          return projetoGravarChave(chaveDasVersoesDoProjeto(), versoes);
        }).then(function () {
          try { CL.api.saveBackupSettings({ lastProjectLocalBackupAt: new Date().toISOString() }); } catch (erro) { /* sem settings */ }
          return true;
        }).catch(function () { return false; });
      }
      window.versoesLocaisDoProjeto = function () {
        return projetoLerChave(chaveDasVersoesDoProjeto()).then(function (v) { return Array.isArray(v) ? v : []; });
      };

      function projetoPersistir() {
        clearTimeout(projetoTimeout);
        projetoTimeout = null;
        return projetoGravarChave(chaveDoProjeto(), { nome: projeto.nome, arquivos: projeto.arquivos, pastas: projeto.pastas, atualizadoEm: new Date().toISOString() })
          .then(function () {
            if (typeof espelharProjetoInteiroNoDisco === 'function') espelharProjetoInteiroNoDisco();
            projetoGuardarVersaoLocal(false);
            if (typeof window.agendarSincronizacaoDoProjeto === 'function') window.agendarSincronizacaoDoProjeto();
            return true;
          }).catch(function () { return false; });
      }
      function projetoAgendarPersistencia() {
        clearTimeout(projetoTimeout);
        projetoTimeout = setTimeout(projetoPersistir, 500);
      }

      function projetoCarregar() {
        return projetoLerChave(chaveDoProjeto()).then(function (dados) {
          if (dados) return dados;
          // Migração da etapa 1: o projeto era salvo numa chave única ("atual").
          return projetoLerChave('atual').then(function (legado) {
            if (!legado) return null;
            return projetoGravarChave(chaveDoProjeto(), legado).then(function () {
              return abrirBancoDoProjeto().then(function (db) {
                db.transaction('projeto', 'readwrite').objectStore('projeto').delete('atual');
                db.close();
                return legado;
              });
            }).catch(function () { return legado; });
          });
        }).then(function (dados) {
          if (dados && dados.arquivos) {
            projeto.nome = dados.nome || projeto.nome;
            projeto.arquivos = dados.arquivos;
            projeto.pastas = dados.pastas || {};
          }
          return projeto;
        }).catch(function () { return projeto; });
      }

      // Substitui o projeto inteiro (restaurar backup / abrir pasta).
      function projetoAplicar(dados) {
        Object.keys(projeto.arquivos).forEach(function (caminho) { fecharAbaDoProjeto(caminho); });
        var arquivos = {};
        Object.keys(dados.arquivos).forEach(function (caminho) {
          arquivos[caminho] = { linguagem: dados.arquivos[caminho].linguagem || linguagemDoArquivo(caminho) || 'plaintext', conteudo: dados.arquivos[caminho].conteudo || '' };
        });
        projeto.nome = dados.nome || 'Meu projeto';
        projeto.arquivos = arquivos;
        projeto.pastas = {};
        (dados.pastas || []).forEach(function (pasta) { projeto.pastas[pasta] = true; });
        Object.keys(arquivos).forEach(garantirPastasPai);
        pastasAbertasNoExplorer = {};
        itemSelecionadoNoExplorer = null;
        pastaSelecionadaNoExplorer = '';
        atualizarNomeDoProjetoNoExplorer();
        renderizarExplorer();
        agendarAtualizacaoPreview();
        return projetoPersistir().then(function () { return Object.keys(arquivos).length; });
      }
      window.aplicarDadosDoProjeto = projetoAplicar;

      window.addEventListener('pagehide', function () {
        if (projetoTimeout) projetoPersistir();
        projetoGuardarVersaoLocal(false);
      });

      var carregandoCodigoDaEtapa = true;
      var codigoInicial = (window.getCodigoInicialParaEditor && window.getCodigoInicialParaEditor()) || {};

      // ----------------------------------------------------------------
      // Preferências persistentes do editor (item 13 da avaliação técnica
      // do Monaco). Chave local por dispositivo, no mesmo espírito de
      // `cl.ide.debug` — não é dado de conta/usuário, então não entra em
      // `deleteAllUserData` (api.js).
      // ----------------------------------------------------------------
      var CHAVE_PREFS_EDITOR = 'cl.ide.editor-prefs';
      function carregarPreferenciasDoEditor() {
        var padrao = { fontSize: 14, wordWrap: 'on', tabSize: 2, minimap: false, renderWhitespace: 'selection' };
        try {
          var salvas = JSON.parse(window.localStorage.getItem(CHAVE_PREFS_EDITOR) || '{}');
          return Object.assign(padrao, salvas && typeof salvas === 'object' ? salvas : {});
        } catch (e) {
          return padrao;
        }
      }
      function salvarPreferenciasDoEditor() {
        try { window.localStorage.setItem(CHAVE_PREFS_EDITOR, JSON.stringify(preferenciasDoEditor)); } catch (e) { /* localStorage indisponível: preferência só dura a sessão */ }
      }
      function todosOsArquivosEditaveis() {
        return arquivosExtras.slice();
      }
      function aplicarPreferenciasATodosOsEditores() {
        todosOsArquivosEditaveis().forEach(function (arquivo) {
          var editorNativo = arquivo.editor.getMonacoEditor && arquivo.editor.getMonacoEditor();
          var model = arquivo.editor.getModel && arquivo.editor.getModel();
          if (editorNativo) {
            editorNativo.updateOptions({
              fontSize: preferenciasDoEditor.fontSize,
              wordWrap: preferenciasDoEditor.wordWrap,
              renderWhitespace: preferenciasDoEditor.renderWhitespace,
              minimap: { enabled: preferenciasDoEditor.minimap }
            });
          }
          if (model) model.updateOptions({ tabSize: preferenciasDoEditor.tabSize, insertSpaces: true });
        });
      }
      var preferenciasDoEditor = carregarPreferenciasDoEditor();

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

      // ----------------------------------------------------------------
      // Biblioteca de snippets (item 11). Antes embutida dentro de
      // sugestoesDoProjeto com só 4 itens no total; extraída para cá para
      // facilitar manutenção/crescimento, mantendo o mesmo formato usado
      // pelo restante do arquivo ({ label, insertText, insertTextRules }).
      // ----------------------------------------------------------------
      function obterSnippetsPorLinguagem() {
        var regraSnippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
        return {
          html: [
            { label: 'Estrutura HTML5', insertText: '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${1:Minha página}</title>\n</head>\n<body>\n  ${0}\n</body>\n</html>', insertTextRules: regraSnippet },
            { label: 'Imagem acessível', insertText: '<img src="${1:imagem.jpg}" alt="${2:Descrição da imagem}">', insertTextRules: regraSnippet },
            { label: 'Formulário acessível', insertText: '<form>\n  <label for="${1:campo}">${2:Rótulo do campo}</label>\n  <input id="${1:campo}" name="${1:campo}" type="${3:text}" required>\n  <button type="submit">${4:Enviar}</button>\n</form>', insertTextRules: regraSnippet },
            { label: 'Lista de navegação', insertText: '<nav aria-label="${1:Navegação principal}">\n  <ul>\n    <li><a href="${2:#}">${3:Início}</a></li>\n  </ul>\n</nav>', insertTextRules: regraSnippet },
            { label: 'Tabela acessível', insertText: '<table>\n  <caption>${1:Descrição da tabela}</caption>\n  <thead>\n    <tr><th scope="col">${2:Coluna}</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>${0:Valor}</td></tr>\n  </tbody>\n</table>', insertTextRules: regraSnippet },
            { label: 'Seção semântica', insertText: '<section aria-labelledby="${1:titulo-secao}">\n  <h2 id="${1:titulo-secao}">${2:Título da seção}</h2>\n  ${0}\n</section>', insertTextRules: regraSnippet }
          ],
          css: [
            { label: 'Flex centralizado', insertText: 'display: flex;\njustify-content: center;\nalign-items: center;' },
            { label: 'Grid responsivo', insertText: 'display: grid;\ngrid-template-columns: repeat(auto-fit, minmax(${1:220px}, 1fr));\ngap: ${2:16px};', insertTextRules: regraSnippet },
            { label: 'Variáveis de tema (:root)', insertText: ':root {\n  --cor-primaria: ${1:#4ab5f7};\n  --cor-texto: ${2:#1f2933};\n  --espacamento: ${3:16px};\n}', insertTextRules: regraSnippet },
            { label: 'Media query (mobile-first)', insertText: '@media (min-width: ${1:768px}) {\n  ${0}\n}', insertTextRules: regraSnippet },
            { label: 'Transição suave', insertText: 'transition: ${1:all} ${2:0.2s} ease;', insertTextRules: regraSnippet },
            { label: 'Reset básico de caixa', insertText: '*, *::before, *::after {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}', insertTextRules: regraSnippet }
          ],
          javascript: [
            { label: 'Evento click', insertText: "${1:elemento}.addEventListener('click', () => {\n  ${0}\n});", insertTextRules: regraSnippet },
            { label: 'Evento submit de formulário', insertText: "${1:formulario}.addEventListener('submit', (evento) => {\n  evento.preventDefault();\n  ${0}\n});", insertTextRules: regraSnippet },
            { label: 'fetch com try/catch', insertText: "async function ${1:buscarDados}() {\n  try {\n    const resposta = await fetch('${2:https://}');\n    const dados = await resposta.json();\n    ${0}\n  } catch (erro) {\n    console.error('Erro ao buscar dados:', erro);\n  }\n}", insertTextRules: regraSnippet },
            { label: 'Estrutura for', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n  ${0}\n}', insertTextRules: regraSnippet },
            { label: 'Estrutura for...of', insertText: 'for (const ${1:item} of ${2:array}) {\n  ${0}\n}', insertTextRules: regraSnippet },
            { label: 'Estrutura if/else', insertText: 'if (${1:condicao}) {\n  ${2}\n} else {\n  ${0}\n}', insertTextRules: regraSnippet },
            { label: 'Função declarada', insertText: 'function ${1:nomeDaFuncao}(${2:parametros}) {\n  ${0}\n}', insertTextRules: regraSnippet },
            { label: 'Módulo ES (import/export)', insertText: "import { ${1:algo} } from './${2:arquivo.js}';\n\nexport function ${3:minhaFuncao}() {\n  ${0}\n}", insertTextRules: regraSnippet },
            { label: 'Classe simples', insertText: 'class ${1:NomeDaClasse} {\n  constructor(${2:parametros}) {\n    ${0}\n  }\n}', insertTextRules: regraSnippet }
          ]
        };
      }

      // ----------------------------------------------------------------
      // Hover provider (item 9): dicionário estático de tags HTML e
      // propriedades CSS mais comuns no curso. O CSS já trata a exibição
      // nativa de .monaco-hover — aqui só decidimos o conteúdo.
      // ----------------------------------------------------------------
      function registrarHoverProviders() {
        var DICIONARIO_HTML = {
          a: 'Cria um link para outra página, arquivo ou seção. Use `href` para o destino.',
          div: 'Contêiner genérico sem significado semântico. Prefira uma tag semântica (section, article, nav) quando fizer sentido.',
          span: 'Contêiner genérico em linha, sem significado semântico — útil para estilizar um trecho de texto.',
          img: 'Insere uma imagem. `src` define o arquivo e `alt` é obrigatório para acessibilidade.',
          button: 'Botão clicável. Use `type="submit"` dentro de formulários ou `type="button"` para ações via JavaScript.',
          input: 'Campo de formulário. O atributo `type` define o comportamento (text, email, checkbox, etc.).',
          form: 'Agrupa campos de entrada para envio de dados.',
          label: 'Rótulo associado a um campo de formulário via o atributo `for`, essencial para acessibilidade.',
          ul: 'Lista não ordenada — os itens são marcados com marcadores (bullets).',
          ol: 'Lista ordenada — os itens são numerados automaticamente.',
          li: 'Item de uma lista (`ul` ou `ol`).',
          nav: 'Marca um bloco de navegação principal do site.',
          section: 'Agrupa conteúdo relacionado tematicamente, geralmente com um título.',
          article: 'Conteúdo independente que faria sentido sozinho, como um post de blog.',
          header: 'Cabeçalho de uma página ou seção.',
          footer: 'Rodapé de uma página ou seção.',
          main: 'Conteúdo principal da página — deve haver só um por página.',
          table: 'Cria uma tabela de dados.',
          thead: 'Agrupa a linha de cabeçalho de uma tabela.',
          tbody: 'Agrupa as linhas de dados de uma tabela.',
          tr: 'Linha de uma tabela.',
          td: 'Célula de dado de uma tabela.',
          th: 'Célula de cabeçalho de uma tabela.',
          h1: 'Título de nível 1 — o mais importante da página. Use só um por página.',
          h2: 'Título de nível 2 — subtítulo de uma seção.',
          p: 'Parágrafo de texto.',
          strong: 'Marca texto com importância forte (geralmente em negrito).',
          em: 'Marca texto com ênfase (geralmente em itálico).',
          script: 'Insere ou referencia código JavaScript.',
          link: 'Referencia um recurso externo, mais comumente uma folha de estilos CSS.',
          meta: 'Define metadados da página, como charset ou viewport.'
        };
        var DICIONARIO_CSS = {
          display: 'Define o tipo de exibição do elemento: `block`, `inline`, `flex`, `grid`, `none`, etc.',
          position: 'Define como o elemento é posicionado: `static`, `relative`, `absolute`, `fixed` ou `sticky`.',
          color: 'Define a cor do texto.',
          background: 'Atalho para definir cor/imagem de fundo e propriedades relacionadas.',
          margin: 'Espaço externo ao redor do elemento, fora da borda.',
          padding: 'Espaço interno entre o conteúdo e a borda do elemento.',
          border: 'Atalho para largura, estilo e cor da borda.',
          width: 'Define a largura do elemento.',
          height: 'Define a altura do elemento.',
          'flex-direction': 'Define o eixo principal de um contêiner flex: `row` ou `column`.',
          'justify-content': 'Alinha os itens flex/grid ao longo do eixo principal.',
          'align-items': 'Alinha os itens flex/grid ao longo do eixo transversal.',
          gap: 'Define o espaçamento entre itens de um contêiner flex ou grid.',
          'grid-template-columns': 'Define o número e o tamanho das colunas de um grid.',
          'font-size': 'Define o tamanho do texto.',
          'font-weight': 'Define a espessura do texto (ex.: normal, bold, 600).',
          'text-align': 'Alinha o texto horizontalmente dentro do elemento.',
          transition: 'Anima suavemente a mudança de uma ou mais propriedades CSS.',
          transform: 'Aplica transformações visuais como rotação, escala ou translação.',
          'box-shadow': 'Adiciona uma sombra ao redor do elemento.',
          'border-radius': 'Arredonda os cantos do elemento.',
          overflow: 'Controla o que acontece quando o conteúdo excede o tamanho do elemento.',
          'z-index': 'Define a ordem de empilhamento de elementos sobrepostos.',
          opacity: 'Define a transparência do elemento, de 0 (invisível) a 1 (opaco).',
          cursor: 'Define o ícone do cursor do mouse ao passar sobre o elemento.',
          'align-self': 'Sobrescreve o alinhamento de um item específico dentro de um contêiner flex/grid.'
        };
        function criarProvider(dicionario) {
          return {
            provideHover: function (model, position) {
              var palavra = model.getWordAtPosition(position);
              if (!palavra) return null;
              var descricao = dicionario[palavra.word.toLowerCase()];
              if (!descricao) return null;
              return {
                range: new monaco.Range(position.lineNumber, palavra.startColumn, position.lineNumber, palavra.endColumn),
                contents: [{ value: '**' + palavra.word.toLowerCase() + '**' }, { value: descricao }]
              };
            }
          };
        }
        monaco.languages.registerHoverProvider('html', criarProvider(DICIONARIO_HTML));
        monaco.languages.registerHoverProvider('css', criarProvider(DICIONARIO_CSS));
        monaco.languages.registerHoverProvider('scss', criarProvider(DICIONARIO_CSS));
      }

      // ----------------------------------------------------------------
      // Formatar documento (item 5): usa js-beautify (carregado por
      // ide.html via cdnjs) quando disponível. Sem a lib carregada, os
      // providers simplesmente não são registrados — a IDE continua
      // funcionando normalmente, só sem a ação de formatar.
      // ----------------------------------------------------------------
      function registrarFormatProviders() {
        function formatarComBeautify(fn, codigo, opcoes) {
          try { return fn(codigo, opcoes); } catch (erro) { return null; }
        }
        if (typeof window.html_beautify === 'function') {
          monaco.languages.registerDocumentFormattingEditProvider('html', {
            provideDocumentFormattingEdits: function (model) {
              var formatado = formatarComBeautify(window.html_beautify, model.getValue(), { indent_size: preferenciasDoEditor.tabSize, wrap_line_length: 0 });
              return formatado === null ? [] : [{ range: model.getFullModelRange(), text: formatado }];
            }
          });
        }
        if (typeof window.css_beautify === 'function') {
          ['css', 'scss'].forEach(function (linguagem) {
            monaco.languages.registerDocumentFormattingEditProvider(linguagem, {
              provideDocumentFormattingEdits: function (model) {
                var formatado = formatarComBeautify(window.css_beautify, model.getValue(), { indent_size: preferenciasDoEditor.tabSize });
                return formatado === null ? [] : [{ range: model.getFullModelRange(), text: formatado }];
              }
            });
          });
        }
        if (typeof window.js_beautify === 'function') {
          ['javascript', 'typescript', 'javascriptreact'].forEach(function (linguagem) {
            monaco.languages.registerDocumentFormattingEditProvider(linguagem, {
              provideDocumentFormattingEdits: function (model) {
                var formatado = formatarComBeautify(window.js_beautify, model.getValue(), { indent_size: preferenciasDoEditor.tabSize });
                return formatado === null ? [] : [{ range: model.getFullModelRange(), text: formatado }];
              }
            });
          });
        }
      }

      // ----------------------------------------------------------------
      // Emmet (item 12): opcional, carregado por ide.html via jsDelivr
      // (emmet-monaco-es não está confirmado no mirror do cdnjs, ao
      // contrário do restante das libs deste projeto). Falha ao carregar
      // não deve travar a IDE — por isso os checks defensivos abaixo.
      // ----------------------------------------------------------------
      function inicializarEmmet() {
        if (!window.emmetMonaco || typeof window.emmetMonaco.emmetHTML !== 'function') return;
        try {
          window.emmetMonaco.emmetHTML(monaco, ['html']);
          window.emmetMonaco.emmetCSS(monaco, ['css', 'scss']);
          window.emmetMonaco.emmetJSX(monaco, ['javascript', 'typescript', 'javascriptreact']);
        } catch (erro) {
          /* Emmet é um extra opcional; uma falha aqui não deve travar a IDE. */
        }
      }

      function registrarAutocompleteDoProjeto() {
        var tipos = monaco.languages.CompletionItemKind;
        var SNIPPETS = obterSnippetsPorLinguagem();
        var mapearSnippets = function (lista) {
          return lista.map(function (snippet) {
            return Object.assign({ kind: tipos.Snippet, detail: 'Snippet', range: null }, snippet);
          });
        };
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
            itens.push.apply(itens, mapearSnippets(SNIPPETS.html));
          }
          if (linguagem === 'css' || linguagem === 'scss') {
            Array.from(new Set((html.match(/\bclass\s*=\s*["']([^"']+)/gi) || []).flatMap(function (texto) { return (texto.replace(/^.*?["']/, '').match(/[^\s"']+/g) || []); }))).forEach(function (classe) { adicionar('.' + classe, 'Classe encontrada no HTML', tipos.Class); });
            Array.from(new Set((html.match(/\bid\s*=\s*["']([^"']+)/gi) || []).map(function (texto) { return texto.replace(/^.*?["']/, '').trim(); }))).forEach(function (id) { adicionar('#' + id, 'ID encontrado no HTML', tipos.Reference); });
            itens.push.apply(itens, mapearSnippets(SNIPPETS.css));
          }
          if (linguagem === 'javascript' || linguagem === 'typescript' || linguagem === 'javascriptreact') {
            Array.from(new Set((js.match(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g) || []).map(function (texto) { return texto.match(/([A-Za-z_$][\w$]*)$/)[1]; }))).forEach(function (nome) { adicionar(nome, 'Símbolo do projeto', tipos.Variable); });
            arquivosExtras.forEach(function (arquivo) { adicionar(arquivo.nome, 'Arquivo do projeto', tipos.File); });
            itens.push.apply(itens, mapearSnippets(SNIPPETS.javascript));
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
            return { actions: acoes, dispose: function () { } };
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
            return { actions: acoes, dispose: function () { } };
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
            return { actions: acoes, dispose: function () { } };
          }
        });
      }
      registrarAutocompleteDoProjeto();
      registrarHoverProviders();
      registrarFormatProviders();
      inicializarEmmet();
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
        arquivosExtras.forEach(function (arquivo) {
          if (!arquivo.editor || !arquivo.botaoDesfazer || !arquivo.botaoRefazer) return;
          var historico = arquivo.editor.session.getUndoManager();
          arquivo.botaoDesfazer.disabled = !historico.hasUndo();
          arquivo.botaoRefazer.disabled = !historico.hasRedo();
        });
      }

      [htmlEditor, cssEditor, jsEditor].forEach(function (editor) {
        editor.on('focus', function () {
          editorAtivoParaHistorico = editor;
          atualizarControlesHistorico();
        });
        editor.session.on('change', atualizarControlesHistorico);
      });

      atualizarControlesHistorico();

      window.addEventListener('theme:mudou', function (event) {
        aplicarTemaMonaco(event.detail);
      });

      // ==================================================================
      // Painel inferior: Problemas (item 7), Console (item 8) e Busca no
      // projeto (item 6). Overlay independente do fluxo flex de
      // editores/preview — ver comentário no HTML sobre .bottom-panel.
      // ==================================================================
      var bottomPanel = document.getElementById('bottom-panel');
      var btnToggleBottomPanel = document.getElementById('btn-toggle-bottom-panel');
      var btnFecharPainelInferior = document.getElementById('btn-fechar-painel-inferior');
      var abasPainelInferior = Array.prototype.slice.call(document.querySelectorAll('.bottom-panel-tab'));
      var painelInferiorAtivo = 'problemas';

      function selecionarAbaPainelInferior(nomeAba) {
        painelInferiorAtivo = nomeAba;
        abasPainelInferior.forEach(function (aba) {
          var ativa = aba.getAttribute('data-panel') === nomeAba;
          aba.classList.toggle('is-active', ativa);
          aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
        });
        ['problemas', 'console', 'buscar'].forEach(function (nome) {
          var painel = document.getElementById('painel-' + nome);
          if (painel) painel.hidden = nome !== nomeAba;
        });
      }
      function abrirPainelInferior(nomeAba) {
        if (!bottomPanel) return;
        bottomPanel.hidden = false;
        if (btnToggleBottomPanel) btnToggleBottomPanel.setAttribute('aria-expanded', 'true');
        selecionarAbaPainelInferior(nomeAba || painelInferiorAtivo);
      }
      function fecharPainelInferior() {
        if (!bottomPanel) return;
        bottomPanel.hidden = true;
        if (btnToggleBottomPanel) btnToggleBottomPanel.setAttribute('aria-expanded', 'false');
      }
      if (btnToggleBottomPanel) {
        btnToggleBottomPanel.addEventListener('click', function () {
          if (!bottomPanel || bottomPanel.hidden) abrirPainelInferior('problemas');
          else fecharPainelInferior();
        });
      }
      if (btnFecharPainelInferior) btnFecharPainelInferior.addEventListener('click', fecharPainelInferior);
      abasPainelInferior.forEach(function (aba) {
        aba.addEventListener('click', function () { abrirPainelInferior(aba.getAttribute('data-panel')); });
      });

      function irParaLocalizacaoNoArquivo(arquivo, linha, coluna) {
        var aba = document.querySelector('.code-tab[data-target="' + arquivo.idPane + '"]');
        var checkbox = aba && aba.querySelector('.editor-toggle-checkbox');
        if (checkbox && !checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change'));
        }
        var editorNativo = arquivo.editor.getMonacoEditor && arquivo.editor.getMonacoEditor();
        requestAnimationFrame(function () {
          arquivo.editor.focus();
          if (!editorNativo) return;
          editorNativo.revealLineInCenter(linha + 1);
          editorNativo.setPosition({ lineNumber: linha + 1, column: coluna + 1 });
        });
      }

      // ---- Problemas (item 7) -----------------------------------------
      var listaProblemas = document.getElementById('lista-problemas');
      var problemasVazio = document.getElementById('problemas-vazio');
      var contadorProblemas = document.getElementById('contador-problemas');
      var contadorProblemasToolbar = document.getElementById('contador-problemas-toolbar');
      var PESO_SEVERIDADE = { error: 0, warning: 1, info: 2, hint: 3 };

      function iconeDaSeveridade(tipo) {
        return tipo === 'error' ? '⛔' : (tipo === 'warning' ? '⚠️' : (tipo === 'info' ? 'ℹ️' : '💡'));
      }
      function coletarTodosOsDiagnosticos() {
        var linhas = [];
        arquivosExtras.forEach(function (arquivo) {
          var anotacoes = arquivo.editor.session.getAnnotations().concat(arquivo.editor.getNativeAnnotations());
          anotacoes.forEach(function (anotacao) { linhas.push({ arquivo: arquivo, anotacao: anotacao }); });
        });
        linhas.sort(function (a, b) {
          return (PESO_SEVERIDADE[tipoDaAnotacao(a.anotacao)] || 9) - (PESO_SEVERIDADE[tipoDaAnotacao(b.anotacao)] || 9);
        });
        return linhas;
      }
      function atualizarPainelDeProblemas() {
        if (!listaProblemas) return;
        var itens = coletarTodosOsDiagnosticos();
        listaProblemas.innerHTML = '';
        itens.forEach(function (item) {
          var tipo = tipoDaAnotacao(item.anotacao);
          var li = document.createElement('li');
          li.className = 'problem-item problem-item--' + tipo;
          li.tabIndex = 0;
          li.innerHTML = '<span class="problem-item-icon" aria-hidden="true"></span><span class="problem-item-file"></span><span class="problem-item-location"></span><span class="problem-item-message"></span>';
          li.querySelector('.problem-item-icon').textContent = iconeDaSeveridade(tipo);
          li.querySelector('.problem-item-file').textContent = item.arquivo.nome;
          li.querySelector('.problem-item-location').textContent = 'Linha ' + ((item.anotacao.row || 0) + 1);
          li.querySelector('.problem-item-message').textContent = item.anotacao.text || '';
          var irParaAqui = function () { irParaLocalizacaoNoArquivo(item.arquivo, item.anotacao.row || 0, item.anotacao.column || 0); };
          li.addEventListener('click', irParaAqui);
          li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irParaAqui(); } });
          listaProblemas.appendChild(li);
        });
        if (problemasVazio) problemasVazio.hidden = itens.length > 0;
        [contadorProblemas, contadorProblemasToolbar].forEach(function (el) {
          if (!el) return;
          el.hidden = itens.length === 0;
          el.textContent = String(itens.length);
        });
        arquivosExtras.forEach(function (arquivo) {
          if (!arquivo.contadorProblemas) return;
          var doArquivo = itens.filter(function (item) { return item.arquivo === arquivo; }).length;
          arquivo.contadorProblemas.hidden = doArquivo === 0;
          arquivo.contadorProblemas.textContent = String(doArquivo);
        });
      }

      // ---- Console visual (item 8) -------------------------------------
      var MAX_MENSAGENS_CONSOLE = 300;
      var mensagensConsole = [];
      var listaConsole = document.getElementById('lista-console');
      var consoleVazio = document.getElementById('console-vazio');
      var btnLimparConsole = document.getElementById('btn-limpar-console');

      function iconeDoNivelConsole(nivel) {
        return nivel === 'error' ? '⛔' : (nivel === 'warn' ? '⚠️' : (nivel === 'info' ? 'ℹ️' : '»'));
      }
      function renderizarConsole() {
        if (!listaConsole) return;
        listaConsole.innerHTML = '';
        mensagensConsole.forEach(function (msg) {
          var li = document.createElement('li');
          li.className = 'console-message console-message--' + msg.nivel;
          li.innerHTML = '<span class="console-message-icon" aria-hidden="true"></span><span class="console-message-text"></span>';
          li.querySelector('.console-message-icon').textContent = iconeDoNivelConsole(msg.nivel);
          li.querySelector('.console-message-text').textContent = msg.texto;
          listaConsole.appendChild(li);
        });
        if (consoleVazio) consoleVazio.hidden = mensagensConsole.length > 0;
        listaConsole.scrollTop = listaConsole.scrollHeight;
      }
      function adicionarMensagemConsole(nivel, texto) {
        mensagensConsole.push({ nivel: nivel, texto: texto });
        if (mensagensConsole.length > MAX_MENSAGENS_CONSOLE) mensagensConsole = mensagensConsole.slice(-MAX_MENSAGENS_CONSOLE);
        renderizarConsole();
      }
      if (btnLimparConsole) {
        btnLimparConsole.addEventListener('click', function () { mensagensConsole = []; renderizarConsole(); });
      }

      // ---- Busca no projeto (item 6) -----------------------------------
      var formBuscaProjeto = document.getElementById('form-busca-projeto');
      var inputBuscaProjeto = document.getElementById('input-busca-projeto');
      var chkBuscaCase = document.getElementById('chk-busca-case');
      var listaResultadosBusca = document.getElementById('lista-resultados-busca');
      var buscaVazia = document.getElementById('busca-vazia');

      function executarBuscaGlobal(termo, diferenciarMaiusculas) {
        if (!listaResultadosBusca) return;
        listaResultadosBusca.innerHTML = '';
        if (!termo) { if (buscaVazia) buscaVazia.hidden = true; return; }
        var totalResultados = 0;
        arquivosExtras.forEach(function (arquivo) {
          var model = arquivo.editor.getModel && arquivo.editor.getModel();
          if (!model) return;
          var ocorrencias;
          try {
            ocorrencias = model.findMatches(termo, true, false, diferenciarMaiusculas, null, true);
          } catch (erroBusca) {
            ocorrencias = [];
          }
          if (!ocorrencias.length) return;
          var grupo = document.createElement('li');
          grupo.className = 'search-result-group';
          var titulo = document.createElement('div');
          titulo.className = 'search-result-file';
          titulo.textContent = arquivo.nome + ' (' + ocorrencias.length + ')';
          grupo.appendChild(titulo);
          var sublista = document.createElement('ul');
          ocorrencias.slice(0, 50).forEach(function (ocorrencia) {
            var linha = ocorrencia.range.startLineNumber;
            var li = document.createElement('li');
            li.className = 'search-result-item';
            li.tabIndex = 0;
            li.textContent = 'Linha ' + linha + ': ' + model.getLineContent(linha).trim().slice(0, 120);
            var ir = function () { irParaLocalizacaoNoArquivo(arquivo, linha - 1, ocorrencia.range.startColumn - 1); };
            li.addEventListener('click', ir);
            li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
            sublista.appendChild(li);
            totalResultados++;
          });
          grupo.appendChild(sublista);
          listaResultadosBusca.appendChild(grupo);
        });
        if (buscaVazia) buscaVazia.hidden = totalResultados > 0;
      }
      if (formBuscaProjeto) {
        formBuscaProjeto.addEventListener('submit', function (e) {
          e.preventDefault();
          executarBuscaGlobal((inputBuscaProjeto.value || '').trim(), !!(chkBuscaCase && chkBuscaCase.checked));
        });
      }

      // ---- Minimap (item 1) --------------------------------------------
      // O botão agora vive na barra de cada arquivo (não é mais único no
      // topo), mas a preferência continua global — alternar em qualquer
      // arquivo reflete em todos.
      function atualizarBotaoMinimap() {
        Array.prototype.forEach.call(document.querySelectorAll('.file-tool-menu-item[data-acao="minimap"]'), function (item) {
          item.setAttribute('aria-checked', preferenciasDoEditor.minimap ? 'true' : 'false');
          item.classList.toggle('is-active', !!preferenciasDoEditor.minimap);
        });
      }
      function alternarMinimap() {
        preferenciasDoEditor.minimap = !preferenciasDoEditor.minimap;
        salvarPreferenciasDoEditor();
        aplicarPreferenciasATodosOsEditores();
        atualizarBotaoMinimap();
      }

      // ---- Preferências do editor (item 13) -----------------------------
      var btnEditorPrefs = document.getElementById('btn-editor-prefs');
      var editorPrefsDialog = document.getElementById('editor-prefs-dialog');
      var editorPrefsForm = document.getElementById('editor-prefs-form');
      var prefFontSize = document.getElementById('pref-font-size');
      var prefTabSize = document.getElementById('pref-tab-size');
      var prefWordWrap = document.getElementById('pref-word-wrap');
      var prefRenderWhitespace = document.getElementById('pref-render-whitespace');
      var prefMinimap = document.getElementById('pref-minimap');
      function preencherFormularioDePreferencias() {
        if (prefFontSize) prefFontSize.value = preferenciasDoEditor.fontSize;
        if (prefTabSize) prefTabSize.value = String(preferenciasDoEditor.tabSize);
        if (prefWordWrap) prefWordWrap.checked = preferenciasDoEditor.wordWrap === 'on';
        if (prefRenderWhitespace) prefRenderWhitespace.checked = preferenciasDoEditor.renderWhitespace === 'all';
        if (prefMinimap) prefMinimap.checked = !!preferenciasDoEditor.minimap;
      }
      if (btnEditorPrefs && editorPrefsDialog) {
        btnEditorPrefs.addEventListener('click', function () {
          preencherFormularioDePreferencias();
          editorPrefsDialog.showModal();
        });
      }
      if (editorPrefsForm) {
        editorPrefsForm.addEventListener('submit', function (e) {
          if (e.submitter && e.submitter.value === 'cancel') return;
          preferenciasDoEditor.fontSize = Math.max(10, Math.min(24, parseInt(prefFontSize.value, 10) || 14));
          preferenciasDoEditor.tabSize = parseInt(prefTabSize.value, 10) === 4 ? 4 : 2;
          preferenciasDoEditor.wordWrap = prefWordWrap.checked ? 'on' : 'off';
          preferenciasDoEditor.renderWhitespace = prefRenderWhitespace.checked ? 'all' : 'selection';
          preferenciasDoEditor.minimap = !!prefMinimap.checked;
          salvarPreferenciasDoEditor();
          aplicarPreferenciasATodosOsEditores();
          atualizarBotaoMinimap();
          mostrarToast('Preferências do editor atualizadas.');
        });
      }

      // ---- Atalhos de teclado (item 14) ---------------------------------
      var btnKeyboardShortcuts = document.getElementById('btn-keyboard-shortcuts');
      var keyboardShortcutsDialog = document.getElementById('keyboard-shortcuts-dialog');
      if (btnKeyboardShortcuts && keyboardShortcutsDialog) {
        btnKeyboardShortcuts.addEventListener('click', function () { keyboardShortcutsDialog.showModal(); });
      }

      // ---- Comparar arquivos / diff editor (item 16) --------------------
      // Simplificação deliberada: compara dois arquivos abertos à escolha
      // do usuário (não necessariamente "salvo vs. atual" — ver
      // avaliacao-monaco-ide.md, item 16, para o motivo dessa escolha).
      var compareFilesDialog = document.getElementById('compare-files-dialog');
      var compareFileA = document.getElementById('compare-file-a');
      var compareFileB = document.getElementById('compare-file-b');
      var diffEditorContainer = document.getElementById('diff-editor-container');
      var instanciaDiffEditor = null;

      function linguagemParaMonaco(linguagem) {
        return linguagem === 'javascriptreact' ? 'javascript' : (linguagem === 'svg' ? 'xml' : linguagem);
      }
      function descartarModelosDoDiff() {
        if (!instanciaDiffEditor) return;
        var modelos = instanciaDiffEditor.getModel();
        if (modelos) {
          if (modelos.original) modelos.original.dispose();
          if (modelos.modified) modelos.modified.dispose();
        }
      }
      function preencherSelectsDeComparacao() {
        [compareFileA, compareFileB].forEach(function (select) {
          var valorAnterior = select.value;
          select.innerHTML = '';
          arquivosExtras.forEach(function (arquivo) {
            var opcao = document.createElement('option');
            opcao.value = arquivo.idPane;
            opcao.textContent = arquivo.nome;
            select.appendChild(opcao);
          });
          if (valorAnterior && arquivosExtras.some(function (a) { return a.idPane === valorAnterior; })) select.value = valorAnterior;
        });
        if (compareFileB.options.length > 1 && compareFileB.selectedIndex === compareFileA.selectedIndex) {
          compareFileB.selectedIndex = (compareFileA.selectedIndex + 1) % compareFileB.options.length;
        }
      }
      function atualizarDiffEditor() {
        var arquivoA = arquivosExtras.find(function (a) { return a.idPane === compareFileA.value; });
        var arquivoB = arquivosExtras.find(function (a) { return a.idPane === compareFileB.value; });
        if (!arquivoA || !arquivoB || !diffEditorContainer) return;
        if (!instanciaDiffEditor) {
          instanciaDiffEditor = monaco.editor.createDiffEditor(diffEditorContainer, {
            readOnly: true,
            renderSideBySide: true,
            automaticLayout: true
          });
        } else {
          descartarModelosDoDiff();
        }
        instanciaDiffEditor.setModel({
          original: monaco.editor.createModel(arquivoA.editor.getValue(), linguagemParaMonaco(arquivoA.linguagem)),
          modified: monaco.editor.createModel(arquivoB.editor.getValue(), linguagemParaMonaco(arquivoB.linguagem))
        });
      }
      function abrirComparacaoDeArquivos(arquivoBase) {
        if (!compareFilesDialog || !compareFileA || !compareFileB) return;
        if (arquivosExtras.length < 2) {
          mostrarToast('Abra pelo menos dois arquivos para comparar.');
          return;
        }
        preencherSelectsDeComparacao();
        if (arquivoBase) compareFileA.value = arquivoBase.idPane;
        if (compareFileB.options.length > 1 && compareFileB.value === compareFileA.value) {
          compareFileB.selectedIndex = (compareFileA.selectedIndex + 1) % compareFileB.options.length;
        }
        compareFilesDialog.showModal();
        requestAnimationFrame(atualizarDiffEditor);
      }
      if (compareFileA && compareFileB) {
        [compareFileA, compareFileB].forEach(function (select) { select.addEventListener('change', atualizarDiffEditor); });
      }
      if (compareFilesDialog) compareFilesDialog.addEventListener('close', descartarModelosDoDiff);

      // Um arquivo pertence ao exercício da etapa (padrão) ou ao projeto do
      // aluno (origem === 'projeto'). Os dois nunca se misturam: exercício
      // vai para o salvamento da etapa; projeto vai para o próprio banco.
      function ehArquivoDeExercicio(arquivo) { return arquivo.origem !== 'projeto'; }

      function removerArquivosExtras() {
        arquivosExtras.filter(ehArquivoDeExercicio).forEach(function (arquivo) {
          var aba = dragContainer.querySelector('.code-tab[data-target="' + arquivo.idPane + '"]');
          var painel = document.getElementById(arquivo.idPane);
          clearTimeout(arquivo.validacaoTimeout);
          if (arquivo.layoutFrame) cancelAnimationFrame(arquivo.layoutFrame);
          if (arquivo.editor && typeof arquivo.editor.dispose === 'function') arquivo.editor.dispose();
          if (aba) aba.remove();
          if (painel) painel.remove();
        });
        arquivosExtras = arquivosExtras.filter(function (arquivo) { return !ehArquivoDeExercicio(arquivo); });
        if (typeof atualizarPainelDeProblemas === 'function') atualizarPainelDeProblemas();
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
          files: arquivosExtras.filter(ehArquivoDeExercicio).map(function (arquivo) {
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
          files: arquivosExtras.filter(ehArquivoDeExercicio).map(function (arquivo) {
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
            // Estas duas funções vivem em iniciarTeoria (outro escopo): são
            // expostas em window. Chamá-las direto lançava ReferenceError, que o
            // .catch abaixo engolia — todo salvamento terminava como "não salvo"
            // e a nuvem/pasta do aparelho nunca eram agendadas a partir do IDE.
            if (typeof window.agendarSincronizacaoNuvemDaIde === 'function') window.agendarSincronizacaoNuvemDaIde();
            if (typeof window.agendarBackupNoAparelhoDaIde === 'function') window.agendarBackupNoAparelhoDaIde();
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
        // Um único ponto de atualização para os dois lugares que mostram
        // diagnósticos — o badge por aba (acima) e a visão consolidada do
        // painel de problemas (item 7 da avaliação técnica do Monaco).
        if (typeof atualizarPainelDeProblemas === 'function') atualizarPainelDeProblemas();
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
        var arquivo = arquivosExtras.filter(ehArquivoDeExercicio).find(function (item) {
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
        return arquivosExtras.filter(ehArquivoDeExercicio).find(function (arquivo) {
          return (linguagensPorTipo[tipo] || []).indexOf(arquivo.linguagem) >= 0;
        }) || null;
      }

      function mesclarAnotacoesExecucaoJS() {
        obterArquivosPorLinguagem(['javascript'], 'todas').forEach(function (arquivo) {
          var estaticas = arquivo.editor.session.getAnnotations().filter(function (a) { return !a.__execucao; });
          var execucaoDesteArquivo = anotacoesExecucaoJS.filter(function (a) { return a.__idPane === arquivo.idPane; });
          arquivo.editor.session.setAnnotations(estaticas.concat(execucaoDesteArquivo));
        });
      }

      function finalizarAtualizacaoJS() {
        obterArquivosPorLinguagem(['javascript'], 'todas').forEach(function (arquivo) {
          var anotacoes = arquivo.editor.session.getAnnotations().concat(arquivo.editor.getNativeAnnotations());
          atualizarBadgeDoArquivo(arquivo, anotacoes);
        });
      }

      window.addEventListener('ide:resize', function () {
        requestAnimationFrame(function () {
          reencaixarSplitEditorPreview();
          redimensionarEditores();
        });
      });

      function alternarIcones(iconeExpandir, iconeRecolher, expandido) {
        iconeExpandir.style.display = expandido ? 'none' : 'block';
        iconeRecolher.style.display = expandido ? 'block' : 'none';
      }

      function escaparFechamentoScript(codigo) {
        return codigo.replace(/<\/script>/gi, '<\\/script>');
      }

      function removerTodosOsIframesDePreview() {
        var legado = document.getElementById('preview-output');
        if (legado) legado.remove();
        Object.keys(iframesPreviewPorIdPane).forEach(function (idPane) {
          iframesPreviewPorIdPane[idPane].remove();
        });
        iframesPreviewPorIdPane = {};
        offsetsLinhaJSPorIdPane = {};
        ultimoHtmlPorIdPane = {};
        ultimoTemaPreviewPorIdPane = {};
        previewAtivoIdPane = null;
        ultimaAssinaturaCssJs = null;
        if (previewTabsContainer) {
          previewTabsContainer.hidden = true;
          previewTabsContainer.innerHTML = '';
        }
      }

      // Remove iframes de arquivos HTML que não existem mais (fechados,
      // renomeados para outra linguagem etc.) e garante que sempre haja
      // uma aba ativa válida. Não recria os iframes que continuam
      // existindo — isso é feito por renderizarPreview, só quando o
      // conteúdo relevante daquele iframe específico realmente muda.
      function sincronizarIframesDePreview(arquivosPreview) {
        var idsAtuais = arquivosPreview.map(function (arquivo) { return arquivo.idPane; });

        if (!idsAtuais.length) {
          Object.keys(iframesPreviewPorIdPane).forEach(function (idPane) {
            iframesPreviewPorIdPane[idPane].remove();
          });
          iframesPreviewPorIdPane = {};
          offsetsLinhaJSPorIdPane = {};
          ultimoHtmlPorIdPane = {};
          ultimoTemaPreviewPorIdPane = {};
          previewAtivoIdPane = null;
          return;
        }

        var legado = document.getElementById('preview-output');
        if (legado) legado.remove();

        Object.keys(iframesPreviewPorIdPane).forEach(function (idPane) {
          if (idsAtuais.indexOf(idPane) === -1) {
            iframesPreviewPorIdPane[idPane].remove();
            delete iframesPreviewPorIdPane[idPane];
            delete offsetsLinhaJSPorIdPane[idPane];
            delete ultimoHtmlPorIdPane[idPane];
            delete ultimoTemaPreviewPorIdPane[idPane];
          }
        });

        if (!previewAtivoIdPane || idsAtuais.indexOf(previewAtivoIdPane) === -1) {
          previewAtivoIdPane = idsAtuais[0];
        }
      }

      function iframeDePreviewAtivo() {
        var legado = document.getElementById('preview-output');
        if (legado) return legado;
        return iframesPreviewPorIdPane[previewAtivoIdPane] || null;
      }

      function atualizarAbasDePreview(arquivosPreview) {
        if (!previewTabsContainer) return;
        if (arquivosPreview.length < 2) {
          previewTabsContainer.hidden = true;
          previewTabsContainer.innerHTML = '';
          return;
        }
        previewTabsContainer.hidden = false;
        previewTabsContainer.innerHTML = '';
        arquivosPreview.forEach(function (arquivo) {
          var botao = document.createElement('button');
          botao.type = 'button';
          botao.className = 'preview-tab-btn';
          botao.setAttribute('role', 'tab');
          var rotuloDoPreview = arquivo.origem === 'projeto' ? '(projeto) ' + arquivo.nome : arquivo.nome;
          botao.title = 'Ver preview de ' + rotuloDoPreview;
          botao.textContent = rotuloDoPreview;
          var ativo = arquivo.idPane === previewAtivoIdPane;
          botao.classList.toggle('is-active', ativo);
          botao.setAttribute('aria-selected', ativo ? 'true' : 'false');
          botao.addEventListener('click', function () {
            if (previewAtivoIdPane === arquivo.idPane) return;
            previewAtivoIdPane = arquivo.idPane;
            Object.keys(iframesPreviewPorIdPane).forEach(function (idPane) {
              iframesPreviewPorIdPane[idPane].classList.toggle('is-preview-ativo', idPane === previewAtivoIdPane);
            });
            // O console visual mostra a execução da página vista agora.
            // Trocar de aba limpa esse histórico, mas NÃO recarrega o
            // iframe da aba anterior — ela continua rodando por trás,
            // preservando seu estado (é o ponto da independência entre abas).
            if (typeof mensagensConsole !== 'undefined') {
              mensagensConsole = [];
              if (typeof renderizarConsole === 'function') renderizarConsole();
            }
            atualizarAbasDePreview(arquivosPreview);
          });
          previewTabsContainer.appendChild(botao);
        });
      }

      var offsetLinhaJSNoPreview = 0;
      var mapaLinhasJsPreview = [];

      // ----------------------------------------------------------------
      // Abas de visualização do preview: um iframe independente por
      // arquivo HTML aberto, para o usuário escolher qual página ver sem
      // perder o estado de execução das outras ao trocar de aba.
      // ----------------------------------------------------------------
      var previewAtivoIdPane = null;      // idPane do arquivo HTML exibido agora
      var iframesPreviewPorIdPane = {};   // idPane -> elemento <iframe>
      var offsetsLinhaJSPorIdPane = {};   // idPane -> offset de linhas (mapeamento de erro por página)
      var ultimoHtmlPorIdPane = {};       // idPane -> último HTML usado para montar aquele iframe
      var ultimoTemaPreviewPorIdPane = {}; // idPane -> tema usado para montar aquele iframe
      var ultimaAssinaturaCssJs = null;   // detecta mudança no CSS/JS compartilhado entre todas as páginas

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

      // origem: 'exercicio' (padrão), 'projeto' ou 'todas'. O preview de uma
      // página só enxerga os CSS/JS da MESMA origem dela (ver montarCodigoPreview).
      function obterArquivosPorLinguagem(linguagens, origem) {
        origem = origem || 'exercicio';
        var ordemDasAbas = obterAbasOrdenadas().map(function (aba) { return aba.getAttribute('data-target'); });
        return arquivosExtras.filter(function (arquivo) {
          if (origem !== 'todas' && (arquivo.origem || 'exercicio') !== origem) return false;
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

      // Conteúdo de página que cada tipo "previewável" produz. HTML e SVG
      // usam o próprio conteúdo bruto como corpo da página; Markdown passa
      // pelo renderizador básico antes.
      function conteudoDaPaginaPreview(arquivo) {
        if (arquivo.linguagem === 'markdown') {
          return '<main class="markdown-preview">' + renderizarMarkdownBasico(arquivo.editor.getValue()) + '</main>';
        }
        return arquivo.editor.getValue();
      }

      function montarCodigoPreview(arquivoAtivo) {
        // HTML, Markdown e SVG são as linguagens que "usam preview" — todas
        // entram juntas na mesma lista de abas de visualização (cada
        // arquivo, de qualquer um desses três tipos, ganha sua própria
        // aba). CSS/JS não geram aba: são recursos compartilhados,
        // injetados dentro de qualquer página ativa, seja ela HTML,
        // Markdown ou SVG.
        var origemDoPreview = arquivoAtivo ? (arquivoAtivo.origem || 'exercicio') : 'exercicio';
        var arquivosPreview = obterArquivosPorLinguagem(['html', 'markdown', 'svg'], origemDoPreview);
        var arquivosCss = obterArquivosPorLinguagem(['css'], origemDoPreview);
        var arquivosJs = obterArquivosPorLinguagem(['javascript'], origemDoPreview);
        var html = arquivoAtivo ? conteudoDaPaginaPreview(arquivoAtivo) : (arquivosPreview.length ? conteudoDaPaginaPreview(arquivosPreview[0]) : htmlEditor.getValue());
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
          '});\n' +
          // Console visual (item 8): intercepta console.log/warn/info/error
          // e reenvia ao pai por postMessage, sem deixar de chamar o
          // console nativo (o aluno ainda vê no devtools do navegador).
          '(function () {\n' +
          '  var serializarArgumento = function (valor) {\n' +
          '    try {\n' +
          '      if (typeof valor === "undefined") return "undefined";\n' +
          '      if (typeof valor === "function") return "[function]";\n' +
          '      if (valor instanceof Error) return valor.name + ": " + valor.message;\n' +
          '      if (typeof valor === "object" && valor !== null) return JSON.stringify(valor);\n' +
          '      return String(valor);\n' +
          '    } catch (erroSerializacao) { return String(valor); }\n' +
          '  };\n' +
          '  ["log", "warn", "info", "error"].forEach(function (nivel) {\n' +
          '    var original = console[nivel] ? console[nivel].bind(console) : function () {};\n' +
          '    console[nivel] = function () {\n' +
          '      original.apply(console, arguments);\n' +
          '      try {\n' +
          '        var partes = Array.prototype.map.call(arguments, serializarArgumento);\n' +
          '        window.parent.postMessage({ tipo: "console", nivel: nivel, mensagem: partes.join(" ") }, "*");\n' +
          '      } catch (erroEnvio) {}\n' +
          '    };\n' +
          '  });\n' +
          '  console.table = function (dados) { console.log(dados); };\n' +
          '})();\n';

        var prefixo = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<style>\n' + estiloTemaPreview + '\nbody { margin: 0; padding: 0 0 0 6px; }\n.markdown-preview { max-width: 860px; margin: 28px auto; padding: 0 20px; line-height: 1.55; } .markdown-preview code { padding: 2px 4px; border-radius: 3px; background: rgba(128,128,128,.18); }\n/* O CSS do projeto vem por último para ter precedência total. */\n' + css + '\n</style>\n</head>\n<body>\n' + html + '\n<script>\n' + handlerErros;

        offsetLinhaJSNoPreview = prefixo.split('\n').length - 1;
        if (arquivoAtivo) offsetsLinhaJSPorIdPane[arquivoAtivo.idPane] = offsetLinhaJSNoPreview;

        return prefixo + js + '\n<' + '/script>\n</body>\n</html>';
      }

      function obterEditorPorTipo(tipo) {
        if (tipo === 'html') return htmlEditor;
        if (tipo === 'css') return cssEditor;
        if (tipo === 'js') return jsEditor;
        return null;
      }

      function renderizarPreview() {
        previewContainer.classList.toggle('preview-area--dark', previewTemaEscuro);

        clearTimeout(timeoutErrosExecucao);
        timeoutErrosExecucao = null;
        filaErrosExecucao = [];
        anotacoesExecucaoJS = [];
        mesclarAnotacoesExecucaoJS();
        finalizarAtualizacaoJS();
        if (typeof mensagensConsole !== 'undefined') {
          mensagensConsole = [];
          if (typeof renderizarConsole === 'function') renderizarConsole();
        }

        // HTML, Markdown e SVG usam preview — todos entram na mesma lista
        // de abas de visualização (CSS/JS são recursos injetados, não
        // geram aba própria).
        var arquivosPreview = obterArquivosPorLinguagem(['html', 'markdown', 'svg'], 'todas');

        if (!arquivosPreview.length) {
          // Caminho legado: nenhum arquivo HTML/Markdown/SVG em
          // arquivosExtras (etapas antigas baseadas só em
          // htmlEditor/cssEditor/jsEditor). Sempre foi um iframe único —
          // sem abas de visualização, porque não há entre o quê escolher.
          sincronizarIframesDePreview([]);
          if (previewTabsContainer) {
            previewTabsContainer.hidden = true;
            previewTabsContainer.innerHTML = '';
          }
          var antigoLegado = document.getElementById('preview-output');
          if (antigoLegado) antigoLegado.remove();
          var iframeUnico = document.createElement('iframe');
          iframeUnico.className = 'preview-iframe';
          iframeUnico.classList.toggle('preview-iframe--dark', previewTemaEscuro);
          iframeUnico.id = 'preview-output';
          iframeUnico.title = 'Preview do código';
          iframeUnico.setAttribute('sandbox', 'allow-scripts');
          previewContainer.appendChild(iframeUnico);
          iframeUnico.srcdoc = montarCodigoPreview(null);
        } else {
          // Abas de visualização: um iframe independente por arquivo
          // HTML/Markdown/SVG. Trocar de aba só alterna visibilidade (ver
          // .is-preview-ativo no CSS) — nunca recria o iframe, para
          // preservar o estado de execução de quem não está sendo editado
          // agora. Um iframe só é recarregado quando o conteúdo daquela
          // aba especificamente muda, ou quando CSS/JS (compartilhados
          // entre todas as páginas) mudam.
          sincronizarIframesDePreview(arquivosPreview);

          var arquivosCss = obterArquivosPorLinguagem(['css'], 'todas');
          var arquivosJs = obterArquivosPorLinguagem(['javascript'], 'todas');
          var assinaturaCssJsAtual = arquivosCss.map(function (a) { return a.editor.getValue(); }).join('\u0000') +
            '\u0001' + arquivosJs.map(function (a) { return a.editor.getValue(); }).join('\u0000');
          var cssOuJsMudou = assinaturaCssJsAtual !== ultimaAssinaturaCssJs;
          ultimaAssinaturaCssJs = assinaturaCssJsAtual;

          arquivosPreview.forEach(function (arquivo) {
            var conteudoAtual = arquivo.editor.getValue();
            var iframeJaExistia = !!iframesPreviewPorIdPane[arquivo.idPane];
            var conteudoMudou = ultimoHtmlPorIdPane[arquivo.idPane] !== conteudoAtual;
            var temaMudou = ultimoTemaPreviewPorIdPane[arquivo.idPane] !== previewTemaEscuro;
            var iframe = iframesPreviewPorIdPane[arquivo.idPane];

            if (!iframe) {
              iframe = document.createElement('iframe');
              iframe.className = 'preview-iframe';
              iframe.setAttribute('sandbox', 'allow-scripts');
              previewContainer.appendChild(iframe);
              iframesPreviewPorIdPane[arquivo.idPane] = iframe;
            }
            iframe.title = 'Preview de ' + arquivo.nome;
            iframe.classList.toggle('preview-iframe--dark', previewTemaEscuro);
            iframe.classList.toggle('is-preview-ativo', arquivo.idPane === previewAtivoIdPane);

            if (!iframeJaExistia || conteudoMudou || cssOuJsMudou || temaMudou) {
              iframe.srcdoc = montarCodigoPreview(arquivo);
              ultimoHtmlPorIdPane[arquivo.idPane] = conteudoAtual;
              ultimoTemaPreviewPorIdPane[arquivo.idPane] = previewTemaEscuro;
            }
          });

          atualizarAbasDePreview(arquivosPreview);
        }

        requestAnimationFrame(function () {
          reencaixarSplitEditorPreview();
          redimensionarEditores();
        });
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
            var offsetUsado = typeof dado.__offset === 'number' ? dado.__offset : offsetLinhaJSNoPreview;
            var linhaNoCodigoConcatenado = Math.max(0, dado.linha - 1 - offsetUsado);
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
        if (!e.data) return;
        var iframeAtivo = iframeDePreviewAtivo();
        if (!iframeAtivo || e.source !== iframeAtivo.contentWindow) return;

        if (e.data.tipo === 'console') {
          if (typeof adicionarMensagemConsole === 'function') {
            adicionarMensagemConsole(String(e.data.nivel || 'log'), String(e.data.mensagem || ''));
          }
          return;
        }

        if (e.data.tipo !== 'erro-execucao-js') return;

        var offsetDaAbaAtiva = (previewAtivoIdPane && offsetsLinhaJSPorIdPane.hasOwnProperty(previewAtivoIdPane))
          ? offsetsLinhaJSPorIdPane[previewAtivoIdPane]
          : offsetLinhaJSNoPreview;

        filaErrosExecucao.push({
          linha: e.data.linha,
          coluna: e.data.coluna,
          mensagem: String(e.data.mensagem || 'Erro desconhecido'),
          __offset: offsetDaAbaAtiva
        });

        if (!timeoutErrosExecucao) {
          timeoutErrosExecucao = setTimeout(processarFilaErrosExecucao, 200);
        }
      });

      function atualizarJanela() {
        if (!IDE_ABERTO && typeof fecharExplorer === 'function' && explorerPanel && !explorerPanel.hidden) fecharExplorer();
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
        atualizarBotaoPreviewToggle();
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
        atualizarBotaoPreviewToggle();
        removerTodosOsIframesDePreview();
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
            var eraDoProjeto = false;
            var indice = arquivosExtras.findIndex(function (arquivo) { return arquivo.idPane === idPane; });
            if (indice >= 0) {
              var arquivoFechado = arquivosExtras[indice];
              eraDoProjeto = arquivoFechado.origem === 'projeto';
              // Fechar a aba de um arquivo do projeto NÃO apaga o arquivo: o
              // modelo do projeto já tem o conteúdo mais recente.
              if (eraDoProjeto) sincronizarArquivoDoProjeto(arquivoFechado);
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
            if (!eraDoProjeto) agendarSalvamentoAutomatico();
            if (typeof atualizarPainelDeProblemas === 'function') atualizarPainelDeProblemas();
          });
        }
      }

      function sincronizarArquivosPrincipais() {
        var principal = function (linguagens) {
          return arquivosExtras.filter(ehArquivoDeExercicio).find(function (arquivo) { return linguagens.indexOf(arquivo.linguagem) >= 0; });
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
        var origemDoNome = arguments[1] || 'exercicio';
        var existe = function (candidato) {
          if (origemDoNome === 'projeto') {
            return Object.keys(projeto.arquivos).some(function (caminho) { return caminho.toLowerCase() === candidato.toLowerCase(); });
          }
          return arquivosExtras.filter(ehArquivoDeExercicio).some(function (arquivo) { return arquivo.nome.toLowerCase() === candidato.toLowerCase(); });
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
        arquivosExtras.filter(ehArquivoDeExercicio).forEach(function (arquivo) {
          referencias = referencias.concat(referenciasLocaisDoArquivo(arquivo));
        });
        referencias.filter(function (nome, indice) { return referencias.indexOf(nome) === indice; }).forEach(function (nome) {
          var existe = arquivosExtras.filter(ehArquivoDeExercicio).some(function (arquivo) { return arquivo.nome.toLowerCase() === nome.toLowerCase(); });
          var linguagem = linguagemDoArquivo(nome);
          if (!existe && linguagem) criarArquivoExtra(linguagem, nome, '');
        });
      }

      // ==================================================================
      // Barra de ferramentas por arquivo: fica dentro do painel de cada
      // arquivo aberto (como a barra de ferramentas sob uma aba de
      // navegador) e age SOMENTE sobre aquele arquivo. Os botões gerais
      // (recolher, tela cheia, atalhos, preferências, adicionar arquivo)
      // continuam na barra do topo.
      // ==================================================================
      // ----------------------------------------------------------------
      // Favicon por linguagem: fundo colorido + glifo simples, no mesmo
      // espírito de temas de ícone de editor (fácil de reconhecer em ~18px,
      // sem tentar reproduzir a logomarca oficial traço a traço).
      // ----------------------------------------------------------------
      function svgFavicon(corDeFundo, corDoTexto, texto, tamanhoFonte) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="' + corDeFundo + '"/>' +
          '<text x="12" y="16" font-size="' + (tamanhoFonte || 9) + '" font-weight="700" text-anchor="middle" fill="' + corDoTexto + '" font-family="Arial,Helvetica,sans-serif">' + texto + '</text></svg>';
      }
      // (ICONES_DE_LINGUAGEM foi movida para antes da restauração dos arquivos
      // salvos — ver comentário lá.)

      // Menu de ferramentas atualmente aberto (só um por vez, de qualquer
      // arquivo) — fechado por clique fora ou Esc. Registrado uma única
      // vez (fora de montarBarraDoArquivo, que roda por arquivo).
      var menuDeFerramentasAberto = null;
      function fecharMenuDeFerramentas() {
        if (!menuDeFerramentasAberto) return;
        if (menuDeFerramentasAberto.__botaoTrigger) menuDeFerramentasAberto.__botaoTrigger.setAttribute('aria-expanded', 'false');
        if (menuDeFerramentasAberto.__descartavel) menuDeFerramentasAberto.remove();
        else menuDeFerramentasAberto.hidden = true;
        menuDeFerramentasAberto = null;
      }
      // Menu de contexto genérico de uso único (árvore do Explorer): cria,
      // posiciona perto do botão-gatilho e remove ao fechar, reaproveitando
      // o mesmo mecanismo de fechar-por-clique-fora/Esc acima.
      function abrirMenuGenerico(botaoTrigger, itens, ponto) {
        fecharMenuDeFerramentas();
        var menu = document.createElement('div');
        menu.className = 'file-tools-menu';
        menu.setAttribute('role', 'menu');
        itens.forEach(function (definicao) {
          if (definicao.separador) {
            var separador = document.createElement('div');
            separador.className = 'file-tool-menu-sep';
            separador.setAttribute('role', 'separator');
            menu.appendChild(separador);
            return;
          }
          var item = document.createElement('button');
          item.type = 'button';
          item.className = 'file-tool-menu-item';
          item.setAttribute('role', 'menuitem');
          item.disabled = !!definicao.desabilitado;
          item.innerHTML = (definicao.svg ? definicao.svg.replace('<svg ', '<svg class="icone-arquivo" ') : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + definicao.icone + '"/></svg>') + '<span></span>' + (definicao.atalho ? '<kbd class="file-tool-menu-shortcut"></kbd>' : '');
          item.querySelector('span').textContent = definicao.label;
          if (definicao.atalho) item.querySelector('kbd').textContent = definicao.atalho;
          item.addEventListener('click', function () {
            fecharMenuDeFerramentas();
            definicao.acao();
          });
          menu.appendChild(item);
        });
        // Dentro da janela do IDE (e não do body), para continuar visível em tela cheia.
        mainWindowContainer.appendChild(menu);
        var x, y;
        if (ponto) { x = ponto.x; y = ponto.y; }
        else { var retangulo = botaoTrigger.getBoundingClientRect(); x = retangulo.left; y = retangulo.bottom + 4; }
        menu.style.top = Math.max(4, Math.min(y, window.innerHeight - menu.offsetHeight - 4)) + 'px';
        menu.style.left = Math.max(4, Math.min(x, window.innerWidth - menu.offsetWidth - 4)) + 'px';
        if (botaoTrigger) {
          botaoTrigger.setAttribute('aria-expanded', 'true');
          menu.__botaoTrigger = botaoTrigger;
        }
        menu.__descartavel = true;
        menuDeFerramentasAberto = menu;
        var primeiro = menu.querySelector('button:not(:disabled)');
        if (primeiro && !ponto) primeiro.focus();
      }
      document.addEventListener('pointerdown', function (event) {
        if (!menuDeFerramentasAberto) return;
        if (menuDeFerramentasAberto.contains(event.target)) return;
        if (menuDeFerramentasAberto.__botaoTrigger && menuDeFerramentasAberto.__botaoTrigger.contains(event.target)) return;
        fecharMenuDeFerramentas();
      });
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || !menuDeFerramentasAberto) return;
        var botao = menuDeFerramentasAberto.__botaoTrigger;
        fecharMenuDeFerramentas();
        if (botao) botao.focus();
      });

      // ==================================================================
      // Barra do arquivo: agora é uma aba de navegador de verdade —
      // favicon da linguagem (que também é o gatilho do dropdown de
      // ferramentas), nome do arquivo, toggle de preview e fechar. Tudo
      // que antes era uma fileira de ícones vira itens do dropdown.
      // ==================================================================
      function montarBarraDoArquivo(arquivo, aba) {
        // Tabela e ícones ficam aqui dentro (e não em var externa) porque
        // criarArquivoExtra já roda durante a inicialização, antes de
        // qualquer `var` declarado mais abaixo receber valor.
        var icones = {
          salvar: 'M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6',
          importar: 'M12 4v11 M8 11l4 4 4-4 M5 20h14',
          exportar: 'M12 15V4 M8 8l4-4 4 4 M5 20h14',
          desfazer: 'M9.5 7 4 12l5.5 5 M5 12h8a5 5 0 0 1 5 5v1',
          refazer: 'M14.5 7 20 12l-5.5 5 M19 12h-8a5 5 0 0 0-5 5v1',
          formatar: 'M4 6h16 M4 11h10 M4 16h16 M4 21h10',
          'buscar-arquivo': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16.5 16.5 21 21',
          comparar: 'M9 3v18 M15 3v18 M4 8h5 M4 12h5 M15 12h5 M15 16h5',
          minimap: 'M4 4h11v16H4z M18 4h2v6h-2z M18 12h2v3h-2z M18 17h2v3h-2z',
          painel: 'M12 3 2 20h20z M12 10v4 M12 17h.01',
          renomear: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
          duplicar: 'M9 9h11v11H9z M5 15V4h11',
          limpar: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6'
        };
        var grupos = [
          [['salvar', 'Salvar projeto (Ctrl+S)'], ['importar', 'Importar arquivo do computador'], ['exportar', 'Exportar este arquivo']],
          [['desfazer', 'Desfazer'], ['refazer', 'Refazer'], ['formatar', 'Formatar código (Shift+Alt+F)'], ['buscar-arquivo', 'Buscar neste arquivo (Ctrl+F)'], ['comparar', 'Comparar com outro arquivo'], ['minimap', 'Mostrar/ocultar minimapa']],
          [['painel', 'Problemas, console e busca no projeto']],
          [['renomear', 'Renomear arquivo'], ['duplicar', 'Duplicar arquivo'], ['limpar', 'Limpar conteúdo do arquivo']]
        ];

        var barra = document.createElement('div');
        barra.className = 'file-toolbar';

        // ---- Cabeçalho: favicon + nome + preview + fechar ----
        var cabecalho = document.createElement('div');
        cabecalho.className = 'file-toolbar-tab';

        var botaoFavicon = document.createElement('button');
        botaoFavicon.type = 'button';
        botaoFavicon.className = 'file-favicon-btn';
        botaoFavicon.setAttribute('aria-haspopup', 'menu');
        botaoFavicon.setAttribute('aria-expanded', 'false');
        botaoFavicon.title = 'Ferramentas de ' + arquivo.nome;
        botaoFavicon.setAttribute('aria-label', 'Ferramentas de ' + arquivo.nome);
        botaoFavicon.innerHTML = iconeDeArquivo(arquivo.nome, arquivo.linguagem);
        cabecalho.appendChild(botaoFavicon);

        var nomeSpan = document.createElement('span');
        nomeSpan.className = 'file-toolbar-name';
        nomeSpan.setAttribute('data-origem', arquivo.origem || 'exercicio');
        nomeSpan.textContent = arquivo.nome;
        cabecalho.appendChild(nomeSpan);
        arquivo.spanNomeNaBarra = nomeSpan;

        var espacador = document.createElement('span');
        espacador.className = 'file-toolbar-spacer';
        cabecalho.appendChild(espacador);

        var botaoPreview = document.createElement('button');
        botaoPreview.type = 'button';
        botaoPreview.className = 'file-preview-toggle';
        botaoPreview.title = 'Mostrar/ocultar preview';
        botaoPreview.setAttribute('aria-label', 'Mostrar/ocultar preview');
        var previewAtivo = !!(chkTogglePreview && chkTogglePreview.checked);
        botaoPreview.setAttribute('aria-pressed', previewAtivo ? 'true' : 'false');
        botaoPreview.classList.toggle('is-active', previewAtivo);
        botaoPreview.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
        botaoPreview.addEventListener('click', function () {
          chkTogglePreview.checked = !chkTogglePreview.checked;
          chkTogglePreview.dispatchEvent(new Event('change'));
        });
        cabecalho.appendChild(botaoPreview);
        arquivo.botaoPreviewToggle = botaoPreview;

        var botaoFechar = document.createElement('button');
        botaoFechar.type = 'button';
        botaoFechar.className = 'file-toolbar-close-btn';
        botaoFechar.title = 'Fechar arquivo';
        botaoFechar.setAttribute('aria-label', 'Fechar arquivo');
        botaoFechar.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
        botaoFechar.addEventListener('click', function () { executarAcaoDaBarra(arquivo, aba, 'fechar'); });
        cabecalho.appendChild(botaoFechar);

        barra.appendChild(cabecalho);

        // ---- Dropdown de ferramentas (aberto pelo favicon) ----
        var menu = document.createElement('div');
        menu.className = 'file-tools-menu';
        menu.hidden = true;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Ferramentas de ' + arquivo.nome);

        grupos.forEach(function (grupo, indice) {
          if (indice > 0) {
            var separador = document.createElement('div');
            separador.className = 'file-tool-menu-sep';
            separador.setAttribute('aria-hidden', 'true');
            menu.appendChild(separador);
          }
          grupo.forEach(function (definicao) {
            var acao = definicao[0];
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'file-tool-menu-item';
            item.setAttribute('data-acao', acao);
            item.setAttribute('role', 'menuitem');
            // Conteúdo 100% estático (sem dado do usuário): innerHTML é seguro aqui.
            item.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + icones[acao] + '"/></svg><span>' + definicao[1] + '</span>';
            if (acao === 'painel') item.insertAdjacentHTML('beforeend', '<span class="file-tool-count" hidden>0</span>');
            if (acao === 'desfazer' || acao === 'refazer') item.disabled = true;
            if (acao === 'minimap') {
              // Não dá pra confiar em atualizarBotaoMinimap() aqui: usa
              // document.querySelectorAll, e este item ainda não foi
              // inserido no documento (só depois que a função retornar).
              var minimapAtivo = !!preferenciasDoEditor.minimap;
              item.setAttribute('aria-checked', minimapAtivo ? 'true' : 'false');
              item.classList.toggle('is-active', minimapAtivo);
            }
            menu.appendChild(item);
          });
        });

        barra.appendChild(menu);

        arquivo.botaoDesfazer = menu.querySelector('[data-acao="desfazer"]');
        arquivo.botaoRefazer = menu.querySelector('[data-acao="refazer"]');
        arquivo.contadorProblemas = menu.querySelector('.file-tool-count');
        arquivo.botaoFavicon = botaoFavicon;
        arquivo.menuDeFerramentas = menu;

        menu.addEventListener('click', function (event) {
          var item = event.target.closest('button[data-acao]');
          if (!item || item.disabled) return;
          fecharMenuDeFerramentas();
          executarAcaoDaBarra(arquivo, aba, item.getAttribute('data-acao'));
        });

        botaoFavicon.addEventListener('click', function (event) {
          event.stopPropagation();
          if (menuDeFerramentasAberto === menu) { fecharMenuDeFerramentas(); return; }
          fecharMenuDeFerramentas();
          var retangulo = botaoFavicon.getBoundingClientRect();
          menu.style.top = (retangulo.bottom + 4) + 'px';
          menu.style.left = retangulo.left + 'px';
          menu.hidden = false;
          botaoFavicon.setAttribute('aria-expanded', 'true');
          menu.__botaoTrigger = botaoFavicon;
          menuDeFerramentasAberto = menu;
        });

        atualizarControlesHistorico();
        return barra;
      }

      function executarAcaoDaBarra(arquivo, aba, acao) {
        var editor = arquivo.editor;
        switch (acao) {
          case 'salvar': salvarManualmente(); break;
          case 'importar': inputImportFile.click(); break;
          case 'exportar': abrirExportacaoDoArquivo(arquivo); break;
          case 'desfazer': editor.undo(); editor.focus(); atualizarControlesHistorico(); break;
          case 'refazer': editor.redo(); editor.focus(); atualizarControlesHistorico(); break;
          case 'formatar': editor.focus(); editor.executarComando('editor.action.formatDocument'); break;
          case 'buscar-arquivo': editor.focus(); editor.executarComando('actions.find'); break;
          case 'comparar': abrirComparacaoDeArquivos(arquivo); break;
          case 'minimap': alternarMinimap(); break;
          case 'painel': abrirPainelInferior('problemas'); break;
          case 'renomear': if (arquivo.origem === 'projeto') renomearNoProjeto(arquivo.nome, false); else renomearArquivo(arquivo, aba); break;
          case 'duplicar': if (arquivo.origem === 'projeto') duplicarNoProjeto(arquivo.nome, false); else duplicarArquivo(arquivo); break;
          case 'limpar': limparArquivo(arquivo); break;
          case 'fechar': aba.querySelector('.file-close-btn').click(); break;
        }
      }

      function salvarManualmente() {
        salvarRascunhoAtual().then(function (salvou) {
          mostrarToast(salvou ? 'Projeto salvo.' : 'Não foi possível salvar agora.');
        });
      }

      function limparArquivo(arquivo) {
        confirmarAcao('Todo o conteúdo de "' + arquivo.nome + '" será removido.', { titulo: 'Limpar arquivo', confirmar: 'Limpar', destrutiva: true }).then(function (confirmado) {
          if (!confirmado) return;
          arquivo.editor.setValue('', -1);
          arquivo.editor.focus();
          mostrarToast(arquivo.nome + ' foi limpo.');
        });
      }

      function renomearArquivo(arquivo, aba) {
        // Simplificação deliberada: só o nome de exibição muda. A URI do
        // model no Monaco permanece a mesma, então imports/referências
        // cruzadas continuam resolvendo pelo caminho antigo — aceitável
        // para o escopo desta melhoria (ver avaliacao-monaco-ide.md, item 15).
        solicitarTexto('Informe o novo nome do arquivo.', arquivo.nome, { titulo: 'Renomear arquivo', confirmar: 'Renomear' }).then(function (novoNome) {
          if (!novoNome || novoNome.trim() === arquivo.nome) return;
          novoNome = nomeUnicoDoArquivo(novoNome.trim());
          arquivo.nome = novoNome;
          var textoDaAba = aba.querySelector('.tab-text');
          if (textoDaAba) textoDaAba.textContent = novoNome;
          aba.setAttribute('aria-label', novoNome);
          aba.setAttribute('title', novoNome);
          if (arquivo.spanNomeNaBarra) arquivo.spanNomeNaBarra.textContent = novoNome;
          if (arquivo.botaoFavicon) {
            arquivo.botaoFavicon.title = 'Ferramentas de ' + novoNome;
            arquivo.botaoFavicon.innerHTML = iconeDeArquivo(novoNome, arquivo.linguagem);
            arquivo.botaoFavicon.setAttribute('aria-label', 'Ferramentas de ' + novoNome);
          }
          if (arquivo.menuDeFerramentas) arquivo.menuDeFerramentas.setAttribute('aria-label', 'Ferramentas de ' + novoNome);
          sincronizarDependenciasLocais();
          agendarSalvamentoAutomatico();
          agendarAtualizacaoPreview();
          mostrarToast('Arquivo renomeado para ' + novoNome + '.');
        });
      }

      function duplicarArquivo(arquivo) {
        criarArquivoExtra(arquivo.linguagem, nomeUnicoDoArquivo(arquivo.nome), arquivo.editor.getValue());
        mostrarToast('Arquivo duplicado.');
      }

      // ==================================================================
      // Explorer do projeto (item 6). Pastas são virtuais por padrão — só
      // existem como prefixo de caminho em arquivo.nome (ex.:
      // "componentes/Header.jsx") mais um registro à parte para pastas
      // vazias (pastasVirtuais). Opcionalmente, o usuário pode vincular
      // uma pasta real do computador (File System Access API) para
      // espelhar os arquivos nela — reaproveitando o mesmo padrão já usado
      // pelo backup manual em pasta local, mas com armazenamento próprio,
      // sem interferir com ele.
      // ==================================================================
      var pastaSelecionadaNoExplorer = '';
      var pastasAbertasNoExplorer = {};
      var pastaRealHandle = null;
      var explorerPanel = document.getElementById('explorer-panel');
      var explorerTree = document.getElementById('explorer-tree');
      var explorerStatus = document.getElementById('explorer-status');
      var explorerVincularPasta = document.getElementById('explorer-abrir-pasta');
      var btnExplorerToggle = document.getElementById('btn-explorer-toggle');

      function caminhoCompletoNoExplorer(pastaBase, nome) {
        return pastaBase ? (pastaBase + '/' + nome) : nome;
      }

      function construirArvoreDoProjeto() {
        var raiz = { pastas: {}, arquivos: [] };
        function obterNo(caminhoDaPasta) {
          if (!caminhoDaPasta) return raiz;
          var partes = caminhoDaPasta.split('/');
          var no = raiz;
          var acumulado = '';
          partes.forEach(function (parte) {
            acumulado = acumulado ? acumulado + '/' + parte : parte;
            if (!no.pastas[parte]) no.pastas[parte] = { pastas: {}, arquivos: [], caminho: acumulado };
            no = no.pastas[parte];
          });
          return no;
        }
        Object.keys(projeto.pastas).forEach(function (caminho) { obterNo(caminho); });
        Object.keys(projeto.arquivos).forEach(function (caminho) {
          var partes = caminho.split('/');
          var nomeExibido = partes.pop();
          obterNo(partes.join('/')).arquivos.push({ caminho: caminho, linguagem: projeto.arquivos[caminho].linguagem, nomeExibido: nomeExibido });
        });
        return raiz;
      }

      var ICONE_PASTA_EXPLORER = '<svg class="explorer-node-folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z"/></svg>';
      var ICONE_CARET_EXPLORER = '<svg class="explorer-node-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
      var ICONE_MENU_PONTOS_EXPLORER = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';

      function preencherListaDeNosDoExplorer(lista, no) {
        Object.keys(no.pastas).sort().forEach(function (nomeDaPasta) {
          lista.appendChild(renderizarPastaDoExplorer(no.pastas[nomeDaPasta], nomeDaPasta));
        });
        no.arquivos.sort(function (a, b) { return a.nomeExibido.localeCompare(b.nomeExibido); }).forEach(function (item) {
          lista.appendChild(renderizarArquivoDoExplorer(item));
        });
      }

      function renderizarPastaDoExplorer(no, nomeDoNo) {
        var li = document.createElement('li');
        li.className = 'explorer-node ' + (pastasAbertasNoExplorer[no.caminho] ? 'is-aberto' : 'is-fechado');
        li.setAttribute('data-pasta', no.caminho);

        var linha = document.createElement('div');
        linha.className = 'explorer-node-row' + (pastaSelecionadaNoExplorer === no.caminho ? ' is-active' : '');
        linha.tabIndex = 0;
        linha.innerHTML = ICONE_CARET_EXPLORER + ICONE_PASTA_EXPLORER + '<span class="explorer-node-name"></span>';
        linha.querySelector('.explorer-node-name').textContent = nomeDoNo;
        var botaoMenu = document.createElement('button');
        botaoMenu.type = 'button';
        botaoMenu.className = 'explorer-icon-btn explorer-node-menu-btn';
        botaoMenu.title = 'Mais ações';
        botaoMenu.setAttribute('aria-label', 'Mais ações para a pasta ' + nomeDoNo);
        botaoMenu.innerHTML = ICONE_MENU_PONTOS_EXPLORER;
        linha.appendChild(botaoMenu);
        li.appendChild(linha);

        var filhos = document.createElement('ul');
        filhos.className = 'explorer-children';
        preencherListaDeNosDoExplorer(filhos, no);
        li.appendChild(filhos);
        return li;
      }

      // ---- Operações sobre o projeto (modelo em `projeto`, não em abas) ----
      var itemSelecionadoNoExplorer = null; // { caminho, ehPasta }
      var areaDeTransferenciaDoProjeto = null; // { modo: 'copiar'|'recortar', caminho, ehPasta }
      var ICONES_MENU = {
        abrir: 'M5 4h9l5 5v11H5z M14 4v5h5',
        novoArquivo: 'M12 5v14M5 12h14',
        novaPasta: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z M12 11v5M9.5 13.5h5',
        recortar: 'M6 7a2 2 0 1 0 .01 0 M6 17a2 2 0 1 0 .01 0 M8 8l12 10 M8 16 20 6',
        copiar: 'M9 9h11v11H9z M5 15V4h11',
        colar: 'M9 4h6v3H9z M7 5H5v15h14V5h-2 M9 12h6 M9 16h6',
        caminho: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
        renomear: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
        baixar: 'M12 4v11 M8 11l4 4 4-4 M5 20h14',
        excluir: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13'
      };

      function nomeBaseDoCaminho(caminho) { return String(caminho).split('/').pop(); }
      function pastaPaiDoCaminho(caminho) { var partes = String(caminho).split('/'); partes.pop(); return partes.join('/'); }

      function garantirPastasPai(caminho) {
        var partes = pastaPaiDoCaminho(caminho).split('/').filter(Boolean);
        var acumulado = '';
        partes.forEach(function (parte) {
          acumulado = acumulado ? acumulado + '/' + parte : parte;
          projeto.pastas[acumulado] = true;
        });
      }

      // Nomes que não podem virar chave do modelo do projeto (um arquivo chamado
      // "__proto__" alteraria o protótipo do objeto em vez de criar uma entrada).
      function caminhoSeguroNoProjeto(caminho) {
        return String(caminho).split('/').every(function (parte) { return parte && parte !== '__proto__' && parte !== '.' && parte !== '..'; });
      }

      function caminhoExisteNoProjeto(caminho) {
        var minusculo = caminho.toLowerCase();
        return Object.keys(projeto.arquivos).concat(Object.keys(projeto.pastas)).some(function (c) { return c.toLowerCase() === minusculo; });
      }

      function caminhoUnicoNoProjeto(caminho) {
        if (!caminhoExisteNoProjeto(caminho)) return caminho;
        var partes = caminho.match(/^(.*?)(\.[^./]+)?$/);
        var base = partes && partes[1] ? partes[1] : caminho;
        var extensao = partes && partes[2] ? partes[2] : '';
        var n = 2;
        while (caminhoExisteNoProjeto(base + '-' + n + extensao)) n++;
        return base + '-' + n + extensao;
      }

      function arquivoAbertoDoProjeto(caminho) {
        return arquivosExtras.filter(function (a) { return a.origem === 'projeto' && a.nome === caminho; })[0] || null;
      }

      function conteudoAtualDoArquivoDoProjeto(caminho) {
        var aberto = arquivoAbertoDoProjeto(caminho);
        if (aberto) return aberto.editor.getValue();
        return projeto.arquivos[caminho] ? projeto.arquivos[caminho].conteudo : '';
      }

      function sincronizarArquivoDoProjeto(arquivo) {
        if (!projeto.arquivos[arquivo.nome]) return;
        projeto.arquivos[arquivo.nome].conteudo = arquivo.editor.getValue();
        projetoAgendarPersistencia();
      }

      function fecharAbaDoProjeto(caminho) {
        var aberto = arquivoAbertoDoProjeto(caminho);
        if (!aberto) return;
        var aba = dragContainer.querySelector('.code-tab[data-target="' + aberto.idPane + '"]');
        var botao = aba && aba.querySelector('.file-close-btn');
        if (botao) botao.click();
      }

      function aplicarNovoNomeNaAba(arquivo, novoNome) {
        var aba = dragContainer.querySelector('.code-tab[data-target="' + arquivo.idPane + '"]');
        arquivo.nome = novoNome;
        if (aba) {
          var textoDaAba = aba.querySelector('.tab-text');
          if (textoDaAba) textoDaAba.textContent = novoNome;
          aba.setAttribute('aria-label', novoNome);
          aba.setAttribute('title', novoNome);
        }
        if (arquivo.spanNomeNaBarra) arquivo.spanNomeNaBarra.textContent = novoNome;
        if (arquivo.botaoFavicon) {
          arquivo.botaoFavicon.title = 'Ferramentas de ' + novoNome;
          arquivo.botaoFavicon.innerHTML = iconeDeArquivo(novoNome, arquivo.linguagem);
          arquivo.botaoFavicon.setAttribute('aria-label', 'Ferramentas de ' + novoNome);
        }
      }

      function criarArquivoDoProjeto(linguagem, caminho, conteudo, abrir) {
        caminho = String(caminho || '').replace(/\\/g, '/').replace(/^\/+/, '');
        if (!caminho) return null;
        if (!caminhoSeguroNoProjeto(caminho)) { mostrarToast('Nome de arquivo não permitido.'); return null; }
        caminho = caminhoUnicoNoProjeto(caminho);
        garantirPastasPai(caminho);
        projeto.arquivos[caminho] = { linguagem: linguagem || linguagemDoArquivo(caminho) || 'plaintext', conteudo: conteudo || '' };
        projetoAgendarPersistencia();
        if (abrir) abrirArquivoDoProjeto(caminho); else renderizarExplorer();
        return caminho;
      }

      function abrirArquivoDoProjeto(caminho) {
        var dados = projeto.arquivos[caminho];
        if (!dados) return;
        var aberto = arquivoAbertoDoProjeto(caminho);
        if (aberto) { ativarArquivoNoExplorer(aberto); return; }
        abrirJanela();
        criarArquivoExtra(dados.linguagem, caminho, dados.conteudo, { origem: 'projeto', exato: true });
        renderizarExplorer();
      }

      // Lista o que um caminho engloba (ele mesmo, ou a pasta com tudo dentro).
      function itensDoCaminho(origem, ehPasta) {
        if (!ehPasta) return { arquivos: [origem], pastas: [] };
        var prefixo = origem + '/';
        return {
          arquivos: Object.keys(projeto.arquivos).filter(function (c) { return c.indexOf(prefixo) === 0; }),
          pastas: [origem].concat(Object.keys(projeto.pastas).filter(function (c) { return c.indexOf(prefixo) === 0; }))
        };
      }

      function reescreverPrefixo(caminho, origem, destino) {
        return caminho === origem ? destino : destino + caminho.slice(origem.length);
      }

      function moverNoProjeto(origem, destino, ehPasta) {
        if (origem === destino) return true;
        if (ehPasta && (destino + '/').indexOf(origem + '/') === 0) { mostrarToast('Não é possível mover uma pasta para dentro dela mesma.'); return false; }
        if (caminhoExisteNoProjeto(destino) && destino.toLowerCase() !== origem.toLowerCase()) { mostrarToast('Já existe um item chamado "' + nomeBaseDoCaminho(destino) + '" nesse local.'); return false; }
        var itens = itensDoCaminho(origem, ehPasta);
        // Se a extensão muda a linguagem de um arquivo aberto, fecha a aba antes.
        itens.arquivos.forEach(function (c) {
          var nova = reescreverPrefixo(c, origem, destino);
          var linguagemNova = linguagemDoArquivo(nova);
          if (linguagemNova && linguagemNova !== projeto.arquivos[c].linguagem) fecharAbaDoProjeto(c);
        });
        var novosArquivos = {};
        Object.keys(projeto.arquivos).forEach(function (c) {
          if (itens.arquivos.indexOf(c) === -1) { novosArquivos[c] = projeto.arquivos[c]; return; }
          var nova = reescreverPrefixo(c, origem, destino);
          var dados = projeto.arquivos[c];
          dados.conteudo = conteudoAtualDoArquivoDoProjeto(c);
          if (linguagemDoArquivo(nova)) dados.linguagem = linguagemDoArquivo(nova);
          novosArquivos[nova] = dados;
          var aberto = arquivoAbertoDoProjeto(c);
          if (aberto) aplicarNovoNomeNaAba(aberto, nova);
        });
        projeto.arquivos = novosArquivos;
        itens.pastas.forEach(function (c) {
          delete projeto.pastas[c];
          pastasAbertasNoExplorer[reescreverPrefixo(c, origem, destino)] = pastasAbertasNoExplorer[c];
          delete pastasAbertasNoExplorer[c];
        });
        itens.pastas.forEach(function (c) { projeto.pastas[reescreverPrefixo(c, origem, destino)] = true; });
        garantirPastasPai(destino);
        if (itemSelecionadoNoExplorer && itemSelecionadoNoExplorer.caminho === origem) itemSelecionadoNoExplorer.caminho = destino;
        if (pastaSelecionadaNoExplorer === origem) pastaSelecionadaNoExplorer = destino;
        projetoAgendarPersistencia();
        agendarAtualizacaoPreview();
        renderizarExplorer();
        return true;
      }

      function copiarNoProjeto(origem, destino, ehPasta) {
        var itens = itensDoCaminho(origem, ehPasta);
        itens.arquivos.forEach(function (c) {
          var dados = projeto.arquivos[c];
          projeto.arquivos[reescreverPrefixo(c, origem, destino)] = { linguagem: dados.linguagem, conteudo: conteudoAtualDoArquivoDoProjeto(c) };
        });
        itens.pastas.forEach(function (c) { projeto.pastas[reescreverPrefixo(c, origem, destino)] = true; });
        garantirPastasPai(destino);
        projetoAgendarPersistencia();
        renderizarExplorer();
      }

      function renomearNoProjeto(caminho, ehPasta) {
        solicitarTexto('Informe o novo nome.', nomeBaseDoCaminho(caminho), { titulo: ehPasta ? 'Renomear pasta' : 'Renomear arquivo', confirmar: 'Renomear' }).then(function (novoNome) {
          if (novoNome === null) return;
          novoNome = novoNome.trim().replace(/[\\/]+/g, '-');
          if (!novoNome || novoNome === nomeBaseDoCaminho(caminho)) return;
          var pai = pastaPaiDoCaminho(caminho);
          moverNoProjeto(caminho, caminhoCompletoNoExplorer(pai, novoNome), ehPasta);
        });
      }

      function duplicarNoProjeto(caminho, ehPasta) {
        var destino = caminhoUnicoNoProjeto(caminho);
        if (destino === caminho) return;
        copiarNoProjeto(caminho, destino, ehPasta);
        mostrarToast('Duplicado como ' + nomeBaseDoCaminho(destino) + '.');
      }

      function excluirNoProjeto(caminho, ehPasta) {
        var itens = itensDoCaminho(caminho, ehPasta);
        var texto = ehPasta
          ? 'Excluir a pasta "' + caminho + '" e os ' + itens.arquivos.length + ' arquivo(s) dentro dela? Isso não pode ser desfeito.'
          : 'Excluir "' + caminho + '"? Isso não pode ser desfeito.';
        confirmarAcao(texto, { titulo: ehPasta ? 'Excluir pasta' : 'Excluir arquivo', confirmar: 'Excluir', destrutiva: true }).then(function (confirmado) {
          if (!confirmado) return;
          itens.arquivos.forEach(function (c) { fecharAbaDoProjeto(c); delete projeto.arquivos[c]; });
          itens.pastas.forEach(function (c) { delete projeto.pastas[c]; delete pastasAbertasNoExplorer[c]; });
          if (itemSelecionadoNoExplorer && itemSelecionadoNoExplorer.caminho === caminho) itemSelecionadoNoExplorer = null;
          if (pastaSelecionadaNoExplorer === caminho || pastaSelecionadaNoExplorer.indexOf(caminho + '/') === 0) pastaSelecionadaNoExplorer = '';
          projetoAgendarPersistencia();
          agendarAtualizacaoPreview();
          renderizarExplorer();
        });
      }

      function colarNoProjeto(pastaDestino) {
        var area = areaDeTransferenciaDoProjeto;
        if (!area) return;
        if (area.ehPasta && (pastaDestino + '/').indexOf(area.caminho + '/') === 0) { mostrarToast('Não é possível colar uma pasta dentro dela mesma.'); return; }
        var base = nomeBaseDoCaminho(area.caminho);
        var destino = caminhoCompletoNoExplorer(pastaDestino, base);
        if (area.modo === 'copiar') {
          copiarNoProjeto(area.caminho, caminhoUnicoNoProjeto(destino), area.ehPasta);
        } else if (moverNoProjeto(area.caminho, destino, area.ehPasta)) {
          areaDeTransferenciaDoProjeto = null;
        }
        if (pastaDestino) pastasAbertasNoExplorer[pastaDestino] = true;
        renderizarExplorer();
      }

      function pastaDeDestinoParaColar(item) {
        if (!item) return pastaSelecionadaNoExplorer || '';
        return item.ehPasta ? item.caminho : pastaPaiDoCaminho(item.caminho);
      }

      function copiarTextoParaAreaDeTransferencia(texto) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(texto).then(function () { mostrarToast('Caminho copiado.'); }, function () { mostrarToast('Não foi possível copiar.'); });
        }
      }

      var baixarItemDoProjeto = function (caminho, ehPasta) {
        if (!ehPasta) { baixarArquivo(conteudoAtualDoArquivoDoProjeto(caminho), nomeBaseDoCaminho(caminho)); return; }
        mostrarToast('Baixar pasta inteira como .zip chega na próxima etapa (use "Exportar projeto").');
      }

      function itensDoMenuDoExplorer(item) {
        var ehPasta = !!(item && item.ehPasta);
        var caminho = item ? item.caminho : '';
        var pastaAlvo = pastaDeDestinoParaColar(item);
        var colarAtivo = !!areaDeTransferenciaDoProjeto;
        var colar = { label: 'Colar', icone: ICONES_MENU.colar, atalho: 'Ctrl+V', desabilitado: !colarAtivo, acao: function () { colarNoProjeto(pastaAlvo); } };
        if (!item) {
          return [
            { label: 'Novo arquivo', icone: ICONES_MENU.novoArquivo, acao: function () { criarArquivoNoExplorer(''); } },
            { label: 'Nova pasta', icone: ICONES_MENU.novaPasta, acao: function () { criarPastaNoExplorer(''); } },
            { separador: true },
            colar
          ];
        }
        var lista = [];
        if (ehPasta) {
          lista.push({ label: 'Novo arquivo', icone: ICONES_MENU.novoArquivo, acao: function () { criarArquivoNoExplorer(caminho); } });
          lista.push({ label: 'Nova pasta', icone: ICONES_MENU.novaPasta, acao: function () { criarPastaNoExplorer(caminho); } });
        } else {
          lista.push({ label: 'Abrir', icone: ICONES_MENU.abrir, atalho: 'Enter', acao: function () { abrirArquivoDoProjeto(caminho); } });
        }
        lista.push({ separador: true });
        lista.push({ label: 'Recortar', icone: ICONES_MENU.recortar, atalho: 'Ctrl+X', acao: function () { areaDeTransferenciaDoProjeto = { modo: 'recortar', caminho: caminho, ehPasta: ehPasta }; } });
        lista.push({ label: 'Copiar', icone: ICONES_MENU.copiar, atalho: 'Ctrl+C', acao: function () { areaDeTransferenciaDoProjeto = { modo: 'copiar', caminho: caminho, ehPasta: ehPasta }; } });
        lista.push(colar);
        lista.push({ separador: true });
        lista.push({ label: 'Copiar caminho', icone: ICONES_MENU.caminho, acao: function () { copiarTextoParaAreaDeTransferencia(caminho); } });
        lista.push({ label: 'Duplicar', icone: ICONES_MENU.copiar, acao: function () { duplicarNoProjeto(caminho, ehPasta); } });
        lista.push({ label: 'Renomear…', icone: ICONES_MENU.renomear, atalho: 'F2', acao: function () { renomearNoProjeto(caminho, ehPasta); } });
        lista.push({ label: ehPasta ? 'Baixar pasta' : 'Baixar', icone: ICONES_MENU.baixar, acao: function () { baixarItemDoProjeto(caminho, ehPasta); } });
        lista.push({ separador: true });
        lista.push({ label: 'Excluir', icone: ICONES_MENU.excluir, atalho: 'Del', acao: function () { excluirNoProjeto(caminho, ehPasta); } });
        return lista;
      }

      function renderizarArquivoDoExplorer(item) {
        var li = document.createElement('li');
        li.className = 'explorer-node';
        var aberto = arquivoAbertoDoProjeto(item.caminho);
        var aba = aberto && document.querySelector('.code-tab[data-target="' + aberto.idPane + '"]');
        var checkbox = aba && aba.querySelector('.editor-toggle-checkbox');
        var ativo = !!(checkbox && checkbox.checked);
        var selecionado = itemSelecionadoNoExplorer && !itemSelecionadoNoExplorer.ehPasta && itemSelecionadoNoExplorer.caminho === item.caminho;
        var linha = document.createElement('div');
        linha.className = 'explorer-node-row' + (ativo ? ' is-active' : '') + (selecionado ? ' is-selecionado' : '');
        linha.tabIndex = 0;
        linha.setAttribute('data-caminho', item.caminho);
        linha.draggable = true;
        var favicon = iconeDeArquivo(item.caminho, item.linguagem).replace('<svg ', '<svg class="explorer-node-favicon" ');
        linha.innerHTML = '<span class="explorer-node-caret" aria-hidden="true" style="visibility:hidden">' + ICONE_CARET_EXPLORER + '</span>' + favicon + '<span class="explorer-node-name"></span>';
        linha.querySelector('.explorer-node-name').textContent = item.nomeExibido;
        var botaoMenu = document.createElement('button');
        botaoMenu.type = 'button';
        botaoMenu.className = 'explorer-icon-btn explorer-node-menu-btn';
        botaoMenu.title = 'Mais ações';
        botaoMenu.setAttribute('aria-label', 'Mais ações para ' + item.nomeExibido);
        botaoMenu.innerHTML = ICONE_MENU_PONTOS_EXPLORER;
        linha.appendChild(botaoMenu);
        li.appendChild(linha);
        return li;
      }

      // Devolve o foco à linha do Explorer (teclado: F2, Del, Ctrl+C/X/V).
      function focarLinhaDoExplorer(item) {
        if (!explorerTree || !item) return;
        var linhas = explorerTree.querySelectorAll('.explorer-node-row');
        for (var i = 0; i < linhas.length; i++) {
          var linha = linhas[i];
          var pasta = linha.parentNode && linha.parentNode.getAttribute && linha.parentNode.getAttribute('data-pasta');
          var combina = item.ehPasta ? pasta === item.caminho : linha.getAttribute('data-caminho') === item.caminho;
          if (combina) { linha.focus(); return; }
        }
      }

      function renderizarExplorer() {
        if (!explorerTree) return;
        var itemComFoco = (document.activeElement && explorerTree.contains(document.activeElement)) ? itemDoElementoNoExplorer(document.activeElement) : null;
        var raiz = construirArvoreDoProjeto();
        explorerTree.innerHTML = '';
        if (!Object.keys(raiz.pastas).length && !raiz.arquivos.length) {
          var vazio = document.createElement('p');
          vazio.className = 'explorer-empty';
          vazio.textContent = 'Projeto vazio. Crie um arquivo ou pasta, ou importe um projeto do computador.';
          explorerTree.appendChild(vazio);
          return;
        }
        preencherListaDeNosDoExplorer(explorerTree, raiz);
        if (itemComFoco) focarLinhaDoExplorer(itemComFoco);
      }

      function criarPastaNoExplorer(pastaBase) {
        solicitarTexto('Informe o nome da nova pasta.', '', { titulo: 'Nova pasta', confirmar: 'Criar pasta' }).then(function (nome) {
          if (!nome) return;
          nome = nome.trim().replace(/[\\/]+/g, '-');
          if (!nome) return;
          var caminho = caminhoUnicoNoProjeto(caminhoCompletoNoExplorer(pastaBase != null ? pastaBase : pastaSelecionadaNoExplorer, nome));
          projeto.pastas[caminho] = true;
          garantirPastasPai(caminho);
          pastasAbertasNoExplorer[caminho] = true;
          pastaSelecionadaNoExplorer = caminho;
          projetoAgendarPersistencia();
          renderizarExplorer();
        });
      }

      // Dropdown padrão (mesmo dos menus do Explorer) para escolher o tipo do
      // novo arquivo. Usado pelo botão do Explorer e pelo botão "+" da barra.
      var TIPOS_DE_NOVO_ARQUIVO = [
        { rotulo: 'HTML', ext: 'html', linguagem: 'html', sugerido: 'pagina.html' },
        { rotulo: 'CSS', ext: 'css', linguagem: 'css', sugerido: 'estilo.css' },
        { rotulo: 'JavaScript', ext: 'js', linguagem: 'javascript', sugerido: 'script.js' },
        { rotulo: 'SCSS', ext: 'scss', linguagem: 'scss', sugerido: 'estilo.scss' },
        { rotulo: 'TypeScript', ext: 'ts', linguagem: 'typescript', sugerido: 'app.ts' },
        { rotulo: 'React', ext: 'jsx', linguagem: 'javascriptreact', sugerido: 'App.jsx' },
        { rotulo: 'Markdown', ext: 'md', linguagem: 'markdown', sugerido: 'README.md' },
        { rotulo: 'SVG', ext: 'svg', linguagem: 'svg', sugerido: 'imagem.svg' },
        { rotulo: 'JSON', ext: 'json', linguagem: 'json', sugerido: 'dados.json' },
        { rotulo: 'XML', ext: 'xml', linguagem: 'xml', sugerido: 'dados.xml' }
      ];
      function abrirDropdownNovoArquivo(botao, pastaBase) {
        if (menuDeFerramentasAberto && menuDeFerramentasAberto.__botaoTrigger === botao) { fecharMenuDeFerramentas(); return; }
        var itens = TIPOS_DE_NOVO_ARQUIVO.map(function (tipo) {
          return {
            label: tipo.rotulo,
            svg: iconeDeArquivo(tipo.sugerido, tipo.linguagem),
            atalho: '.' + tipo.ext,
            acao: function () {
              var pasta = pastaBase || '';
              solicitarTexto('Informe o nome do novo arquivo (.' + tipo.ext + ').', tipo.sugerido, { titulo: 'Novo arquivo ' + tipo.rotulo, confirmar: 'Criar arquivo' }).then(function (nome) {
                if (nome === null) return;
                nome = nome.trim() || tipo.sugerido;
                if (/[<>:"|?*\u0000-\u001f]/.test(nome)) { mostrarToast('O nome contém caracteres inválidos ( < > : " | ? * ).'); return; }
                if (!/\.[A-Za-z0-9]+$/.test(nome)) nome += '.' + tipo.ext;
                if (pasta) pastasAbertasNoExplorer[pasta] = true;
                criarArquivoDoProjeto(tipo.linguagem, caminhoCompletoNoExplorer(pasta, nome), '', true);
              });
            }
          };
        });
        itens.push({ separador: true });
        itens.push({ label: 'Importar arquivo do computador…', icone: ICONES_MENU.importar || 'M12 4v11 M8 11l4 4 4-4 M5 20h14', acao: function () { if (inputImportFile) inputImportFile.click(); } });
        abrirMenuGenerico(botao, itens);
      }

      function criarArquivoNoExplorer(pastaBase) {
        var pasta = pastaBase != null ? pastaBase : pastaSelecionadaNoExplorer;
        solicitarTexto('Informe o nome do novo arquivo, com extensão.', 'arquivo.js', { titulo: 'Novo arquivo', confirmar: 'Criar arquivo' }).then(function (nome) {
          if (!nome) return;
          nome = nome.trim();
          if (!nome) return;
          var linguagem = linguagemDoArquivo(nome) || 'plaintext';
          if (pasta) pastasAbertasNoExplorer[pasta] = true;
          criarArquivoDoProjeto(linguagem, caminhoCompletoNoExplorer(pasta, nome), '', true);
        });
      }

      function ativarArquivoNoExplorer(arquivo) {
        var aba = document.querySelector('.code-tab[data-target="' + arquivo.idPane + '"]');
        var checkbox = aba && aba.querySelector('.editor-toggle-checkbox');
        if (checkbox && !checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change'));
        }
        arquivo.editor.focus();
        renderizarExplorer();
      }

      function itemDoElementoNoExplorer(alvo) {
        var linhaArquivo = alvo.closest && alvo.closest('.explorer-node-row[data-caminho]');
        if (linhaArquivo) return { caminho: linhaArquivo.getAttribute('data-caminho'), ehPasta: false };
        var liPasta = alvo.closest && alvo.closest('.explorer-node[data-pasta]');
        if (liPasta) return { caminho: liPasta.getAttribute('data-pasta'), ehPasta: true };
        return null;
      }

      if (explorerTree) {
        explorerTree.addEventListener('click', function (event) {
          var item = itemDoElementoNoExplorer(event.target);
          var botaoMenu = event.target.closest('.explorer-node-menu-btn');
          if (botaoMenu && item) {
            event.stopPropagation();
            itemSelecionadoNoExplorer = item;
            abrirMenuGenerico(botaoMenu, itensDoMenuDoExplorer(item));
            return;
          }
          if (!item) return;
          itemSelecionadoNoExplorer = item;
          if (!item.ehPasta) {
            abrirArquivoDoProjeto(item.caminho);
            // Como no VS Code: um clique abre o arquivo mas mantém o foco na
            // árvore (para F2/Del/Ctrl+C/V). Enter ou duplo clique levam ao editor.
            setTimeout(function () { focarLinhaDoExplorer(item); }, 0);
            return;
          }
          var liDaPasta = event.target.closest('.explorer-node[data-pasta]');
          if (event.target.closest('.explorer-node-row') === liDaPasta.querySelector(':scope > .explorer-node-row')) {
            pastaSelecionadaNoExplorer = item.caminho;
            pastasAbertasNoExplorer[item.caminho] = !pastasAbertasNoExplorer[item.caminho];
            renderizarExplorer();
          }
        });

        explorerTree.addEventListener('dblclick', function (event) {
          var item = itemDoElementoNoExplorer(event.target);
          if (!item || item.ehPasta) return;
          var aberto = arquivoAbertoDoProjeto(item.caminho);
          if (aberto) ativarArquivoNoExplorer(aberto);
        });

        // Botão direito = menu de contexto (como no VS Code), inclusive no
        // espaço vazio da árvore (novo arquivo/pasta, colar).
        explorerTree.addEventListener('contextmenu', function (event) {
          event.preventDefault();
          var item = itemDoElementoNoExplorer(event.target);
          if (item) {
            itemSelecionadoNoExplorer = item;
            if (item.ehPasta) pastaSelecionadaNoExplorer = item.caminho;
          }
          abrirMenuGenerico(null, itensDoMenuDoExplorer(item), { x: event.clientX, y: event.clientY });
        });
        var painelDoExplorer = document.getElementById('explorer-panel');
        if (painelDoExplorer) {
          painelDoExplorer.addEventListener('contextmenu', function (event) {
            if (event.target.closest('#explorer-tree')) return;
            if (event.target.closest('.explorer-header')) return;
            event.preventDefault();
            abrirMenuGenerico(null, itensDoMenuDoExplorer(null), { x: event.clientX, y: event.clientY });
          });
        }

        // Atalhos de teclado do Explorer.
        explorerTree.addEventListener('keydown', function (event) {
          var item = itemDoElementoNoExplorer(event.target);
          if (!item) return;
          var ctrl = event.ctrlKey || event.metaKey;
          if (event.key === 'Enter') { event.preventDefault(); if (item.ehPasta) { pastasAbertasNoExplorer[item.caminho] = !pastasAbertasNoExplorer[item.caminho]; renderizarExplorer(); } else { abrirArquivoDoProjeto(item.caminho); var abertoPorEnter = arquivoAbertoDoProjeto(item.caminho); if (abertoPorEnter) abertoPorEnter.editor.focus(); } }
          else if (event.key === 'F2') { event.preventDefault(); renomearNoProjeto(item.caminho, item.ehPasta); }
          else if (event.key === 'Delete') { event.preventDefault(); excluirNoProjeto(item.caminho, item.ehPasta); }
          else if (ctrl && event.key.toLowerCase() === 'c') { event.preventDefault(); areaDeTransferenciaDoProjeto = { modo: 'copiar', caminho: item.caminho, ehPasta: item.ehPasta }; }
          else if (ctrl && event.key.toLowerCase() === 'x') { event.preventDefault(); areaDeTransferenciaDoProjeto = { modo: 'recortar', caminho: item.caminho, ehPasta: item.ehPasta }; }
          else if (ctrl && event.key.toLowerCase() === 'v') { event.preventDefault(); colarNoProjeto(pastaDeDestinoParaColar(item)); }
        });
      }

      // ---- Criar/importar a partir do cabeçalho do Explorer --------------
      var explorerNovaPasta = document.getElementById('explorer-nova-pasta');
      var explorerNovoArquivo = document.getElementById('explorer-novo-arquivo');
      var explorerImportarProjeto = document.getElementById('explorer-importar-projeto');
      var explorerInputImportar = document.getElementById('explorer-input-importar');

      if (explorerNovaPasta) explorerNovaPasta.addEventListener('click', function () { criarPastaNoExplorer(pastaSelecionadaNoExplorer); });
      if (explorerNovoArquivo) explorerNovoArquivo.addEventListener('click', function (evento) { evento.stopPropagation(); abrirDropdownNovoArquivo(explorerNovoArquivo, pastaSelecionadaNoExplorer); });
      if (explorerImportarProjeto && explorerInputImportar) {
        explorerImportarProjeto.addEventListener('click', function () { explorerInputImportar.click(); });
        explorerInputImportar.addEventListener('change', function () {
          importarProjetoDoComputadorNoExplorer(explorerInputImportar.files);
          explorerInputImportar.value = '';
        });
      }

      // Importar NÃO abre nenhum arquivo: só coloca no projeto. O aluno abre
      // manualmente, clicando no arquivo no Explorer.
      var PASTAS_IGNORADAS_NA_IMPORTACAO = ['node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', 'dist', 'build'];
      function importarProjetoDoComputadorNoExplorer(fileList) {
        if (!fileList || !fileList.length) return;
        var todos = Array.prototype.slice.call(fileList);
        var ignoradosPorPasta = 0;
        var candidatos = todos.filter(function (file) {
          var partes = String(file.webkitRelativePath || file.name).replace(/\\/g, '/').split('/');
          if (partes.length > 1) partes.shift();
          var emPastaIgnorada = partes.slice(0, -1).some(function (p) { return PASTAS_IGNORADAS_NA_IMPORTACAO.indexOf(p) >= 0; });
          if (emPastaIgnorada) { ignoradosPorPasta++; return false; }
          return linguagemDoArquivo(file.name) !== null;
        });
        if (!candidatos.length) {
          mostrarToast('Nenhum arquivo reconhecido nessa pasta (html, css, js, ts, scss, jsx, md, svg, json, xml).');
          return;
        }
        Promise.all(candidatos.map(function (file) {
          return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function () { resolve({ file: file, texto: String(reader.result || '') }); };
            reader.onerror = function () { resolve(null); };
            reader.readAsText(file);
          });
        })).then(function (lidos) {
          var importados = 0;
          lidos.forEach(function (lido) {
            if (!lido) return;
            var partes = String(lido.file.webkitRelativePath || lido.file.name).replace(/\\/g, '/').split('/');
            if (partes.length > 1) partes.shift(); // remove o nome da pasta raiz escolhida
            if (!caminhoSeguroNoProjeto(partes.join('/') || lido.file.name)) return;
            var caminho = caminhoUnicoNoProjeto(partes.join('/') || lido.file.name);
            garantirPastasPai(caminho);
            projeto.arquivos[caminho] = { linguagem: linguagemDoArquivo(lido.file.name), conteudo: lido.texto };
            importados++;
          });
          projetoAgendarPersistencia();
          renderizarExplorer();
          mostrarToast(importados + ' arquivo(s) importado(s) para o projeto. Clique em um arquivo para abri-lo.');
        });
      }

      // =====================================================================
      // BARRA DO EXPLORER — exportar, abrir pasta, nuvem, backup, pesquisa,
      // arrastar e soltar, abrir por nome (Ctrl+P), nome do projeto.
      // =====================================================================
      ICONES_MENU.pesquisar = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5';
      ICONES_MENU.substituir = 'M4 7h12l-3-3 M20 17H8l3 3';
      ICONES_MENU.nuvem = 'M6 19h12a4 4 0 0 0 .7-7.94A7 7 0 0 0 5.08 9.5 4.5 4.5 0 0 0 6 19Z M12 10v7m0-7-3 3m3-3 3 3';
      ICONES_MENU.engrenagem = 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z';
      ICONES_MENU.restaurar = 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5';

      function nomeDeArquivoSeguro(nome) {
        return String(nome || 'projeto').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'projeto';
      }

      function baixarBlob(blob, nomeDoArquivo) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = nomeDoArquivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }

      // ---- Nome do projeto -------------------------------------------------
      function atualizarNomeDoProjetoNoExplorer() {
        var botao = document.getElementById('explorer-nome-projeto');
        if (!botao) return;
        botao.textContent = projeto.nome;
        botao.title = 'Projeto "' + projeto.nome + '" — clique para renomear';
      }
      var explorerNomeProjeto = document.getElementById('explorer-nome-projeto');
      if (explorerNomeProjeto) explorerNomeProjeto.addEventListener('click', function () {
        solicitarTexto('Informe o nome do projeto.', projeto.nome, { titulo: 'Renomear projeto', confirmar: 'Salvar nome' }).then(function (novo) {
          if (novo === null) return;
          novo = novo.trim().slice(0, 100);
          if (!novo) return;
          projeto.nome = novo;
          atualizarNomeDoProjetoNoExplorer();
          projetoAgendarPersistencia();
        });
      });

      // ---- ZIP (sem compressão — "store" — sem dependências) ---------------
      var TABELA_CRC32 = null;
      function crc32(bytes) {
        if (!TABELA_CRC32) {
          TABELA_CRC32 = new Uint32Array(256);
          for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            TABELA_CRC32[n] = c >>> 0;
          }
        }
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) crc = TABELA_CRC32[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
      }

      // entradas: [{ nome, dados: Uint8Array, pasta?: true }]. Nomes em UTF-8.
      function gerarZip(entradas) {
        var codificador = new TextEncoder();
        var partes = [];
        var central = [];
        var deslocamento = 0;
        var agora = new Date();
        var hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
        var data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
        entradas.forEach(function (entrada) {
          var nome = codificador.encode(entrada.nome);
          var dados = entrada.dados;
          var crc = crc32(dados);
          var local = new DataView(new ArrayBuffer(30));
          local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
          local.setUint16(8, 0, true); local.setUint16(10, hora, true); local.setUint16(12, data, true);
          local.setUint32(14, crc, true); local.setUint32(18, dados.length, true); local.setUint32(22, dados.length, true);
          local.setUint16(26, nome.length, true); local.setUint16(28, 0, true);
          partes.push(new Uint8Array(local.buffer), nome, dados);
          var dir = new DataView(new ArrayBuffer(46));
          dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true); dir.setUint16(8, 0x0800, true);
          dir.setUint16(10, 0, true); dir.setUint16(12, hora, true); dir.setUint16(14, data, true);
          dir.setUint32(16, crc, true); dir.setUint32(20, dados.length, true); dir.setUint32(24, dados.length, true);
          dir.setUint16(28, nome.length, true); dir.setUint16(30, 0, true); dir.setUint16(32, 0, true);
          dir.setUint16(34, 0, true); dir.setUint16(36, 0, true); dir.setUint32(38, entrada.pasta ? 0x10 : 0, true);
          dir.setUint32(42, deslocamento, true);
          central.push(new Uint8Array(dir.buffer), nome);
          deslocamento += 30 + nome.length + dados.length;
        });
        var tamanhoCentral = central.reduce(function (soma, parte) { return soma + parte.length; }, 0);
        var fim = new DataView(new ArrayBuffer(22));
        fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, entradas.length, true); fim.setUint16(10, entradas.length, true);
        fim.setUint32(12, tamanhoCentral, true); fim.setUint32(16, deslocamento, true);
        return new Blob(partes.concat(central, [new Uint8Array(fim.buffer)]), { type: 'application/zip' });
      }

      function entradasDeZipDoProjeto(prefixo) {
        var codificador = new TextEncoder();
        var dados = projetoDados();
        var corte = prefixo ? prefixo.length + 1 : 0;
        var entradas = [];
        dados.pastas.slice().sort().forEach(function (pasta) {
          if (prefixo && pasta.indexOf(prefixo + '/') !== 0) return;
          entradas.push({ nome: pasta.slice(corte) + '/', dados: new Uint8Array(0), pasta: true });
        });
        Object.keys(dados.arquivos).sort().forEach(function (caminho) {
          if (prefixo && caminho.indexOf(prefixo + '/') !== 0) return;
          entradas.push({ nome: caminho.slice(corte), dados: codificador.encode(dados.arquivos[caminho].conteudo) });
        });
        return entradas;
      }

      function exportarProjetoZip() {
        var entradas = entradasDeZipDoProjeto('');
        if (!entradas.length) { mostrarToast('O projeto está vazio — não há o que exportar.'); return; }
        baixarBlob(gerarZip(entradas), nomeDeArquivoSeguro(projeto.nome) + '.zip');
        mostrarToast('Projeto exportado como ' + nomeDeArquivoSeguro(projeto.nome) + '.zip.');
      }
      window.exportarProjetoZipDaIde = exportarProjetoZip;

      // "Baixar" no menu de uma pasta: .zip só dessa pasta.
      baixarItemDoProjeto = function (caminho, ehPasta) {
        if (!ehPasta) { baixarArquivo(conteudoAtualDoArquivoDoProjeto(caminho), nomeBaseDoCaminho(caminho)); return; }
        var entradas = entradasDeZipDoProjeto(caminho);
        if (!entradas.length) { mostrarToast('A pasta está vazia.'); return; }
        baixarBlob(gerarZip(entradas), nomeDeArquivoSeguro(nomeBaseDoCaminho(caminho)) + '.zip');
      };

      var explorerExportar = document.getElementById('explorer-exportar');
      if (explorerExportar) explorerExportar.addEventListener('click', exportarProjetoZip);

      // ---- Abrir pasta do computador (lê para dentro do projeto) -----------
      var LIMITE_ARQUIVOS_DA_PASTA = 2000;
      var LIMITE_BYTES_DA_PASTA = 8 * 1024 * 1024;
      async function lerPastaReal(pasta, prefixo, acumulado) {
        for await (var entrada of pasta.entries()) {
          var nome = entrada[0], handle = entrada[1];
          var caminho = prefixo ? prefixo + '/' + nome : nome;
          if (!caminhoSeguroNoProjeto(caminho)) { acumulado.ignorados++; continue; }
          if (handle.kind === 'directory') {
            if (PASTAS_IGNORADAS_NA_IMPORTACAO.indexOf(nome) >= 0) { acumulado.ignorados++; continue; }
            acumulado.pastas.push(caminho);
            await lerPastaReal(handle, caminho, acumulado);
          } else {
            var linguagem = linguagemDoArquivo(nome);
            if (!linguagem) { acumulado.ignorados++; continue; }
            var arquivo = await handle.getFile();
            if (arquivo.size > 1024 * 1024) { acumulado.ignorados++; continue; }
            acumulado.total += arquivo.size;
            if (Object.keys(acumulado.arquivos).length >= LIMITE_ARQUIVOS_DA_PASTA || acumulado.total > LIMITE_BYTES_DA_PASTA) { acumulado.estourou = true; return; }
            acumulado.arquivos[caminho] = { linguagem: linguagem, conteudo: await arquivo.text() };
          }
          if (acumulado.estourou) return;
        }
      }

      function desvincularPastaReal() {
        pastaRealHandle = null;
        atualizarStatusDeVinculoNoExplorer('');
        abrirBancoDoExplorer().then(function (db) {
          var tx = db.transaction('pastas', 'readwrite');
          tx.objectStore('pastas').delete(chaveDaPastaVinculada());
        }).catch(function () { /* sem banco: nada a limpar */ });
      }

      async function abrirPastaDoComputadorNoExplorer() {
        if (!window.showDirectoryPicker) {
          mostrarToast('Este navegador não abre pastas com gravação (use Chrome ou Edge). Importando uma cópia da pasta no lugar.');
          if (explorerInputImportar) explorerInputImportar.click();
          return;
        }
        var pasta;
        try { pasta = await window.showDirectoryPicker({ id: 'coding-loop-explorer', mode: 'readwrite' }); }
        catch (erro) { if (erro && erro.name !== 'AbortError') mostrarToast('Não foi possível abrir a pasta.'); return; }
        if ((projetoTemArquivos() || Object.keys(projeto.pastas).length) &&
          !await confirmarAcao('Abrir "' + pasta.name + '" substituirá o projeto atual neste navegador. Uma cópia do projeto atual ficará guardada nas versões locais.', { titulo: 'Abrir pasta', confirmar: 'Abrir', destrutiva: true })) return;
        mostrarToast('Lendo a pasta…');
        var lidos = { arquivos: {}, pastas: [], ignorados: 0, total: 0, estourou: false };
        try { await lerPastaReal(pasta, '', lidos); }
        catch (erro) { mostrarToast('Não foi possível ler a pasta.'); return; }
        if (lidos.estourou) { mostrarToast('A pasta é grande demais (limite de ' + LIMITE_ARQUIVOS_DA_PASTA + ' arquivos ou 8 MB de texto). Abra uma subpasta.'); return; }
        if (!Object.keys(lidos.arquivos).length) { mostrarToast('Nenhum arquivo de texto reconhecido nessa pasta.'); return; }
        await projetoGuardarVersaoLocal(true);
        pastaRealHandle = null; // evita espelhar o projeto antigo na pasta nova durante a troca
        await projetoAplicar({ nome: pasta.name, pastas: lidos.pastas, arquivos: lidos.arquivos });
        pastaRealHandle = pasta;
        // Guardar o vínculo é só para reabrir sem escolher de novo; se falhar, a
        // pasta continua aberta nesta sessão.
        try { await salvarHandleDaPastaReal(pasta); } catch (erro) { /* sem persistência do vínculo */ }
        atualizarStatusDeVinculoNoExplorer(pasta.name);
        mostrarToast('Pasta "' + pasta.name + '" aberta: ' + Object.keys(lidos.arquivos).length + ' arquivo(s). Ao editar, os arquivos são gravados nela.');
      }
      if (explorerVincularPasta) explorerVincularPasta.addEventListener('click', abrirPastaDoComputadorNoExplorer);

      // ---- Nuvem e backup do projeto ---------------------------------------
      function abrirConfiguracaoDeBackup() {
        var botao = document.getElementById('btn-backup-settings');
        if (botao) botao.click(); else mostrarToast('A configuração de backup não está disponível agora.');
      }

      async function salvarProjetoNaNuvem() {
        if (!projetoTemArquivos()) { mostrarToast('O projeto está vazio — nada para enviar.'); return; }
        var nuvem = window.nuvemDoProjeto;
        var settings = CL.api.getBackupSettings();
        var destinos = settings.destinations || [];
        var drive = destinos.indexOf('drive') >= 0 && settings.googleDriveConnected;
        var onedrive = destinos.indexOf('onedrive') >= 0 && settings.oneDriveConnected;
        if (!nuvem || (!drive && !onedrive)) {
          mostrarToast('Conecte o Google Drive ou o OneDrive em "Configurar backup" para salvar na nuvem.');
          abrirConfiguracaoDeBackup();
          return;
        }
        await projetoPersistir();
        var dados = projetoDados();
        var nomes = [];
        var tarefas = [];
        if (drive) { nomes.push('Google Drive'); tarefas.push(nuvem.enviarDrive(dados, true)); }
        if (onedrive) { nomes.push('OneDrive'); tarefas.push(nuvem.enviarOneDrive(dados, true)); }
        mostrarToast('Enviando o projeto…');
        var resultados = await Promise.allSettled(tarefas);
        var falhas = [];
        var sucessos = [];
        resultados.forEach(function (resultado, indice) { (resultado.status === 'fulfilled' ? sucessos : falhas).push(nomes[indice]); });
        if (!falhas.length) CL.api.saveBackupSettings({ projectCloudPending: false });
        mostrarToast(sucessos.length ? ('Projeto salvo em: ' + sucessos.join(', ') + '.' + (falhas.length ? ' Falhou em: ' + falhas.join(', ') + '.' : '')) : ('Não foi possível salvar o projeto (' + falhas.join(', ') + ').'));
      }
      var explorerNuvem = document.getElementById('explorer-nuvem');
      if (explorerNuvem) explorerNuvem.addEventListener('click', salvarProjetoNaNuvem);

      function baixarBackupDoProjetoJson() {
        if (!projetoTemArquivos()) { mostrarToast('O projeto está vazio — nada para salvar.'); return; }
        var dados = projetoDados();
        baixarBlob(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }), nomeDeArquivoSeguro(projeto.nome) + '-backup-projeto.json');
        CL.api.saveBackupSettings({ lastProjectBackupDownloadAt: dados.exportedAt });
        mostrarToast('Backup do projeto baixado (.json).');
      }

      async function restaurarProjetoDe(origem) {
        var dados;
        try {
          if (origem === 'local') {
            var versoes = await window.versoesLocaisDoProjeto();
            if (!versoes.length) throw new Error('Ainda não há cópia local do projeto.');
            dados = CL.api.parseProjectBackup(JSON.stringify(versoes[0]));
          } else if (origem === 'arquivo') {
            dados = await escolherArquivoDeBackupDoProjeto();
            if (!dados) return;
          } else if (origem === 'drive') { dados = await window.nuvemDoProjeto.restaurarDrive();
          } else if (origem === 'onedrive') { dados = await window.nuvemDoProjeto.restaurarOneDrive();
          } else if (origem === 'aparelho') { dados = await window.nuvemDoProjeto.restaurarDoAparelho(); }
        } catch (erro) {
          mostrarToast((erro && erro.message) || 'Não foi possível ler o backup do projeto.');
          return;
        }
        var total = Object.keys(dados.arquivos).length;
        if (!await confirmarAcao('O projeto atual será substituído por "' + dados.nome + '" (' + total + ' arquivo(s)). Uma cópia dele ficará guardada nas versões locais.', { titulo: 'Restaurar projeto', confirmar: 'Restaurar', destrutiva: true })) return;
        await projetoGuardarVersaoLocal(true);
        if (pastaRealHandle) desvincularPastaReal(); // não sobrescreve a pasta do computador com outro projeto
        await projetoAplicar(dados);
        mostrarToast('Projeto restaurado: ' + total + ' arquivo(s).');
      }

      function escolherArquivoDeBackupDoProjeto() {
        return new Promise(function (resolve, reject) {
          var entrada = document.createElement('input');
          entrada.type = 'file';
          entrada.accept = '.json,application/json';
          entrada.addEventListener('change', function () {
            var arquivo = entrada.files && entrada.files[0];
            if (!arquivo) { resolve(null); return; }
            if (arquivo.size > CL.api.MAX_PROJECT_BACKUP_BYTES) { reject(new Error('Backup do projeto excede o limite de 8 MB.')); return; }
            var leitor = new FileReader();
            leitor.onload = function () { try { resolve(CL.api.parseProjectBackup(String(leitor.result || ''))); } catch (erro) { reject(erro); } };
            leitor.onerror = function () { reject(new Error('Não foi possível ler o arquivo.')); };
            leitor.readAsText(arquivo);
          });
          entrada.click();
        });
      }

      var explorerBackup = document.getElementById('explorer-backup');
      if (explorerBackup) explorerBackup.addEventListener('click', function (evento) {
        evento.stopPropagation();
        abrirMenuGenerico(explorerBackup, [
          { label: 'Configurar backup…', icone: ICONES_MENU.engrenagem, acao: abrirConfiguracaoDeBackup },
          { label: 'Baixar backup do projeto (.json)', icone: ICONES_MENU.baixar, acao: baixarBackupDoProjetoJson },
          { separador: true },
          { label: 'Restaurar da última cópia local', icone: ICONES_MENU.restaurar, acao: function () { restaurarProjetoDe('local'); } },
          { label: 'Restaurar de arquivo (.json)…', icone: ICONES_MENU.restaurar, acao: function () { restaurarProjetoDe('arquivo'); } },
          { label: 'Restaurar do Google Drive', icone: ICONES_MENU.nuvem, acao: function () { restaurarProjetoDe('drive'); } },
          { label: 'Restaurar do OneDrive', icone: ICONES_MENU.nuvem, acao: function () { restaurarProjetoDe('onedrive'); } },
          { label: 'Restaurar da pasta do aparelho', icone: ICONES_MENU.restaurar, acao: function () { restaurarProjetoDe('aparelho'); } }
        ]);
      });

      // ---- Pesquisar e substituir no projeto -------------------------------
      var buscaPainel = document.getElementById('explorer-search');
      var buscaTermo = document.getElementById('explorer-busca-termo');
      var buscaSubstituto = document.getElementById('explorer-busca-substituto');
      var buscaLinhaSubstituir = document.getElementById('explorer-substituir-linha');
      var buscaResumo = document.getElementById('explorer-busca-resumo');
      var buscaResultados = document.getElementById('explorer-busca-resultados');
      var buscaBotaoCaso = document.getElementById('explorer-busca-caso');
      var buscaBotaoRegex = document.getElementById('explorer-busca-regex');
      var buscaTimer = null;
      var buscaUltima = { re: null, resultados: [], total: 0 };
      var LIMITE_LINHAS_DA_BUSCA = 1000;

      function modoDeSubstituicaoAtivo() { return !!(buscaPainel && buscaPainel.classList.contains('is-substituir')); }

      function criarRegexDaBusca(termo) {
        if (!termo) return { vazio: true };
        var usarRegex = buscaBotaoRegex.getAttribute('aria-pressed') === 'true';
        var diferenciar = buscaBotaoCaso.getAttribute('aria-pressed') === 'true';
        try {
          var re = new RegExp(usarRegex ? termo : termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g' + (diferenciar ? '' : 'i'));
          if (new RegExp('^(?:' + re.source + ')$', re.flags.replace('g', '')).test('')) return { erro: 'A expressão corresponde a texto vazio.' };
          return { re: re };
        } catch (erro) { return { erro: 'Expressão inválida: ' + erro.message }; }
      }

      function procurarNoProjeto(re) {
        var resultados = [];
        var total = 0;
        var linhasTotais = 0;
        Object.keys(projeto.arquivos).sort().forEach(function (caminho) {
          if (linhasTotais >= LIMITE_LINHAS_DA_BUSCA) return;
          var linhas = conteudoAtualDoArquivoDoProjeto(caminho).split('\n');
          var achadas = [];
          var ocorrenciasNoArquivo = 0;
          linhas.forEach(function (texto, indice) {
            re.lastIndex = 0;
            var primeira = re.exec(texto);
            if (!primeira) return;
            var ocorrencias = 1;
            while (re.exec(texto) !== null) ocorrencias++;
            ocorrenciasNoArquivo += ocorrencias;
            if (linhasTotais < LIMITE_LINHAS_DA_BUSCA) {
              achadas.push({ numero: indice, texto: texto, coluna: primeira.index, tamanho: primeira[0].length });
              linhasTotais++;
            }
          });
          if (ocorrenciasNoArquivo) { resultados.push({ caminho: caminho, linhas: achadas, ocorrencias: ocorrenciasNoArquivo }); total += ocorrenciasNoArquivo; }
        });
        return { resultados: resultados, total: total, truncado: linhasTotais >= LIMITE_LINHAS_DA_BUSCA };
      }

      function trechoComDestaque(linha) {
        var span = document.createElement('span');
        span.className = 'explorer-search-line-text';
        var inicio = Math.max(0, linha.coluna - 24);
        var antes = (inicio > 0 ? '…' : '') + linha.texto.slice(inicio, linha.coluna).replace(/^\s+/, '');
        var achado = linha.texto.slice(linha.coluna, linha.coluna + linha.tamanho);
        var depois = linha.texto.slice(linha.coluna + linha.tamanho, linha.coluna + linha.tamanho + 80);
        var marca = document.createElement('mark');
        marca.textContent = achado;
        span.appendChild(document.createTextNode(antes));
        span.appendChild(marca);
        span.appendChild(document.createTextNode(depois));
        return span;
      }

      function executarBuscaNoExplorer() {
        buscaResultados.innerHTML = '';
        buscaResumo.classList.remove('is-error');
        var criada = criarRegexDaBusca(buscaTermo.value);
        if (criada.vazio) { buscaResumo.textContent = ''; buscaUltima = { re: null, resultados: [], total: 0 }; return; }
        if (criada.erro) { buscaResumo.textContent = criada.erro; buscaResumo.classList.add('is-error'); buscaUltima = { re: null, resultados: [], total: 0 }; return; }
        var achado = procurarNoProjeto(criada.re);
        buscaUltima = { re: criada.re, resultados: achado.resultados, total: achado.total };
        buscaResumo.textContent = achado.total
          ? (achado.total + ' resultado(s) em ' + achado.resultados.length + ' arquivo(s)' + (achado.truncado ? ' (mostrando os primeiros ' + LIMITE_LINHAS_DA_BUSCA + ' trechos)' : ''))
          : 'Nenhum resultado.';
        achado.resultados.forEach(function (arquivo) {
          var cabecalho = document.createElement('li');
          cabecalho.className = 'explorer-search-file';
          cabecalho.setAttribute('data-caminho', arquivo.caminho);
          var nome = document.createElement('span');
          nome.textContent = arquivo.caminho;
          var contagem = document.createElement('span');
          contagem.className = 'explorer-search-count';
          contagem.textContent = String(arquivo.ocorrencias);
          cabecalho.appendChild(nome);
          cabecalho.appendChild(contagem);
          buscaResultados.appendChild(cabecalho);
          arquivo.linhas.forEach(function (linha) {
            var item = document.createElement('li');
            item.className = 'explorer-search-line';
            item.setAttribute('data-caminho', arquivo.caminho);
            item.setAttribute('data-linha', String(linha.numero));
            item.setAttribute('data-coluna', String(linha.coluna));
            item.appendChild(trechoComDestaque(linha));
            var substituirUm = document.createElement('button');
            substituirUm.type = 'button';
            substituirUm.className = 'explorer-search-replace-one';
            substituirUm.textContent = 'Substituir';
            substituirUm.title = 'Substituir nesta linha';
            item.appendChild(substituirUm);
            buscaResultados.appendChild(item);
          });
        });
      }

      function agendarBuscaNoExplorer() {
        clearTimeout(buscaTimer);
        buscaTimer = setTimeout(executarBuscaNoExplorer, 200);
      }

      function abrirPesquisaNoExplorer(modo) {
        if (explorerPanel.hidden) abrirExplorer();
        explorerPanel.classList.add('is-pesquisando');
        buscaPainel.hidden = false;
        buscaPainel.classList.toggle('is-substituir', modo === 'substituir');
        buscaLinhaSubstituir.hidden = modo !== 'substituir';
        buscaTermo.setAttribute('aria-label', modo === 'substituir' ? 'Pesquisar e substituir no projeto' : 'Pesquisar no projeto');
        buscaTermo.focus();
        buscaTermo.select();
        executarBuscaNoExplorer();
      }

      function fecharPesquisaNoExplorer() {
        if (!buscaPainel) return;
        buscaPainel.hidden = true;
        explorerPanel.classList.remove('is-pesquisando');
      }

      function textoDeSubstituicao() {
        var usarRegex = buscaBotaoRegex.getAttribute('aria-pressed') === 'true';
        return usarRegex ? buscaSubstituto.value : buscaSubstituto.value.replace(/\$/g, '$$$$');
      }

      function gravarConteudoNoArquivoDoProjeto(caminho, novoConteudo) {
        if (!projeto.arquivos[caminho]) return;
        projeto.arquivos[caminho].conteudo = novoConteudo;
        var aberto = arquivoAbertoDoProjeto(caminho);
        if (aberto && aberto.editor.getValue() !== novoConteudo) aberto.editor.setValue(novoConteudo);
      }

      function substituirTudoNoProjeto() {
        if (!buscaUltima.re || !buscaUltima.total) { mostrarToast('Nada para substituir.'); return; }
        confirmarAcao('Substituir ' + buscaUltima.total + ' ocorrência(s) em ' + buscaUltima.resultados.length + ' arquivo(s) do projeto?', { titulo: 'Substituir tudo', confirmar: 'Substituir', destrutiva: true }).then(function (confirmado) {
          if (!confirmado) return;
          var re = buscaUltima.re;
          var troca = textoDeSubstituicao();
          var arquivosAfetados = buscaUltima.resultados.map(function (r) { return r.caminho; });
          arquivosAfetados.forEach(function (caminho) {
            re.lastIndex = 0;
            gravarConteudoNoArquivoDoProjeto(caminho, conteudoAtualDoArquivoDoProjeto(caminho).replace(re, troca));
          });
          projetoAgendarPersistencia();
          agendarAtualizacaoPreview();
          mostrarToast(buscaUltima.total + ' ocorrência(s) substituída(s) em ' + arquivosAfetados.length + ' arquivo(s).');
          executarBuscaNoExplorer();
        });
      }

      function substituirNaLinha(caminho, numeroDaLinha) {
        var re = buscaUltima.re;
        if (!re) return;
        var linhas = conteudoAtualDoArquivoDoProjeto(caminho).split('\n');
        if (numeroDaLinha < 0 || numeroDaLinha >= linhas.length) return;
        re.lastIndex = 0;
        linhas[numeroDaLinha] = linhas[numeroDaLinha].replace(re, textoDeSubstituicao());
        gravarConteudoNoArquivoDoProjeto(caminho, linhas.join('\n'));
        projetoAgendarPersistencia();
        agendarAtualizacaoPreview();
        executarBuscaNoExplorer();
      }

      if (buscaPainel) {
        buscaTermo.addEventListener('input', agendarBuscaNoExplorer);
        buscaTermo.addEventListener('keydown', function (evento) {
          if (evento.key === 'Enter') { evento.preventDefault(); clearTimeout(buscaTimer); executarBuscaNoExplorer(); }
          else if (evento.key === 'Escape') { evento.preventDefault(); fecharPesquisaNoExplorer(); }
        });
        buscaSubstituto.addEventListener('keydown', function (evento) {
          if (evento.key === 'Enter') { evento.preventDefault(); substituirTudoNoProjeto(); }
          else if (evento.key === 'Escape') { evento.preventDefault(); fecharPesquisaNoExplorer(); }
        });
        [buscaBotaoCaso, buscaBotaoRegex].forEach(function (botao) {
          botao.addEventListener('click', function () {
            botao.setAttribute('aria-pressed', botao.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
            executarBuscaNoExplorer();
          });
        });
        document.getElementById('explorer-busca-fechar').addEventListener('click', fecharPesquisaNoExplorer);
        document.getElementById('explorer-substituir-tudo').addEventListener('click', substituirTudoNoProjeto);
        buscaResultados.addEventListener('click', function (evento) {
          var botaoUm = evento.target.closest('.explorer-search-replace-one');
          var item = evento.target.closest('li[data-caminho]');
          if (!item) return;
          var caminho = item.getAttribute('data-caminho');
          if (botaoUm) { evento.stopPropagation(); substituirNaLinha(caminho, Number(item.getAttribute('data-linha'))); return; }
          abrirArquivoDoProjeto(caminho);
          var linha = item.getAttribute('data-linha');
          var aberto = arquivoAbertoDoProjeto(caminho);
          if (aberto && linha !== null) irParaLocalizacaoNoArquivo(aberto, Number(linha), Number(item.getAttribute('data-coluna')) || 0);
        });
      }

      var explorerPesquisar = document.getElementById('explorer-pesquisar');
      if (explorerPesquisar) explorerPesquisar.addEventListener('click', function (evento) {
        evento.stopPropagation();
        abrirMenuGenerico(explorerPesquisar, [
          { label: 'Pesquisar no projeto', icone: ICONES_MENU.pesquisar, atalho: 'Ctrl+Shift+F', acao: function () { abrirPesquisaNoExplorer('buscar'); } },
          { label: 'Pesquisar e substituir no projeto', icone: ICONES_MENU.substituir, atalho: 'Ctrl+Shift+H', acao: function () { abrirPesquisaNoExplorer('substituir'); } }
        ]);
      });

      // ---- Arrastar e soltar na árvore (mover arquivos/pastas) -------------
      var itemSendoArrastado = null;
      function pastaAlvoDoDrop(alvo) {
        var linhaPasta = alvo.closest && alvo.closest('.explorer-node[data-pasta]');
        if (linhaPasta) return linhaPasta.getAttribute('data-pasta');
        var linhaArquivo = alvo.closest && alvo.closest('.explorer-node-row[data-caminho]');
        if (linhaArquivo) return pastaPaiDoCaminho(linhaArquivo.getAttribute('data-caminho'));
        return '';
      }
      function limparAlvosDeDrop() {
        explorerTree.classList.remove('is-drop-alvo');
        Array.prototype.forEach.call(explorerTree.querySelectorAll('.is-drop-alvo'), function (el) { el.classList.remove('is-drop-alvo'); });
      }
      function marcarPastasComoArrastaveis() {
        Array.prototype.forEach.call(explorerTree.querySelectorAll('.explorer-node[data-pasta] > .explorer-node-row'), function (linha) { linha.draggable = true; });
      }
      if (explorerTree) {
        explorerTree.addEventListener('dragstart', function (evento) {
          marcarPastasComoArrastaveis();
          var item = itemDoElementoNoExplorer(evento.target);
          if (!item) { evento.preventDefault(); return; }
          itemSendoArrastado = item;
          evento.dataTransfer.effectAllowed = 'move';
          evento.dataTransfer.setData('text/plain', item.caminho);
        });
        explorerTree.addEventListener('dragover', function (evento) {
          if (!itemSendoArrastado) return;
          evento.preventDefault();
          evento.dataTransfer.dropEffect = 'move';
          limparAlvosDeDrop();
          var linhaPasta = evento.target.closest && evento.target.closest('.explorer-node[data-pasta] > .explorer-node-row, .explorer-node[data-pasta]');
          var linha = evento.target.closest && evento.target.closest('.explorer-node[data-pasta]');
          if (linha) linha.querySelector(':scope > .explorer-node-row').classList.add('is-drop-alvo');
          else explorerTree.classList.add('is-drop-alvo');
        });
        explorerTree.addEventListener('dragleave', function (evento) { if (evento.target === explorerTree) limparAlvosDeDrop(); });
        explorerTree.addEventListener('dragend', function () { itemSendoArrastado = null; limparAlvosDeDrop(); });
        explorerTree.addEventListener('drop', function (evento) {
          if (!itemSendoArrastado) return;
          evento.preventDefault();
          var origem = itemSendoArrastado;
          itemSendoArrastado = null;
          limparAlvosDeDrop();
          var pastaDestino = pastaAlvoDoDrop(evento.target);
          var destino = caminhoCompletoNoExplorer(pastaDestino, nomeBaseDoCaminho(origem.caminho));
          if (destino === origem.caminho) return;
          if (moverNoProjeto(origem.caminho, destino, origem.ehPasta) && pastaDestino) { pastasAbertasNoExplorer[pastaDestino] = true; renderizarExplorer(); }
        });
      }

      // ---- Abrir arquivo por nome (Ctrl+P) ----------------------------------
      var quickOpen = document.createElement('div');
      quickOpen.className = 'quick-open';
      quickOpen.hidden = true;
      quickOpen.setAttribute('role', 'dialog');
      quickOpen.setAttribute('aria-label', 'Abrir arquivo do projeto');
      quickOpen.innerHTML = '<input type="text" autocomplete="off" spellcheck="false" placeholder="Abrir arquivo do projeto pelo nome…" aria-label="Nome do arquivo"><ul role="listbox"></ul>';
      mainWindowContainer.appendChild(quickOpen);
      var quickOpenEntrada = quickOpen.querySelector('input');
      var quickOpenLista = quickOpen.querySelector('ul');
      var quickOpenIndice = 0;
      var quickOpenItens = [];

      function pontuarNomeNaBusca(caminho, consulta) {
        var alvo = caminho.toLowerCase();
        var termo = consulta.toLowerCase();
        if (!termo) return 1;
        var base = nomeBaseDoCaminho(alvo);
        if (base.indexOf(termo) === 0) return 1000 - base.length;
        if (base.indexOf(termo) >= 0) return 800 - base.length;
        if (alvo.indexOf(termo) >= 0) return 600 - alvo.length;
        var posicao = 0, pontos = 0;
        for (var i = 0; i < termo.length; i++) {
          var achou = alvo.indexOf(termo[i], posicao);
          if (achou < 0) return 0;
          pontos += 10 - Math.min(9, achou - posicao);
          posicao = achou + 1;
        }
        return Math.max(1, pontos);
      }

      function renderizarQuickOpen() {
        var consulta = quickOpenEntrada.value.trim();
        quickOpenItens = Object.keys(projeto.arquivos)
          .map(function (c) { return { caminho: c, pontos: pontuarNomeNaBusca(c, consulta) }; })
          .filter(function (r) { return r.pontos > 0; })
          .sort(function (a, b) { return b.pontos - a.pontos || a.caminho.localeCompare(b.caminho); })
          .slice(0, 50);
        quickOpenIndice = Math.min(quickOpenIndice, Math.max(0, quickOpenItens.length - 1));
        quickOpenLista.innerHTML = '';
        if (!quickOpenItens.length) {
          var vazio = document.createElement('p');
          vazio.textContent = projetoTemArquivos() ? 'Nenhum arquivo com esse nome.' : 'O projeto ainda não tem arquivos.';
          quickOpenLista.appendChild(vazio);
          return;
        }
        quickOpenItens.forEach(function (item, indice) {
          var li = document.createElement('li');
          li.setAttribute('role', 'option');
          li.className = indice === quickOpenIndice ? 'is-ativo' : '';
          li.setAttribute('data-indice', String(indice));
          var nome = document.createElement('span');
          nome.textContent = nomeBaseDoCaminho(item.caminho);
          var pasta = document.createElement('small');
          pasta.textContent = pastaPaiDoCaminho(item.caminho);
          li.appendChild(nome);
          li.appendChild(pasta);
          quickOpenLista.appendChild(li);
        });
      }
      function abrirQuickOpen() {
        quickOpen.hidden = false;
        quickOpenEntrada.value = '';
        quickOpenIndice = 0;
        renderizarQuickOpen();
        quickOpenEntrada.focus();
      }
      function fecharQuickOpen() { quickOpen.hidden = true; }
      function confirmarQuickOpen() {
        var escolhido = quickOpenItens[quickOpenIndice];
        fecharQuickOpen();
        if (!escolhido) return;
        abrirArquivoDoProjeto(escolhido.caminho);
        var aberto = arquivoAbertoDoProjeto(escolhido.caminho);
        if (aberto) aberto.editor.focus();
      }
      quickOpenEntrada.addEventListener('input', function () { quickOpenIndice = 0; renderizarQuickOpen(); });
      quickOpenEntrada.addEventListener('keydown', function (evento) {
        if (evento.key === 'ArrowDown') { evento.preventDefault(); quickOpenIndice = Math.min(quickOpenItens.length - 1, quickOpenIndice + 1); renderizarQuickOpen(); }
        else if (evento.key === 'ArrowUp') { evento.preventDefault(); quickOpenIndice = Math.max(0, quickOpenIndice - 1); renderizarQuickOpen(); }
        else if (evento.key === 'Enter') { evento.preventDefault(); confirmarQuickOpen(); }
        else if (evento.key === 'Escape') { evento.preventDefault(); fecharQuickOpen(); }
      });
      quickOpenLista.addEventListener('click', function (evento) {
        var li = evento.target.closest('li[data-indice]');
        if (!li) return;
        quickOpenIndice = Number(li.getAttribute('data-indice'));
        confirmarQuickOpen();
      });
      document.addEventListener('pointerdown', function (evento) { if (!quickOpen.hidden && !quickOpen.contains(evento.target)) fecharQuickOpen(); });

      // Atalhos globais do IDE (só valem enquanto a janela do IDE está na tela).
      mainWindowContainer.addEventListener('keydown', function (evento) {
        var ctrl = evento.ctrlKey || evento.metaKey;
        if (!ctrl) return;
        var tecla = evento.key.toLowerCase();
        if (tecla === 'p' && !evento.shiftKey && !evento.altKey) { evento.preventDefault(); abrirQuickOpen(); }
        else if (tecla === 'f' && evento.shiftKey) { evento.preventDefault(); abrirPesquisaNoExplorer('buscar'); }
        else if (tecla === 'h' && evento.shiftKey) { evento.preventDefault(); abrirPesquisaNoExplorer('substituir'); }
      }, true);

      atualizarNomeDoProjetoNoExplorer();

      // ---- Vincular pasta real do computador (espelhamento) --------------
      // Reaproveita a mesma técnica do backup manual em pasta local
      // (File System Access API + handle salvo em IndexedDB), mas com um
      // banco próprio — não compartilha estado com o backup, de propósito,
      // para as duas funções não interferirem uma na outra.
      var BANCO_DO_EXPLORER = 'coding-loop-explorer';
      function chaveDaPastaVinculada() { return 'pasta-vinculada:' + uidDoProjeto(); }
      function abrirBancoDoExplorer() {
        return new Promise(function (resolve, reject) {
          if (!window.indexedDB) { reject(new Error('Sem IndexedDB')); return; }
          var pedido = window.indexedDB.open(BANCO_DO_EXPLORER, 1);
          pedido.onupgradeneeded = function () { pedido.result.createObjectStore('pastas'); };
          pedido.onsuccess = function () { resolve(pedido.result); };
          pedido.onerror = function () { reject(pedido.error); };
        });
      }
      function salvarHandleDaPastaReal(handle) {
        return abrirBancoDoExplorer().then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx = db.transaction('pastas', 'readwrite');
            tx.objectStore('pastas').put(handle, chaveDaPastaVinculada());
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
          });
        });
      }
      function carregarHandleDaPastaReal() {
        return abrirBancoDoExplorer().then(function (db) {
          return new Promise(function (resolve) {
            var tx = db.transaction('pastas', 'readonly');
            var pedido = tx.objectStore('pastas').get(chaveDaPastaVinculada());
            pedido.onsuccess = function () { resolve(pedido.result || null); };
            pedido.onerror = function () { resolve(null); };
          });
        }).catch(function () { return null; });
      }
      function atualizarStatusDeVinculoNoExplorer(nomeDaPasta) {
        if (explorerStatus) {
          explorerStatus.hidden = !nomeDaPasta;
          explorerStatus.textContent = nomeDaPasta ? ('Pasta aberta: ' + nomeDaPasta + ' — as alterações são gravadas nela.') : '';
        }
        if (explorerVincularPasta) {
          explorerVincularPasta.classList.toggle('is-active', !!nomeDaPasta);
          explorerVincularPasta.setAttribute('aria-pressed', nomeDaPasta ? 'true' : 'false');
        }
      }
      async function obterSubpastaReal(pastaRaiz, caminhoDaPasta) {
        var pasta = pastaRaiz;
        if (!caminhoDaPasta) return pasta;
        var partes = caminhoDaPasta.split('/');
        for (var i = 0; i < partes.length; i++) {
          pasta = await pasta.getDirectoryHandle(partes[i], { create: true });
        }
        return pasta;
      }
      async function espelharArquivoNoDisco(arquivo) {
        if (!pastaRealHandle) return;
        try {
          var permissao = await pastaRealHandle.queryPermission({ mode: 'readwrite' });
          if (permissao !== 'granted') {
            permissao = await pastaRealHandle.requestPermission({ mode: 'readwrite' });
            if (permissao !== 'granted') return;
          }
          var partes = arquivo.nome.split('/');
          var nomeDoArquivo = partes.pop();
          var pastaDestino = await obterSubpastaReal(pastaRealHandle, partes.join('/'));
          var arquivoHandle = await pastaDestino.getFileHandle(nomeDoArquivo, { create: true });
          var gravavel = await arquivoHandle.createWritable();
          await gravavel.write(arquivo.conteudo);
          await gravavel.close();
        } catch (erro) {
          // Falha ao espelhar não deve travar o salvamento normal, que já
          // aconteceu no armazenamento interno (localStorage/IndexedDB).
        }
      }
      function espelharProjetoInteiroNoDisco() {
        if (!pastaRealHandle) return Promise.resolve();
        return Promise.all(Object.keys(projeto.arquivos).map(function (caminho) {
          return espelharArquivoNoDisco({ nome: caminho, conteudo: projeto.arquivos[caminho].conteudo });
        }));
      }
      async function vincularPastaDoComputadorNoExplorer() {
        if (!window.showDirectoryPicker) {
          mostrarToast('Esse navegador não permite vincular uma pasta real (funciona em Chrome, Edge e outros baseados em Chromium).');
          return;
        }
        try {
          var pasta = await window.showDirectoryPicker({ id: 'coding-loop-explorer', mode: 'readwrite', startIn: 'documents' });
          pastaRealHandle = pasta;
          await salvarHandleDaPastaReal(pasta);
          atualizarStatusDeVinculoNoExplorer(pasta.name);
          mostrarToast('Pasta "' + pasta.name + '" vinculada — os arquivos serão espelhados nela ao salvar.');
          espelharProjetoInteiroNoDisco();
        } catch (erro) {
          if (erro && erro.name !== 'AbortError') mostrarToast('Não foi possível vincular a pasta.');
        }
      }

      // Ao carregar, tenta restaurar uma pasta vinculada em sessão
      // anterior. Só confirma com queryPermission (não pede permissão de
      // novo sozinho — isso exige gesto do usuário, por isso fica pendente
      // até o aluno clicar em "vincular" de novo).
      carregarHandleDaPastaReal().then(function (pasta) {
        if (!pasta || typeof pasta.queryPermission !== 'function') return;
        return pasta.queryPermission({ mode: 'readwrite' }).then(function (estado) {
          if (estado === 'granted') {
            pastaRealHandle = pasta;
            atualizarStatusDeVinculoNoExplorer(pasta.name);
          } else if (explorerStatus) {
            explorerStatus.hidden = false;
            explorerStatus.textContent = 'Pasta aberta antes — clique em "Abrir pasta" para escolher e confirmar de novo.';
          }
        });
      }).catch(function () { /* sem pasta vinculada ainda, segue no modo virtual */ });

      projetoCarregar().then(function () {
        if (explorerPanel && !explorerPanel.hidden) renderizarExplorer();
      });

      // ---- Abrir/fechar o Explorer ----------------------------------------
      // O painel mora dentro da janela do IDE (#ide-body), então funciona
      // igual em modo normal, tela cheia e layout vertical, e não mexe na
      // largura da Teoria. Ao abrir/fechar/redimensionar, o evento
      // ide:resize já existente reencaixa editores e preview.
      var explorerResizer = document.getElementById('explorer-resizer');
      var ideBody = document.getElementById('ide-body');
      var EXPLORER_LARGURA_PADRAO_PX = 240;
      var EXPLORER_LARGURA_MIN_PX = 140;
      var EXPLORER_AREA_MIN_EDITORES_PX = 220;
      var explorerLarguraPx = EXPLORER_LARGURA_PADRAO_PX;

      function avisarMudancaDeLayout() {
        requestAnimationFrame(function () { window.dispatchEvent(new Event('ide:resize')); });
      }

      function definirLarguraDoExplorer(px) {
        var disponivel = ideBody ? ideBody.getBoundingClientRect().width : 0;
        var maximo = Math.max(EXPLORER_LARGURA_MIN_PX, disponivel - EXPLORER_AREA_MIN_EDITORES_PX);
        explorerLarguraPx = Math.round(Math.min(maximo, Math.max(EXPLORER_LARGURA_MIN_PX, px)));
        explorerPanel.style.setProperty('--explorer-largura', explorerLarguraPx + 'px');
        if (explorerResizer) explorerResizer.setAttribute('aria-valuenow', String(explorerLarguraPx));
      }

      function abrirExplorer() {
        if (!explorerPanel) return;
        explorerPanel.hidden = false;
        if (explorerResizer) explorerResizer.hidden = false;
        definirLarguraDoExplorer(explorerLarguraPx);
        if (btnExplorerToggle) {
          btnExplorerToggle.setAttribute('aria-expanded', 'true');
          btnExplorerToggle.classList.add('is-active');
        }
        renderizarExplorer();
        avisarMudancaDeLayout();
      }

      function fecharExplorer() {
        if (!explorerPanel) return;
        explorerPanel.hidden = true;
        if (explorerResizer) explorerResizer.hidden = true;
        if (btnExplorerToggle) {
          btnExplorerToggle.setAttribute('aria-expanded', 'false');
          btnExplorerToggle.classList.remove('is-active');
        }
        avisarMudancaDeLayout();
      }

      // Divisor arrastável (mouse/toque) + teclado, no mesmo espírito dos
      // divisores entre editores: duplo clique restaura a largura padrão.
      if (explorerResizer && ideBody) {
        explorerResizer.addEventListener('pointerdown', function (evento) {
          if (evento.button !== undefined && evento.button !== 0) return;
          evento.preventDefault();
          var esquerda = ideBody.getBoundingClientRect().left;
          explorerResizer.classList.add('is-dragging');
          document.body.style.userSelect = 'none';
          try { explorerResizer.setPointerCapture(evento.pointerId); } catch (e) { /* sem captura: segue com listeners no documento */ }
          function mover(e) {
            definirLarguraDoExplorer(e.clientX - esquerda);
            avisarMudancaDeLayout();
          }
          function soltar(e) {
            explorerResizer.classList.remove('is-dragging');
            document.body.style.userSelect = '';
            try { explorerResizer.releasePointerCapture(e.pointerId); } catch (err) { /* já liberado */ }
            explorerResizer.removeEventListener('pointermove', mover);
            explorerResizer.removeEventListener('pointerup', soltar);
            explorerResizer.removeEventListener('pointercancel', soltar);
            avisarMudancaDeLayout();
          }
          explorerResizer.addEventListener('pointermove', mover);
          explorerResizer.addEventListener('pointerup', soltar);
          explorerResizer.addEventListener('pointercancel', soltar);
        });
        explorerResizer.addEventListener('keydown', function (evento) {
          var passo = evento.shiftKey ? 48 : 16;
          if (evento.key === 'ArrowLeft') definirLarguraDoExplorer(explorerLarguraPx - passo);
          else if (evento.key === 'ArrowRight') definirLarguraDoExplorer(explorerLarguraPx + passo);
          else if (evento.key === 'Home') definirLarguraDoExplorer(EXPLORER_LARGURA_MIN_PX);
          else return;
          evento.preventDefault();
          avisarMudancaDeLayout();
        });
        explorerResizer.addEventListener('dblclick', function () {
          definirLarguraDoExplorer(EXPLORER_LARGURA_PADRAO_PX);
          avisarMudancaDeLayout();
        });
        // Se a janela do IDE encolher (tela cheia→normal, resize), mantém
        // sempre uma área mínima para os editores.
        window.addEventListener('ide:resize', function () {
          if (!explorerPanel.hidden) definirLarguraDoExplorer(explorerLarguraPx);
        });
      }

      if (btnExplorerToggle) {
        btnExplorerToggle.addEventListener('click', function () {
          if (explorerPanel.hidden) abrirExplorer(); else fecharExplorer();
        });
      }

      function criarArquivoExtra(linguagem, nome, conteudo, opcoes) {
        opcoes = opcoes || {};
        var origem = opcoes.origem === 'projeto' ? 'projeto' : 'exercicio';
        var extensoes = { svg: 'svg', markdown: 'md', json: 'json', xml: 'xml', typescript: 'ts', scss: 'scss', javascriptreact: 'jsx', html: 'html', css: 'css', javascript: 'js' };
        var sufixo = extensoes[linguagem] || 'txt';
        var identificador = 'arquivo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        var idPane = identificador + '-pane';
        var nomeArquivo = opcoes.exato ? nome : nomeUnicoDoArquivo(nome || ('novo-arquivo.' + sufixo), origem);
        var aba = document.createElement('div');
        aba.className = 'tab-btn code-tab';
        aba.setAttribute('data-target', idPane);
        aba.setAttribute('data-origem', origem);
        aba.draggable = true;
        aba.innerHTML = '<input checked class="editor-toggle-checkbox" type="checkbox"><span class="tab-text"></span><span class="file-tab-actions"><button aria-label="Fechar arquivo" class="tab-action-btn file-close-btn" draggable="false" title="Fechar arquivo" type="button">×</button></span>';
        aba.querySelector('.tab-text').textContent = nomeArquivo;
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

        var arquivo = { idPane: idPane, origem: origem, nome: nomeArquivo, linguagem: linguagem, editor: criarEditor(container.id, linguagem, conteudo || '', nomeArquivo, origem) };
        arquivosExtras.push(arquivo);
        registrarAbaDeArquivo(aba, aba.querySelector('.editor-toggle-checkbox'), aba.querySelector('.file-close-btn'));
        // Ferramentas específicas deste arquivo ficam numa barra dentro do
        // próprio painel (limpar/renomear/duplicar/fechar deixaram a aba).
        painel.insertBefore(montarBarraDoArquivo(arquivo, aba), container);
        arquivo.editor.on('change', function () {
          sincronizarArquivosPrincipais();
          sincronizarDependenciasLocais();
          agendarValidacaoArquivo(arquivo);
          agendarAtualizacaoPreview();
          if (arquivo.origem === 'projeto') sincronizarArquivoDoProjeto(arquivo);
          else if (!carregandoCodigoDaEtapa) agendarSalvamentoAutomatico();
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
        if (!carregandoCodigoDaEtapa && origem !== 'projeto') agendarSalvamentoAutomatico();
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
        mainWindowContainer.classList.toggle('mistura-contextos', arquivosExtras.some(function (a) { return a.origem === 'projeto'; }));
        sincronizarPreviewComAbas(idsAtivos.length);

        limparTamanhosDosPaineis();
        configurarRedimensionadores();
        setTimeout(redimensionarEditores, 50);

        if (typeof renderizarExplorer === 'function' && explorerPanel && !explorerPanel.hidden) renderizarExplorer();
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
          if (!editor) return;
          confirmarAcao('Todo o conteúdo deste editor será removido.', { titulo: 'Limpar editor', confirmar: 'Limpar', destrutiva: true }).then(function (confirmado) {
            if (!confirmado) return;
            editor.setValue('', -1);
            agendarAtualizacaoPreview();
          });
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

      inputImportFile.addEventListener('change', function () {
        var file = inputImportFile.files[0];
        if (!file) {
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var conteudo = String(reader.result || '');
          // Arquivo avulso importado vira arquivo do PROJETO (nunca do exercício).
          var caminhoImportado = criarArquivoDoProjeto(linguagemDoArquivo(file.name) || 'plaintext', file.name, conteudo, true);
          mostrarToast((caminhoImportado || file.name) + ' adicionado ao projeto.');
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

      function abrirExportacaoDoArquivo(arquivo) {
        arquivo = arquivo || arquivoPadraoParaExportacao();
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
      }

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

      // ==================================================================
      // Menu "Adicionar arquivo": escolha do tipo (linguagens relacionadas
      // lado a lado) e, em seguida, um passo para nomear o arquivo.
      // ==================================================================
      if (btnNewFile && newFileMenu) {
        var barraDeAbasDoMenu = btnNewFile.closest('.browser-tabs');
        var passoTipos = document.getElementById('new-file-step-tipos');
        var passoNome = document.getElementById('new-file-step-nome');
        var campoNome = document.getElementById('new-file-name-input');
        var rotuloTipoNome = document.getElementById('new-file-type-label');
        var dicaNome = document.getElementById('new-file-name-hint');
        var botaoVoltarNome = document.getElementById('new-file-back');
        var botaoImportarDoMenu = document.getElementById('new-file-import');
        var tipoEmCriacao = null;
        var NOMES_SUGERIDOS = { html: 'pagina.html', css: 'estilo.css', javascript: 'script.js', svg: 'imagem.svg', markdown: 'README.md', json: 'dados.json', xml: 'dados.xml', typescript: 'app.ts', scss: 'estilo.scss', javascriptreact: 'App.jsx' };

        function mostrarPassoDeTipos() {
          tipoEmCriacao = null;
          passoNome.hidden = true;
          passoTipos.hidden = false;
        }
        function fecharMenuNovoArquivo() {
          newFileMenu.hidden = true;
          btnNewFile.setAttribute('aria-expanded', 'false');
          if (barraDeAbasDoMenu) barraDeAbasDoMenu.classList.remove('is-new-file-menu-open');
          mostrarPassoDeTipos();
        }
        function abrirMenuNovoArquivo() {
          mostrarPassoDeTipos();
          var retangulo = btnNewFile.getBoundingClientRect();
          newFileMenu.style.top = Math.max(8, Math.min(window.innerHeight - 320, retangulo.bottom + 5)) + 'px';
          newFileMenu.style.left = Math.max(8, Math.min(window.innerWidth - 288, retangulo.left)) + 'px';
          newFileMenu.hidden = false;
          btnNewFile.setAttribute('aria-expanded', 'true');
          if (barraDeAbasDoMenu) barraDeAbasDoMenu.classList.add('is-new-file-menu-open');
          var primeiroTipo = passoTipos.querySelector('.new-file-type');
          if (primeiroTipo) primeiroTipo.focus();
        }
        function mostrarPassoDeNome(botaoDoTipo) {
          var ext = botaoDoTipo.getAttribute('data-ext') || 'txt';
          var linguagem = botaoDoTipo.getAttribute('data-language');
          var sugerido = NOMES_SUGERIDOS[linguagem] || ('arquivo.' + ext);
          tipoEmCriacao = { linguagem: linguagem, ext: ext, sugerido: sugerido };
          rotuloTipoNome.textContent = '(.' + ext + ')';
          // Já sugere um nome livre (pagina-2.html se pagina.html existir).
          campoNome.value = nomeUnicoDoArquivo(sugerido);
          dicaNome.textContent = 'Sem extensão, adicionamos .' + ext + ' automaticamente.';
          passoTipos.hidden = true;
          passoNome.hidden = false;
          campoNome.focus();
          var ponto = campoNome.value.lastIndexOf('.');
          campoNome.setSelectionRange(0, ponto > 0 ? ponto : campoNome.value.length);
        }

        btnNewFile.addEventListener('click', function (evento) {
          evento.stopPropagation();
          abrirDropdownNovoArquivo(btnNewFile, '');
        });
        passoTipos.addEventListener('click', function (event) {
          var botaoDoTipo = event.target.closest('button.new-file-type');
          if (botaoDoTipo) mostrarPassoDeNome(botaoDoTipo);
        });
        botaoVoltarNome.addEventListener('click', function () {
          mostrarPassoDeTipos();
          var primeiroTipo = passoTipos.querySelector('.new-file-type');
          if (primeiroTipo) primeiroTipo.focus();
        });
        passoNome.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!tipoEmCriacao) return;
          var nome = (campoNome.value || '').trim() || tipoEmCriacao.sugerido;
          if (/[<>:"|?*\u0000-\u001f]/.test(nome)) {
            dicaNome.textContent = 'O nome contém caracteres inválidos ( < > : " | ? * ).';
            campoNome.focus();
            return;
          }
          if (!/\.[A-Za-z0-9]+$/.test(nome)) nome += '.' + tipoEmCriacao.ext;
          var linguagem = tipoEmCriacao.linguagem;
          fecharMenuNovoArquivo();
          criarArquivoDoProjeto(linguagem, nome, '', true);
        });
        if (botaoImportarDoMenu) {
          botaoImportarDoMenu.addEventListener('click', function () {
            fecharMenuNovoArquivo();
            inputImportFile.click();
          });
        }
        document.addEventListener('pointerdown', function (event) {
          if (!newFileMenu.hidden && !newFileMenu.contains(event.target) && !btnNewFile.contains(event.target)) fecharMenuNovoArquivo();
        });
        document.addEventListener('keydown', function (event) {
          if (event.key === 'Escape' && !newFileMenu.hidden) {
            fecharMenuNovoArquivo();
            btnNewFile.focus();
          }
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
      var janela = document.querySelector('.browser-window');
      var barra = janela && janela.querySelector('.browser-tabs');
      var bordas = janela
        ? (parseFloat(getComputedStyle(janela).borderTopWidth) || 0) + (parseFloat(getComputedStyle(janela).borderBottomWidth) || 0)
        : 0;
      var alturaPreviewMinima = 2;
      var minimoIdeEstrutural = (barra ? barra.getBoundingClientRect().height : 28) + bordas + alturaPreviewMinima;
      var minimoIde = minimoIdeEstrutural;
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
      } catch (_) { }
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
      } catch (_) { }
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
