/* =====================================================
   IDE.JS
   Lógica da página do IDE integrado (editor de código +
   guia teórico com módulos/etapas + progresso do aluno).

   Página PROTEGIDA (ide.html define window.CL_PROTECTED_PAGE
   = true antes de carregar este arquivo): exige sessão válida
   antes de montar qualquer coisa.

   Progresso e código do aluno NÃO ficam mais em localStorage —
   tudo vive no Firestore via CL.api (ver assets/js/api.js):
     - users/{uid}.idePosition                    -> módulo/etapa atual
     - users/{uid}/progress/{moduloId:step}        -> concluída? / % de acerto
     - users/{uid}/exercises/{moduloId:step}        -> {html, css, js} salvos

   Depende de (carregados ANTES deste arquivo, em ide.html):
     firebase-init.js, auth.js, api.js, e o SDK do Ace.
   ===================================================== */
(function () {
  'use strict';

  window.CL = window.CL || {};
  var CL = window.CL;

  // Chamada pelo bootIde() (no rodapé deste arquivo) depois que o
  // guard de autenticação passou e os dados do Firestore já foram
  // carregados. progressoCarregado/exerciciosCarregado/posicaoCarregada
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
      });
    }

    // O botão de retorno identifica visualmente a trilha aberta na IDE.
    // A página inicia com HTML no markup para evitar ícone vazio antes do
    // carregamento; aqui aplicamos CSS ou JavaScript quando for o caso.
    const courseDashboardIcon = document.getElementById('course-dashboard-icon');
    const courseIcons = {
      html: 'assets/images/icons/html.svg',
      css: 'assets/images/icons/css.svg',
      js: 'assets/images/icons/javascript.svg'
    };
    if (courseDashboardIcon) {
      courseDashboardIcon.src = courseIcons[cursoAtualId] || courseIcons.html;
      courseDashboardIcon.alt = CL.curso.CURSOS[cursoAtualId].nome || 'HTML';
    }

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
    const btnBackupNow = document.getElementById('btn-backup-now');
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
    const btnTestBackupConnection = document.getElementById('btn-test-backup-connection');
    const btnSaveBackupSettings = document.getElementById('btn-save-backup-settings');
    const inputImportProgress = document.getElementById('input-import-progress');
    const btnSelectBackupFolder = document.getElementById('btn-select-backup-folder');
    const backupFolderGuide = document.getElementById('backup-folder-guide');
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
    let pastaBackupSelecionada = null;

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
    // Antes vivia no localStorage; agora fica em Firestore
    // (users/{uid}/progress/{moduloId:step}), via CL.api.
    // Para evitar leituras assíncronas espalhadas pela UI, tudo é
    // carregado uma vez no boot (ver bootIde) para este cache em
    // memória, e as escritas seguem "fire and forget" para o
    // Firestore (CL.api já mostra um toast se a escrita falhar).
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
    const indiceTituloEl = document.getElementById('indice-titulo-modulo');

    function renderIndice() {
      const modulo = getModuloAtual();
      if (indiceTituloEl) {
        indiceTituloEl.textContent = 'Módulo ' + (currentModuleIndex + 1) + ' de ' + MODULOS.length + ': ' + modulo.nome;
      }

      const nodes = CL.curso.buildEtapaNodes(modulo, progressoEtapasCache, currentStep);

      CL.trilha.render(indiceListaEl, {
        nodes: nodes,
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
      theoryContentEl.hidden = true;
      toggleIndiceBtn.classList.add('is-active');
      toggleIndiceBtn.setAttribute('aria-expanded', 'true');
    }

    toggleIndiceBtn.addEventListener('click', function () {
      if (indicePanelEl.hidden) {
        abrirIndice();
      } else {
        fecharIndice();
      }
    });

    // Permite que outros scripts leiam a etapa atual sem depender da ordem
    // de carregamento dos <script>.
    window.getEtapaAtual = function () {
      return getEtapasDoModulo()[currentStep - 1];
    };

    function renderEtapas() {
      moduleTitleEl.textContent = getModuloAtual().nome;
      const totalEtapas = getTotalEtapas();

      theoryContentEl.innerHTML = getEtapasDoModulo().map(function (etapa, i) {
        const numero = i + 1;
        const ehPrimeira = numero === 1;
        const ehUltima = numero === totalEtapas;

        // Botão de voltar (canto superior esquerdo do card): na 1ª etapa
        // do módulo leva pra trilha de módulos na Dashboard; nas demais,
        // volta pra etapa anterior.
        const tituloVoltar = ehPrimeira ? 'Voltar para a Trilha de Módulos' : 'Etapa Anterior';
        const btnVoltar =
          '<button type="button" class="step-nav-btn step-nav-btn--back" data-step-action="back" title="' + tituloVoltar + '" aria-label="' + tituloVoltar + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' +
          '</button>';

        // Botão de avançar (depois do fim do conteúdo, canto inferior
        // direito): na última etapa leva pra trilha de módulos (pra
        // aluno escolher o próximo módulo, se já destravado); nas
        // demais, avança pra próxima etapa.
        const tituloAvancar = ehUltima ? 'Concluir e Ir para a Trilha de Módulos' : 'Próxima Etapa';
        const btnAvancar =
          '<div class="step-nav-footer">' +
            '<button type="button" class="step-nav-btn step-nav-btn--next" data-step-action="next" title="' + tituloAvancar + '" aria-label="' + tituloAvancar + '">' +
              '<span>' + (ehUltima ? 'Concluir módulo' : 'Próxima etapa') + '</span>' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>' +
            '</button>' +
          '</div>';

        return (
          '<section class="step-card' + (i === 0 ? ' active' : '') + '" data-step="' + numero + '">' +
            btnVoltar +
            '<h3>' + etapa.titulo + '</h3>' +
            etapa.texto +
            '<div class="task-box"><strong>Missão:</strong> ' + etapa.missao + '</div>' +
            btnAvancar +
          '</section>'
        );
      }).join('');
    }

    function updateStepsUI() {
      document.querySelectorAll('.step-card').forEach(function (card) {
        card.classList.toggle('active', parseInt(card.dataset.step, 10) === currentStep);
      });

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
      const etapaConcluidaAgora = window.getEtapaAtual();
      const moduloIdAtual = getModuloAtual().id;
      const percentualCalculado = calcularPercentualEtapa(etapaConcluidaAgora);
      const dadosProgresso = { concluida: true };
      if (percentualCalculado !== null) dadosProgresso.percentual = percentualCalculado;
      setProgressoEtapa(moduloIdAtual, currentStep, dadosProgresso);

      if (currentStep < getTotalEtapas()) {
        prepararTrocaDeEtapa();
        currentStep++;
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
      if (currentStep > 1) {
        prepararTrocaDeEtapa();
        currentStep--;
        updateStepsUI();
        return;
      }
      irParaTrilhaDeModulos();
    }

    // Botões dentro de cada etapa (topo-esquerda "voltar" / rodapé-
    // direita "avançar", ver renderEtapas). Delegado no container, já
    // que os cards são recriados a cada troca de módulo.
    theoryContentEl.addEventListener('click', function (e) {
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

    // ==========================================================
    // SALVAMENTO LOCAL POR ETAPA
    // O índice pequeno guarda posição e progresso. Cada código fica em
    // uma chave própria no localStorage e é lido somente ao abrir a etapa.
    // ==========================================================

    // Preenchido no boot apenas com o índice das etapas que têm código.
    let exerciciosCache = exerciciosCarregado || {};

    // Grava só a posição atual (módulo + etapa) no perfil. É chamada
    // exclusivamente pelo salvamento manual, junto do código da etapa.
    function salvarProgresso() {
      if (!CL.auth || typeof CL.auth.updateUser !== 'function') return Promise.resolve(false);
      return CL.auth.updateUser({
        idePosition: { moduloId: getModuloAtual().id, etapa: currentStep }
      });
    }

    window.salvarPosicaoDaIde = salvarProgresso;

    function nomeArquivoBackup() {
      const agora = new Date();
      const dataArquivo = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0') + '-' + String(agora.getHours()).padStart(2, '0') + String(agora.getMinutes()).padStart(2, '0');
      return 'coding-loop-progresso-' + dataArquivo + '.json';
    }

    function baixarBackup(data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = nomeArquivoBackup();
      link.click();
      setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    }

    function abrirBancoDaPastaBackup() {
      return new Promise(function (resolve, reject) {
        if (!window.indexedDB) return reject(new Error('IndexedDB não disponível.'));
        const request = indexedDB.open('coding-loop-backup', 1);
        request.onupgradeneeded = function () {
          if (!request.result.objectStoreNames.contains('handles')) request.result.createObjectStore('handles');
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      });
    }

    async function guardarPastaBackup(handle) {
      const banco = await abrirBancoDaPastaBackup();
      await new Promise(function (resolve, reject) {
        const transaction = banco.transaction('handles', 'readwrite');
        transaction.objectStore('handles').put(handle, 'computer-folder');
        transaction.oncomplete = resolve;
        transaction.onerror = function () { reject(transaction.error); };
      });
      banco.close();
    }

    async function obterPastaBackup() {
      try {
        const banco = await abrirBancoDaPastaBackup();
        const handle = await new Promise(function (resolve, reject) {
          const request = banco.transaction('handles', 'readonly').objectStore('handles').get('computer-folder');
          request.onsuccess = function () { resolve(request.result || null); };
          request.onerror = function () { reject(request.error); };
        });
        banco.close();
        return handle;
      } catch (error) { return null; }
    }

    async function pastaTemPermissao(handle, solicitar) {
      if (!handle) return false;
      const options = { mode: 'readwrite' };
      if (typeof handle.queryPermission === 'function' && await handle.queryPermission(options) === 'granted') return true;
      return Boolean(solicitar && typeof handle.requestPermission === 'function' && await handle.requestPermission(options) === 'granted');
    }

    async function salvarBackupNoComputador(data) {
      const pasta = await obterPastaBackup();
      if (pasta && await pastaTemPermissao(pasta, true)) {
        const arquivo = await pasta.getFileHandle(nomeArquivoBackup(), { create: true });
        const gravacao = await arquivo.createWritable();
        await gravacao.write(JSON.stringify(data, null, 2));
        await gravacao.close();
        return true;
      }
      baixarBackup(data);
      return false;
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
      return response.json();
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
      return response.json();
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

    async function fazerBackup() {
      const settings = CL.api.getBackupSettings();
      const data = CL.api.exportStudyData();
      const destinations = settings.destinations || [];
      if (destinations.includes('computer')) await salvarBackupNoComputador(data);
      if (destinations.includes('local')) CL.api.saveLocalBackup();
      if (destinations.includes('drive')) await enviarBackupGoogleDrive(data, true);
      if (destinations.includes('onedrive')) await enviarBackupOneDrive(data, true);
      CL.api.saveBackupSettings({ lastBackupAt: data.exportedAt, lastBackupDestinations: destinations });
      sincronizacaoNuvemPendente = false;
      fecharMenuBackup();
    }

    let sincronizacaoNuvemPendente = false;
    let sincronizacaoNuvemEmAndamento = false;
    let temporizadorSincronizacaoNuvem = null;
    const ATRASO_SINCRONIZACAO_NUVEM = 2 * 60 * 1000;
    const INTERVALO_VERIFICACAO_NUVEM = 10 * 60 * 1000;

    function agendarSincronizacaoNuvem() {
      sincronizacaoNuvemPendente = true;
      clearTimeout(temporizadorSincronizacaoNuvem);
      temporizadorSincronizacaoNuvem = setTimeout(function () { sincronizarNuvemAutomaticamente(false); }, ATRASO_SINCRONIZACAO_NUVEM);
    }

    async function sincronizarNuvemAutomaticamente(forcar) {
      if (sincronizacaoNuvemEmAndamento || (!forcar && !sincronizacaoNuvemPendente)) return false;
      const settings = CL.api.getBackupSettings();
      const destinos = settings.destinations || [];
      const tarefas = [];
      const dados = CL.api.exportStudyData();
      if (destinos.includes('drive') && settings.googleDriveConnected) tarefas.push(enviarBackupGoogleDrive(dados, false));
      if (destinos.includes('onedrive') && settings.oneDriveConnected) tarefas.push(enviarBackupOneDrive(dados, false));
      if (!tarefas.length) return false;
      sincronizacaoNuvemEmAndamento = true;
      const resultados = await Promise.allSettled(tarefas);
      sincronizacaoNuvemEmAndamento = false;
      if (resultados.some(function (resultado) { return resultado.status === 'fulfilled'; })) {
        sincronizacaoNuvemPendente = false;
        CL.api.saveBackupSettings({ lastCloudSyncAt: dados.exportedAt });
        return true;
      }
      return false;
    }

    setInterval(function () { sincronizarNuvemAutomaticamente(false); }, INTERVALO_VERIFICACAO_NUVEM);

    function importarArquivoDeBackup() {
      inputImportProgress.click();
    }

    function atualizarStatusBackup() {
      if (!backupStatus) return;
      backupStatus.classList.remove('is-error');
      const settings = CL.api.getBackupSettings();
      if (!settings.lastBackupAt) { backupStatus.textContent = 'Último backup: ainda não realizado.'; return; }
      const locais = (settings.lastBackupDestinations || []).map(function (local) {
        return { computer: 'Computador', local: 'LocalStorage', drive: 'Google Drive', onedrive: 'OneDrive' }[local] || local;
      });
      backupStatus.textContent = 'Último backup: ' + new Date(settings.lastBackupAt).toLocaleString('pt-BR') + (locais.length ? ' — ' + locais.join(', ') : '');
    }

    async function testarConexoesBackup() {
      const formData = new FormData(backupSettingsForm);
      const destinos = formData.getAll('destinations');
      const testes = [];
      if (!destinos.length || (!destinos.includes('drive') && !destinos.includes('onedrive'))) {
        return window.alert('Marque Google Drive ou OneDrive para testar a conexão.');
      }
      if (destinos.includes('drive') && !await confirmarPermissaoNuvem('google')) return;
      if (destinos.includes('onedrive') && !await confirmarPermissaoNuvem('microsoft')) return;
      if (destinos.includes('drive')) testes.push(obterTokenGoogleDrive(true).then(function (token) {
        const endpoint = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1&fields=files(id)';
        return fetch(endpoint, { headers: { Authorization: 'Bearer ' + token } }).then(function (resposta) { if (!resposta.ok) throw new Error(); return 'Google Drive'; });
      }));
      if (destinos.includes('onedrive')) testes.push(obterTokenOneDrive(true).then(function (token) {
        return fetch('https://graph.microsoft.com/v1.0/me/drive', { headers: { Authorization: 'Bearer ' + token } }).then(function (resposta) { if (!resposta.ok) throw new Error(); return 'OneDrive'; });
      }));
      try { window.alert('Conexão confirmada: ' + (await Promise.all(testes)).join(' e ') + '.'); }
      catch (error) { window.alert('Não foi possível confirmar a conexão. Verifique as permissões e as URLs autorizadas.'); }
    }

    function atualizarBotaoDestino(botao, texto, conectado) {
      if (!botao) return;
      const rotulo = botao.querySelector('span');
      if (rotulo) rotulo.textContent = texto;
      botao.classList.toggle('is-connected', Boolean(conectado));
      if (conectado) {
        botao.classList.remove('is-sync-required', 'is-location-required');
      }
    }

    function marcarDestinoDoBotao(botao) {
      const opcao = botao && botao.closest('.backup-option');
      const campo = opcao && opcao.querySelector('input[name="destinations"]');
      if (campo) campo.checked = true;
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

    function atualizarEstadoLocalBackup() {
      if (!btnSelectBackupFolder) return;
      const opcao = btnSelectBackupFolder.closest('.backup-option');
      const campo = opcao && opcao.querySelector('input[name="destinations"]');
      const selecionado = Boolean(campo && campo.checked);
      btnSelectBackupFolder.classList.toggle('is-location-required', selecionado && !pastaBackupSelecionada);
      btnSelectBackupFolder.classList.toggle('is-connected', selecionado && Boolean(pastaBackupSelecionada));
      atualizarEstadoBotaoSalvarBackup();
    }

    function configuracaoBackupEstaCompleta() {
      if (!backupSettingsForm) return false;
      const formData = new FormData(backupSettingsForm);
      const destinations = formData.getAll('destinations');
      if (!destinations.includes('local')) destinations.push('local');
      if (!destinations.length || !formData.get('schedule') || !formData.get('mode')) return false;
      const settings = CL.api.getBackupSettings();
      if (destinations.includes('computer') && !pastaBackupSelecionada) return false;
      if (destinations.includes('drive') && !settings.googleDriveConnected) return false;
      if (destinations.includes('onedrive') && !settings.oneDriveConnected) return false;
      return true;
    }

    function atualizarEstadoBotaoSalvarBackup() {
      if (!btnSaveBackupSettings) return;
      const pronto = configuracaoBackupEstaCompleta();
      btnSaveBackupSettings.disabled = !pronto;
      btnSaveBackupSettings.setAttribute('aria-disabled', String(!pronto));
      btnSaveBackupSettings.title = pronto ? 'Salvar Configurações' : 'Conclua as Opções Obrigatórias';
    }

    async function atualizarAcoesDestino() {
      const pasta = await obterPastaBackup();
      pastaBackupSelecionada = pasta;
      atualizarBotaoDestino(btnSelectBackupFolder, pasta ? pasta.name : 'Escolher Local', Boolean(pasta));
      const settings = CL.api.getBackupSettings();
      atualizarBotaoDestino(btnSyncGoogleDrive, settings.googleDriveConnected ? 'Sincronizado' : 'Sincronizar', settings.googleDriveConnected);
      atualizarBotaoDestino(btnSyncOneDrive, settings.oneDriveConnected ? 'Sincronizado' : 'Sincronizar', settings.oneDriveConnected);
      atualizarEstadoLocalBackup();
      atualizarEstadoSincronizacao();
    }

    async function escolherPastaBackup() {
      if (typeof window.showDirectoryPicker !== 'function') {
        window.alert('A escolha de pasta não é compatível com este navegador. O backup continuará usando o download padrão.');
        return;
      }
      try {
        const pastaEscolhida = await window.showDirectoryPicker({ id: 'coding-loop-backup', mode: 'readwrite', startIn: 'documents' });
        const pasta = pastaEscolhida.name === 'Coding Loop Backups'
          ? pastaEscolhida
          : await pastaEscolhida.getDirectoryHandle('Coding Loop Backups', { create: true });
        await guardarPastaBackup(pasta);
        pastaBackupSelecionada = pasta;
        marcarDestinoDoBotao(btnSelectBackupFolder);
        atualizarBotaoDestino(btnSelectBackupFolder, pasta.name, true);
        atualizarEstadoLocalBackup();
      } catch (error) {
        if (!error || error.name !== 'AbortError') {
          window.alert('Não foi possível preparar a pasta exclusiva de backup. Verifique a permissão da pasta escolhida e tente novamente.');
        }
      }
    }

    if (btnSelectBackupFolder) btnSelectBackupFolder.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (backupFolderGuide) backupFolderGuide.showModal();
      else escolherPastaBackup();
    });
    if (backupFolderGuide) backupFolderGuide.addEventListener('close', function () {
      if (backupFolderGuide.returnValue === 'continue') escolherPastaBackup();
    });

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
        if (!await confirmarPermissaoNuvem('google')) return;
        await obterTokenGoogleDrive(true);
        CL.api.saveBackupSettings({ googleDriveConnected: true });
        marcarDestinoDoBotao(btnSyncGoogleDrive);
        atualizarBotaoDestino(btnSyncGoogleDrive, 'Sincronizado', true);
        atualizarEstadoSincronizacao();
      } catch (error) {
        window.alert('Não foi possível entrar na conta do Google Drive. Verifique as permissões e tente novamente.');
      }
    });

    if (btnSyncOneDrive) btnSyncOneDrive.addEventListener('click', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      try {
        if (!await confirmarPermissaoNuvem('microsoft')) return;
        await obterTokenOneDrive(true);
        CL.api.saveBackupSettings({ oneDriveConnected: true });
        marcarDestinoDoBotao(btnSyncOneDrive);
        atualizarBotaoDestino(btnSyncOneDrive, 'Sincronizado', true);
        atualizarEstadoSincronizacao();
      } catch (error) {
        window.alert(mensagemErroOneDrive(error));
      }
    });

    if (backupSettingsForm) {
      backupSettingsForm.querySelectorAll('input[name="destinations"]').forEach(function (campo) {
        campo.addEventListener('change', function () {
          if (!campo.checked && (campo.value === 'drive' || campo.value === 'onedrive')) {
            const nome = campo.value === 'drive' ? 'Google Drive' : 'OneDrive';
            if (!window.confirm('Tem certeza que deseja desabilitar a sincronização com ' + nome + '? Os backups existentes não serão apagados.')) {
              campo.checked = true;
              return;
            }
          }
          atualizarEstadoLocalBackup();
          atualizarEstadoSincronizacao();
        });
      });
      backupSettingsForm.addEventListener('change', atualizarEstadoBotaoSalvarBackup);
    }

    function confirmarERestaurar(backup, origem, criarCopia, conflito) {
      if (!backup) return window.alert('Nenhum backup foi encontrado em ' + origem + '.');
      if (conflito === 'newest') {
        const atual = CL.api._studyIndex && CL.api._studyIndex();
        const dataAtual = atual && atual.updatedAt ? new Date(atual.updatedAt).getTime() : 0;
        const dataBackup = backup.index && backup.index.updatedAt ? new Date(backup.index.updatedAt).getTime() : 0;
        if (dataAtual && dataBackup && dataAtual >= dataBackup) return window.alert('O progresso atual é o mais recente; nenhuma restauração foi feita.');
      }
      const dataBackup = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('pt-BR') : 'data não informada';
      if (!window.confirm('Restaurar o backup de ' + origem + ' (' + dataBackup + ') substituirá o progresso atual. Continuar?')) return;
      if (criarCopia) CL.api.saveLocalBackup();
      CL.api.importStudyData(backup);
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
      document.addEventListener('click', function (event) {
        if (!event.target.closest('.backup-menu')) fecharMenuBackup();
      });
    }
    if (btnBackupNow) btnBackupNow.addEventListener('click', function () {
      const concluir = function () { fazerBackup().catch(function (error) { window.alert(error.message); }); };
      if (typeof window.salvarRascunhoAtualDaIde === 'function') window.salvarRascunhoAtualDaIde().then(concluir);
      else concluir();
    });
    if (btnRestoreBackup) btnRestoreBackup.addEventListener('click', function () {
      const settings = CL.api.getBackupSettings();
      const destinations = settings.destinations || [];
      fecharMenuBackup();
      if (restoreBackupDialog && restoreBackupSource) {
        const nomes = { computer: 'Computador (arquivo .json)', local: 'LocalStorage deste navegador', drive: 'Google Drive (privado do app)', onedrive: 'OneDrive' };
        restoreBackupSource.innerHTML = destinations.map(function (destino) { return '<option value="' + destino + '">' + nomes[destino] + '</option>'; }).join('');
        if (!destinations.length) return window.alert('Escolha ao menos um local de backup nas configurações.');
        atualizarVersoesDeRestauracao();
        restoreBackupDialog.showModal();
        return;
      }
      if (destinations.includes('local')) {
        const backup = CL.api.getLocalBackup();
        if (!backup) return window.alert('Nenhum backup local foi encontrado.');
        if (window.confirm('Restaurar o backup local substituirá o progresso atual. Continuar?')) { CL.api.importStudyData(backup); window.location.reload(); }
      } else if (destinations.includes('computer')) importarArquivoDeBackup();
      else if (destinations.includes('drive')) {
        restaurarBackupGoogleDrive().then(function (backup) {
          if (window.confirm('Restaurar o backup do Google Drive substituirá o progresso atual. Continuar?')) { CL.api.importStudyData(backup); window.location.reload(); }
        }).catch(function (error) { window.alert(error.message); });
      } else if (destinations.includes('onedrive')) {
        restaurarBackupOneDrive().then(function (backup) {
          if (window.confirm('Restaurar o backup do OneDrive substituirá o progresso atual. Continuar?')) { CL.api.importStudyData(backup); window.location.reload(); }
        }).catch(function (error) { window.alert(error.message); });
      } else window.alert('Escolha um local de backup nas configurações.');
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
      if (!formData.get('schedule')) {
        mostrarErroConfiguracaoBackup('Selecione uma opção de frequência.');
        return false;
      }
      if (!formData.get('mode')) {
        mostrarErroConfiguracaoBackup('Selecione um tipo de atualização.');
        return false;
      }
      if (destinations.includes('computer') && !pastaBackupSelecionada) {
        mostrarErroConfiguracaoBackup('Escolha uma pasta para concluir a configuração do backup no computador.');
        atualizarEstadoLocalBackup();
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
      backupStatus.classList.remove('is-error');
      return true;
    }

    if (btnBackupSettings && backupSettingsDialog) btnBackupSettings.addEventListener('click', function () {
      fecharMenuBackup();
      const theoryPane = document.querySelector('.theory-pane');
      if (theoryPane) {
        const larguraDisponivel = Math.max(0, window.innerWidth - 32);
        const dimensoesPainel = theoryPane.getBoundingClientRect();
        const plataforma = document.querySelector('.learning-platform-root');
        const alturaPlataforma = plataforma ? plataforma.getBoundingClientRect().height : window.innerHeight;
        const larguraPainel = Math.min(dimensoesPainel.width, larguraDisponivel);
        const alturaPainel = Math.min(alturaPlataforma, window.innerHeight);
        backupSettingsDialog.style.setProperty('--backup-dialog-width', larguraPainel + 'px');
        backupSettingsDialog.style.setProperty('--backup-dialog-height', alturaPainel + 'px');
      }
      const settings = CL.api.getBackupSettings();
      Object.keys(settings).forEach(function (key) {
        const field = backupSettingsForm.querySelector('[name="' + key + '"][value="' + settings[key] + '"]');
        if (field) field.checked = true;
      });
      backupSettingsForm.querySelectorAll('[name="destinations"]').forEach(function (field) {
        field.checked = settings.destinations.includes(field.value);
      });
      atualizarEstadoBotaoSalvarBackup();
      atualizarAcoesDestino();
      atualizarStatusBackup();
      backupSettingsDialog.showModal();
    });

    if (backupSettingsForm) backupSettingsForm.addEventListener('submit', function (event) {
      const valor = event.submitter && event.submitter.value;
      const settings = CL.api.getBackupSettings();
      if (valor !== 'cancel' && !validarConfiguracaoBackup()) {
        event.preventDefault();
        return;
      }
      if (valor === 'cancel' && !settings.configurationCompleted) {
        event.preventDefault();
        mostrarErroConfiguracaoBackup('Conclua e salve as opções obrigatórias antes de sair.');
      }
    });

    if (backupSettingsDialog) backupSettingsDialog.addEventListener('cancel', function (event) {
      if (!CL.api.getBackupSettings().configurationCompleted) {
        event.preventDefault();
        mostrarErroConfiguracaoBackup('Conclua e salve as opções obrigatórias antes de sair.');
      }
    });

    if (backupSettingsDialog) backupSettingsDialog.addEventListener('close', function () {
      if (backupSettingsDialog.returnValue !== 'save') return;
      const formData = new FormData(backupSettingsForm);
      const destinations = formData.getAll('destinations');
      if (!destinations.includes('local')) destinations.push('local');
      if (!destinations.length) return window.alert('Escolha ao menos um local para o backup.');
      CL.api.saveBackupSettings({ destinations: destinations, schedule: formData.get('schedule'), mode: formData.get('mode'), retentionCount: Number(formData.get('retentionCount')) || 1, configurationCompleted: true });
      atualizarStatusBackup();
    });
    if (btnTestBackupConnection) btnTestBackupConnection.addEventListener('click', testarConexoesBackup);

    function chaveAvisoBackup() {
      const uid = CL.state && CL.state.user && CL.state.user.uid ? CL.state.user.uid : 'usuario';
      return 'backupReminderDismissed:' + uid;
    }

    function abrirAvisoBackupSeNecessario() {
      if (!backupReminderDialog || typeof backupReminderDialog.showModal !== 'function') return;
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
      if (origem === 'computer') return importarArquivoDeBackup();
      if (origem === 'local') {
        const versoes = CL.api.getLocalBackupVersions ? CL.api.getLocalBackupVersions() : [];
        return confirmarERestaurar(versoes[Number(restoreBackupVersion.value)] || CL.api.getLocalBackup(), 'LocalStorage', criarCopiaAntesRestaurar, conflito);
      }
      const leitura = origem === 'drive' ? restaurarBackupGoogleDrive() : restaurarBackupOneDrive();
      const nome = origem === 'drive' ? 'Google Drive' : 'OneDrive';
      leitura.then(function (backup) { confirmarERestaurar(backup, nome, criarCopiaAntesRestaurar, conflito); }).catch(function (error) { window.alert(error.message); });
    });
    if (restoreBackupSource) restoreBackupSource.addEventListener('change', atualizarVersoesDeRestauracao);
    if (inputImportProgress) inputImportProgress.addEventListener('change', function () {
      const file = inputImportProgress.files && inputImportProgress.files[0];
      inputImportProgress.value = '';
      if (!file) return;
      const LIMITE_BACKUP_BYTES = 5 * 1024 * 1024;
      if (file.size > LIMITE_BACKUP_BYTES) return window.alert('Este arquivo é maior que 5 MB e foi bloqueado por segurança.');
      if (file.type && file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) return window.alert('Escolha apenas um arquivo de backup .json do Coding Loop.');
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const backup = JSON.parse(reader.result);
          if (!CL.api.validateStudyData || !CL.api.validateStudyData(backup)) throw new Error('Arquivo inválido');
          confirmarERestaurar(backup, 'Computador', criarCopiaAntesRestaurar, restoreBackupForm ? restoreBackupForm.elements.conflict.value : 'replace');
        } catch (error) { window.alert('Não foi possível importar este arquivo de progresso.'); }
      };
      reader.readAsText(file);
    });

    function executarBackupAgendado() {
      const settings = CL.api.getBackupSettings();
      if (!(settings.destinations || []).includes('local')) return;
      const agora = Date.now();
      const ultimo = settings.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : 0;
      const intervalo = settings.schedule === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : settings.schedule === 'monthly' ? 30 * 24 * 60 * 60 * 1000 : 0;
      if (intervalo && agora - ultimo >= intervalo) CL.api.saveLocalBackup();
    }
    executarBackupAgendado();
    window.addEventListener('pagehide', function () {
      const settings = CL.api.getBackupSettings();
      if (settings.schedule === 'exit' && (settings.destinations || []).includes('local')) CL.api.saveLocalBackup();
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

      if (salvo && (salvo.html || salvo.css || salvo.js)) {
        return salvo;
      }

      const salvoLocal = CL.api && typeof CL.api.getExerciseLocal === 'function'
        ? CL.api.getExerciseLocal(chave)
        : null;
      if (salvoLocal && (salvoLocal.html || salvoLocal.css || salvoLocal.js)) {
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
    // (ide.html?modulo=modulo-2-estilizando-com-css)? Abre direto
    // nesse módulo, começando da etapa 1 (a não ser que o aluno já
    // tenha progresso salvo justamente nesse módulo).
    function aplicarModuloDaUrl() {
      const moduloAlvo = new URLSearchParams(window.location.search).get('modulo');
      if (!moduloAlvo) return;

      const indiceModulo = MODULOS.findIndex(function (modulo) {
        return modulo.id === moduloAlvo;
      });
      if (indiceModulo === -1) return;

      if (indiceModulo !== currentModuleIndex) {
        currentModuleIndex = indiceModulo;
        currentStep = 1;
      }
    }

    restaurarProgressoSalvo(posicaoCarregada);
    aplicarModuloDaUrl();
    renderEtapas();
    updateStepsUI();
    setTimeout(abrirAvisoBackupSeNecessario, 350);
  } // fim de iniciarTeoria
  // Chamada pelo bootIde() (rodapé deste arquivo) só depois que o Ace
  // (window.ace) estiver carregado E os dados do Firestore já tiverem
  // chegado (iniciarTeoria já rodou, então window.getCodigoInicialParaEditor
  // já reflete o código salvo do aluno, se houver).
  function iniciarEditorDeCodigo() {
      // Fixa o basePath do Ace explicitamente. Sem isso, o Ace tenta
      // "adivinhar" de onde ele foi carregado (olhando o próprio
      // <script> tag) toda vez que precisa buscar o worker (ex.: o
      // worker-javascript.js, que é o mais pesado dos três e o que
      // mais demora). Fixando aqui, ele vai direto na URL certa.
      if (typeof ace !== 'undefined' && ace.config && typeof ace.config.set === 'function') {
        ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.36.2/');
      }

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
        var saveProgressDot = document.getElementById('save-progress-dot');
        var saveToastEl = document.getElementById('save-toast');
        var inputImportFile = document.getElementById('input-import-file');
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
            if (!divisor) return;
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

        function criarEditor(id, modo, valorInicial) {
          var editor = ace.edit(id);
          editor.setTheme(document.documentElement.getAttribute('data-theme') === 'solarized-light'
            ? 'ace/theme/solarized_light'
            : 'ace/theme/solarized_dark');
          editor.setOption('useWorker', true);
          editor.session.setMode(modo);
          editor.setShowPrintMargin(false);
          editor.setOption('wrap', true);
          editor.setFontSize('14px');
          editor.setValue(valorInicial, -1);
          return editor;
        }

        var codigoInicial = (window.getCodigoInicialParaEditor && window.getCodigoInicialParaEditor()) || {};

        htmlEditor = criarEditor('html-editor', 'ace/mode/html', codigoInicial.html || '');
        cssEditor = criarEditor('css-editor', 'ace/mode/css', codigoInicial.css || '');
        jsEditor = criarEditor('js-editor', 'ace/mode/javascript', codigoInicial.js || '');

        // Os controles agem sobre o último editor que recebeu foco. Assim,
        // continuam previsíveis mesmo quando mais de uma aba está visível.
        var editorAtivoParaHistorico = htmlEditor;
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
          var themeAce = event.detail === 'solarized-light' ? 'ace/theme/solarized_light' : 'ace/theme/solarized_dark';
          [htmlEditor, cssEditor, jsEditor].forEach(function (editor) { editor.setTheme(themeAce); });
        });

        var carregandoCodigoDaEtapa = false;
        function carregarCodigoDaEtapa() {
          var codigo = (window.getCodigoInicialParaEditor && window.getCodigoInicialParaEditor()) || {};
          carregandoCodigoDaEtapa = true;
          if (codigo.html !== undefined) htmlEditor.setValue(codigo.html, -1);
          if (codigo.css !== undefined) cssEditor.setValue(codigo.css, -1);
          if (codigo.js !== undefined) jsEditor.setValue(codigo.js, -1);
          carregandoCodigoDaEtapa = false;
        }

        // Usado pelo índice para calcular o percentual de acerto de cada
        // etapa (ver função `verificar` de cada etapa em MODULOS).
        window.obterCodigoAtualDoEditor = function () {
          return {
            html: htmlEditor.getValue(),
            css: cssEditor.getValue(),
            js: jsEditor.getValue()
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
          var resultado = window.salvarCodigoDoAluno({
            html: htmlEditor.getValue(),
            css: cssEditor.getValue(),
            js: jsEditor.getValue()
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

        function salvarEstadoGeral() {
          var salvarPosicao = window.salvarPosicaoDaIde || function () { return Promise.resolve(false); };
          return Promise.all([salvarCodigoAgora(), salvarPosicao()]).then(function (resultados) {
            if (!resultados[0] || !resultados[1]) throw new Error('Não foi possível confirmar o salvamento.');
            marcarComoSalvo();
            mostrarToast('Progresso salvo!');
            return true;
          }).catch(function () {
            marcarComoNaoSalvo();
            mostrarToast('Não foi possível salvar o progresso.');
            return false;
          });
        }

        window.salvarEstadoGeralDaIde = salvarEstadoGeral;
        window.addEventListener('ide:estado-alterado', marcarComoNaoSalvo);

        function redimensionarEditores() {
          [htmlEditor, cssEditor, jsEditor].forEach(function (editor) {
            if (editor) editor.resize();
          });
          atualizarIndicadoresRolagem();
        }

        function atualizarIndicadoresRolagem() {
          if (!tabsScrollWrapper || !dragContainer) return;
          var margem = 2;
          var podeRolarEsquerda = dragContainer.scrollLeft > margem;
          var maximoRolagem = dragContainer.scrollWidth - dragContainer.clientWidth;
          var podeRolarDireita = dragContainer.scrollLeft < (maximoRolagem - margem);
          tabsScrollWrapper.classList.toggle('can-scroll-left', podeRolarEsquerda);
          tabsScrollWrapper.classList.toggle('can-scroll-right', podeRolarDireita);
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
                anotacoes.push({
                  row: linhaDoIndice(codigo, match.index),
                  column: 0,
                  text: TAGS_VAZIAS.indexOf(nome) !== -1 ? '</' + nome + '> não é permitido: <' + nome + '> não possui fechamento.' : 'Tag de fechamento inesperada: </' + nome + '>',
                  type: 'error'
                });
              } else {
                for (var j = pilha.length - 1; j > indiceCorrespondente; j--) {
                  anotacoes.push({
                    row: linhaDoIndice(codigo, pilha[j].indice),
                    column: 0,
                    text: 'A tag <' + pilha[j].nome + '> deve ser fechada antes de </' + nome + '>.',
                    type: 'error'
                  });
                }
                pilha.length = indiceCorrespondente;
              }
            }
            } else if (!autoFechada) {
              var pai = pilha.length ? pilha[pilha.length - 1].nome : null;
              if (pai && ANINHAMENTO_PROIBIDO[pai] && ANINHAMENTO_PROIBIDO[pai].indexOf(nome) !== -1) {
                anotacoes.push({
                  row: linhaDoIndice(codigo, match.index),
                  column: 0,
                  text: '<' + nome + '> não pode ficar dentro de <' + pai + '>.',
                  type: 'error'
                });
              }
              pilha.push({ nome: nome, indice: match.index });
            }
          }

          pilha.forEach(function (item) {
            anotacoes.push({
              row: linhaDoIndice(codigo, item.indice),
              column: 0,
              text: 'A tag <' + item.nome + '> foi aberta mas não foi fechada.',
              type: 'error'
            });
          });

          var idsVistos = {};
          var regexId = /\bid\s*=\s*["']([^"']+)["']/g;
          while ((match = regexId.exec(codigo)) !== null) {
            var idAtual = match[1];
            if (idsVistos[idAtual] !== undefined) {
              anotacoes.push({
                row: linhaDoIndice(codigo, match.index),
                column: 0,
                text: 'id="' + idAtual + '" já foi usado antes — ids devem ser únicos.',
                type: 'warning'
              });
            } else {
              idsVistos[idAtual] = match.index;
            }
          }

          return anotacoes;
        }

        function tipoDaAnotacao(a) {
          return a.type === 'warning' ? 'warning' : (a.type === 'info' ? 'info' : 'error');
        }

        function redesenharMarcadoresErro(editor) {
          var session = editor.session;
          (session.__marcadoresOndulados || []).forEach(function (id) { session.removeMarker(id); });
          session.__marcadoresOndulados = [];

          var Range = ace.require('ace/range').Range;
          session.getAnnotations().forEach(function (a) {
            if (a.__semLinha) return;
            var linha = session.getLine(a.row) || '';
            if (!linha.trim()) return;
            var colInicio = (typeof a.column === 'number' && a.column >= 0 && a.column < linha.length) ? a.column : 0;
            while (colInicio < linha.length && /\s/.test(linha.charAt(colInicio))) colInicio++;
            if (colInicio >= linha.length) return;
            var colFim = (typeof a.__fimColuna === 'number') ? a.__fimColuna : colInicio + 1;
            while (colFim < linha.length && !/[\s;{}(),]/.test(linha.charAt(colFim))) colFim++;
            colFim = Math.max(colInicio + 1, Math.min(colFim, linha.length));
            var range = new Range(a.row, colInicio, a.row, colFim);
            var id = session.addMarker(range, 'ace-erro-ondulado erro-tipo-' + tipoDaAnotacao(a), 'text');
            session.__marcadoresOndulados.push(id);
          });
        }

        function atualizarBadge(tipo, anotacoes) {
          var aba = document.querySelector('.code-tab[data-target="' + tipo + '-pane"]');
          if (!aba) return;
          var erros = anotacoes.filter(function (a) { return tipoDaAnotacao(a) === 'error'; }).length;
          var avisos = anotacoes.filter(function (a) { return tipoDaAnotacao(a) === 'warning'; }).length;
          var infos = anotacoes.length - erros - avisos;
          var total = anotacoes.length;
          var severidade = erros ? 'error' : (avisos ? 'warning' : 'info');
          aba.classList.toggle('tem-erro', total > 0);
          aba.classList.toggle('erro-warning', total > 0 && severidade === 'warning');
          aba.classList.toggle('erro-info', total > 0 && severidade === 'info');
          var texto = total ? total + ' diagnóstico' + (total === 1 ? '' : 's') + ': ' + erros + ' erro(s), ' + avisos + ' aviso(s)' : 'Sem diagnósticos';
          var rotulo = aba.querySelector('.tab-text');
          if (rotulo) rotulo.setAttribute('data-diagnostic-count', total ? String(total) : '');
          aba.setAttribute('title', texto);
          aba.setAttribute('aria-label', tipo.toUpperCase() + '. ' + texto);
        }

        function ligarIndicadorSimples(editor, tipo) {
          editor.session.on('changeAnnotation', function () {
            var anotacoes = editor.session.getAnnotations();
            atualizarBadge(tipo, anotacoes);
            redesenharMarcadoresErro(editor);
          });
        }

        var anotacoesEstruturaisHTML = [];
        var mesclandoAnotacoesHTML = false;
        function finalizarAtualizacaoHTML() {
          var anotacoes = htmlEditor.session.getAnnotations();
          atualizarBadge('html', anotacoes);
          redesenharMarcadoresErro(htmlEditor);
        }
        function mesclarAnotacoesHTML() {
          var doWorker = htmlEditor.session.getAnnotations().filter(function (a) { return !a.__htmlEstrutural; });
          mesclandoAnotacoesHTML = true;
          htmlEditor.session.setAnnotations(doWorker.concat(anotacoesEstruturaisHTML));
          mesclandoAnotacoesHTML = false;
        }
        function executarVerificacaoHTML() {
          anotacoesEstruturaisHTML = verificarErrosHTML(htmlEditor.getValue()).map(function (anotacao) {
            anotacao.__htmlEstrutural = true;
            return anotacao;
          });
          mesclarAnotacoesHTML();
          finalizarAtualizacaoHTML();
        }
        function agendarVerificacaoHTML() {
          clearTimeout(htmlEditor.$verifTimeout);
          htmlEditor.$verifTimeout = setTimeout(executarVerificacaoHTML, 400);
        }
        htmlEditor.on('change', agendarVerificacaoHTML);
        htmlEditor.session.on('changeAnnotation', function () {
          if (mesclandoAnotacoesHTML) return;
          if (anotacoesEstruturaisHTML.length && !htmlEditor.session.getAnnotations().some(function (a) { return a.__htmlEstrutural; })) mesclarAnotacoesHTML();
          finalizarAtualizacaoHTML();
        });
        executarVerificacaoHTML();

        function removerComentariosCSS(codigo) {
          return codigo.replace(/\/\*[\s\S]*?\*\//g, function (comentario) {
            return comentario.replace(/[^\n]/g, ' ');
          });
        }

        function anotacaoCSS(codigo, indice, texto, tipo) {
          var antes = codigo.slice(0, indice);
          var quebra = antes.lastIndexOf('\n');
          var coluna = indice - quebra - 1;
          return {
            row: antes.split('\n').length - 1,
            column: coluna,
            __fimColuna: coluna + 1,
            text: texto,
            type: tipo || 'error',
            __cssEstrutural: true
          };
        }

        function verificarErrosCSS(codigoOriginal) {
          var codigo = removerComentariosCSS(codigoOriginal);
          var anotacoes = [];
          var pilha = [];
          var pares = { '}': '{', ')': '(', ']': '[' };
          var nomes = { '{': 'chave', '(': 'parêntese', '[': 'colchete' };
          var aspas = null;
          for (var i = 0; i < codigo.length; i++) {
            var caractere = codigo.charAt(i);
            if (aspas) {
              if (caractere === '\\') { i++; continue; }
              if (caractere === aspas) aspas = null;
              continue;
            }
            if (caractere === '"' || caractere === "'") { aspas = caractere; continue; }
            if (caractere === '.' && pilha.length === 0 && !/[A-Za-z_-]/.test(codigo.charAt(i + 1))) {
              anotacoes.push(anotacaoCSS(codigo, i, 'Após "." informe o nome da classe, por exemplo: .botao { ... }.'));
            }
            if (caractere === ';' && pilha.length === 0) {
              var inicioLinha = Math.max(codigo.lastIndexOf('\n', i - 1), codigo.lastIndexOf(';', i - 1)) + 1;
              var comando = codigo.slice(inicioLinha, i).trim();
              if (!/^@(import|charset|namespace|layer)\b/i.test(comando)) {
                anotacoes.push(anotacaoCSS(codigo, i, 'Ponto e vírgula não fecha seletor. Use "{" para abrir as regras da classe ou elemento.'));
              }
            }
            if (caractere === '{' || caractere === '(' || caractere === '[') pilha.push({ caractere: caractere, indice: i });
            else if (pares[caractere]) {
              if (!pilha.length || pilha[pilha.length - 1].caractere !== pares[caractere]) {
                anotacoes.push(anotacaoCSS(codigo, i, 'Fechamento "' + caractere + '" sem abertura correspondente.'));
              } else pilha.pop();
            }
          }
          pilha.forEach(function (abertura) {
            anotacoes.push(anotacaoCSS(codigo, abertura.indice, 'A ' + nomes[abertura.caractere] + ' "' + abertura.caractere + '" não foi fechada.'));
          });

          var semStrings = codigo.replace(/(['"])(?:\\.|(?!\1)[^\\\n])*\1/g, function (trecho) {
            return trecho.replace(/[^\n]/g, ' ');
          });
          var regexDeclaracao = /(?:^|[;{]\s*)([-\w]+)\s*:\s*([^;{}]*)/gm;
          var declaracao;
          while ((declaracao = regexDeclaracao.exec(semStrings)) !== null) {
            var proxima = /\s+[-\w]+\s*:/g.exec(declaracao[2]);
            if (proxima) {
              var indiceErro = declaracao.index + declaracao[0].length - declaracao[2].length + proxima.index;
              anotacoes.push(anotacaoCSS(codigo, indiceErro, 'Provável ponto e vírgula ausente antes desta propriedade.'));
            }
          }

          var classesHTML = {};
          var regexClasseHTML = /\bclass\s*=\s*["']([^"']+)["']/gi;
          var classeHTML;
          while ((classeHTML = regexClasseHTML.exec(htmlEditor.getValue())) !== null) {
            classeHTML[1].trim().split(/\s+/).forEach(function (nome) { if (nome) classesHTML[nome] = true; });
          }
          var regexSeletor = /(?:^|})\s*([^{}]+)\{/gm;
          var seletor;
          while ((seletor = regexSeletor.exec(semStrings)) !== null) {
            var inicioSeletor = seletor.index + seletor[0].indexOf(seletor[1]);
            seletor[1].split(',').forEach(function (parte) {
              var nome = parte.trim();
              if (classesHTML[nome]) {
                var deslocamento = seletor[1].indexOf(parte);
                anotacoes.push(anotacaoCSS(codigo, inicioSeletor + deslocamento, '"' + nome + '" é uma classe no HTML. Use .' + nome + ' para selecioná-la.', 'warning'));
              }
            });
          }

          var regexBloco = /\{([^{}]*)\}/g;
          var bloco;
          while ((bloco = regexBloco.exec(semStrings)) !== null) {
            var conteudo = bloco[1].trim();
            if (conteudo && /[-\w]+\s*:/.test(conteudo) && !/;\s*$/.test(conteudo)) {
              anotacoes.push(anotacaoCSS(codigo, bloco.index + bloco[0].length - 1, 'Adicione ";" ao fim da última declaração para manter o padrão do exercício.', 'warning'));
            }
          }
          return anotacoes;
        }

        var anotacoesEstruturaisCSS = [];
        var mesclandoAnotacoesCSS = false;
        function finalizarAtualizacaoCSS() {
          var anotacoes = cssEditor.session.getAnnotations();
          atualizarBadge('css', anotacoes);
          redesenharMarcadoresErro(cssEditor);
        }
        function mesclarAnotacoesCSS() {
          var doWorker = cssEditor.session.getAnnotations().filter(function (a) { return !a.__cssEstrutural; });
          mesclandoAnotacoesCSS = true;
          cssEditor.session.setAnnotations(doWorker.concat(anotacoesEstruturaisCSS));
          mesclandoAnotacoesCSS = false;
        }
        function executarVerificacaoCSS() {
          anotacoesEstruturaisCSS = verificarErrosCSS(cssEditor.getValue());
          mesclarAnotacoesCSS();
          finalizarAtualizacaoCSS();
        }
        function agendarVerificacaoCSS() {
          clearTimeout(cssEditor.$verifTimeout);
          cssEditor.$verifTimeout = setTimeout(executarVerificacaoCSS, 250);
        }
        cssEditor.session.on('changeAnnotation', function () {
          if (mesclandoAnotacoesCSS) return;
          if (anotacoesEstruturaisCSS.length && !cssEditor.session.getAnnotations().some(function (a) { return a.__cssEstrutural; })) mesclarAnotacoesCSS();
          finalizarAtualizacaoCSS();
        });
        cssEditor.on('change', agendarVerificacaoCSS);
        htmlEditor.on('change', agendarVerificacaoCSS);
        executarVerificacaoCSS();

        var anotacoesExecucaoJS = [];
        var mesclandoAnotacoesJS = false;

        function mesclarAnotacoesExecucaoJS() {
          var estaticas = jsEditor.session.getAnnotations().filter(function (a) { return !a.__execucao; });
          mesclandoAnotacoesJS = true;
          jsEditor.session.setAnnotations(estaticas.concat(anotacoesExecucaoJS));
          mesclandoAnotacoesJS = false;
        }

        function finalizarAtualizacaoJS() {
          var anotacoes = jsEditor.session.getAnnotations();
          atualizarBadge('js', anotacoes);
          redesenharMarcadoresErro(jsEditor);
        }

        jsEditor.session.on('changeAnnotation', function () {
          if (mesclandoAnotacoesJS) return;
          var atuais = jsEditor.session.getAnnotations();
          var jaTemExecucao = atuais.some(function (a) { return a.__execucao; });
          if (anotacoesExecucaoJS.length && !jaTemExecucao) {
            mesclarAnotacoesExecucaoJS();
          }
          finalizarAtualizacaoJS();
        });

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

        function montarCodigoPreview() {
          var html = htmlEditor.getValue();
          var css = cssEditor.getValue();
          var js = escaparFechamentoScript(jsEditor.getValue());
          var estiloTemaPreview = previewTemaEscuro
            ? 'html, body { min-height: 100%; background-color: #002b36 !important; color: #fdf6e3 !important; color-scheme: dark; } body > * { background-color: #002b36 !important; color: #fdf6e3 !important; }'
            : 'html, body { min-height: 100%; background-color: #ffffff !important; color: #1f2933 !important; color-scheme: light; } body > * { background-color: #ffffff !important; color: #1f2933 !important; }';

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

          var prefixo = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<style>\n' + css + '\nbody { margin: 0 !important; padding: 0 0 0 6px !important; }\n' + estiloTemaPreview + '\n</style>\n</head>\n<body>\n' + html + '\n<script>\n' + handlerErros;

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
            if (typeof dado.linha === 'number' && dado.linha > 0) {
              linha = Math.max(0, dado.linha - 1 - offsetLinhaJSNoPreview);
              linha = Math.min(linha, Math.max(0, jsEditor.session.getLength() - 1));
              semLinha = false;
            }

            var chave = (semLinha ? 'sem-linha' : linha) + '|' + dado.mensagem;
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
              __chave: chave
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
          }

          setTimeout(redimensionarEditores, 50);
        }

        function abrirJanela() {
          if (!IDE_ABERTO) {
            IDE_ABERTO = true;
            atualizarJanela();
          }
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
          return (idPane === 'html-pane' && chkToggleHtml.checked) ||
            (idPane === 'css-pane' && chkToggleCss.checked) ||
            (idPane === 'js-pane' && chkToggleJs.checked);
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

        [chkToggleHtml, chkToggleCss, chkToggleJs].forEach(function (checkbox) {
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

        btnImportFile.addEventListener('click', function () { inputImportFile.click(); });
        inputImportFile.addEventListener('change', function () {
          var file = inputImportFile.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            var nome = file.name.toLowerCase();
            var conteudo = String(reader.result || '');

            if (nome.endsWith('.css')) {
              cssEditor.setValue(conteudo, -1);
            } else if (nome.endsWith('.js')) {
              jsEditor.setValue(conteudo, -1);
            } else {
              var partes = separarCodigoImportado(conteudo);
              htmlEditor.setValue(partes.html, -1);
              cssEditor.setValue(partes.css, -1);
              jsEditor.setValue(partes.js, -1);
            }

            abrirJanela();
            atualizarLayoutAbas();
            agendarAtualizacaoPreview();
            mostrarToast('Arquivo importado e separado em HTML/CSS/JS.');
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

        function exportarCodigoUnico() {
          baixarArquivo(montarCodigoPreview(), 'codigo-editado.html', 'text/html;charset=utf-8');
          mostrarToast('Documento único exportado!');
        }

        function exportarCodigosSeparados() {
          var html = htmlEditor.getValue();
          var css = cssEditor.getValue();
          var js = jsEditor.getValue();
          var indexHtml = '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <link rel="stylesheet" href="style.css">\n  <title>Código editado</title>\n</head>\n<body>\n' + html + '\n  <script src="script.js"><\\/script>\n</body>\n</html>\n';
          baixarArquivo(indexHtml, 'index.html', 'text/html;charset=utf-8');
          baixarArquivo(css, 'style.css', 'text/css;charset=utf-8');
          baixarArquivo(js, 'script.js', 'text/javascript;charset=utf-8');
          mostrarToast('Arquivos separados exportados!');
        }

        btnExportFile.addEventListener('click', function () {
          if (exportCodeDialog && typeof exportCodeDialog.showModal === 'function') {
            exportCodeDialog.showModal();
          } else {
            exportarCodigoUnico();
          }
        });

        if (exportCodeDialog) {
          exportCodeDialog.addEventListener('close', function () {
            if (exportCodeDialog.returnValue === 'single') exportarCodigoUnico();
            if (exportCodeDialog.returnValue === 'separate') exportarCodigosSeparados();
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
          setTimeout(redimensionarEditores, 150);
        });

        window.addEventListener('resize', function () {
          if (mainWindowContainer.classList.contains('is-fullscreen')) {
            atualizarAlturaReal();
            redimensionarEditores();
          }
          atualizarIndicadoresRolagem();
        });

        dragContainer.addEventListener('scroll', atualizarIndicadoresRolagem, { passive: true });

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
          var maximizado = contentWrapper.classList.toggle('preview-maximized');
          prefPreviewMaximized = maximizado;
          btnPreviewMaximize.classList.toggle('is-active', maximizado);
          btnPreviewMaximize.setAttribute('aria-pressed', String(maximizado));
          alternarIcones(iconPreviewMax, iconPreviewRestore, maximizado);

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
        });

        atualizarJanela();
        atualizarLayoutAbas();
        if (chkTogglePreview.checked) mostrarPreview();
        setTimeout(redimensionarEditores, 100);
      }

      iniciar();
  } // fim de iniciarEditorDeCodigo

  /* ==========================================================
     BOOT — guarda a página (redireciona pra Landing se não
     houver sessão), carrega o progresso do aluno no Firestore
     e só então liga a teoria (módulos/etapas) e o editor Ace.
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
    // sentido montar o editor nem gastar leituras no Firestore.
    var autenticado = await CL.auth.guard();
    if (!autenticado) return;

    if (CL.curso && CL.curso.conteudoPronto) {
      await CL.curso.conteudoPronto;
    }

    var progressoCarregado = {};
    var exerciciosCarregado = {};
    var posicaoCarregada = null;

    // Timeout de segurança: em redes lentas (o long-polling do
    // Firestore pode demorar dezenas de segundos), não faz sentido
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
      var chamadaFirestore = Promise.all([
        CL.api.listProgress(),
        CL.api.listExercises(),
        CL.api.getProfile()
      ]);

      var corrida = await comTimeout(chamadaFirestore, 6000);

      if (corrida.expirou) {
        if (CL.config && CL.config.debug) {
          console.warn('[ide] Firestore demorou mais de 6s; liberando a tela com progresso vazio nesta sessão.');
        }
        if (CL.ui && typeof CL.ui.showToast === 'function') {
          CL.ui.showToast('Sua conexão está lenta — abrindo com o progresso local. Recarregue mais tarde pra sincronizar o que estava salvo.', 'warning', 8000);
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
        console.error('[ide] falha ao carregar progresso do Firestore:', erro);
      }
    }

    iniciarTeoria(progressoCarregado, exerciciosCarregado, posicaoCarregada);

    // O SDK do Ace carrega via <script src> antes deste arquivo, mas
    // mantemos o fallback defensivo do protótipo original só por
    // segurança (ex.: script bloqueado/lento).
    if (window.ace) {
      iniciarEditorDeCodigo();
    } else {
      window.addEventListener('load', iniciarEditorDeCodigo);
    }
  }

  bootIde();

})();

/* ==========================================================
   REDIMENSIONADOR DE PAINÉIS (Teoria <-> IDE)
   Não depende de autenticação nem de dados do Firestore.
   ========================================================== */
    (function () {
      var root = document.querySelector('.learning-platform-root');
      var theoryPane = document.querySelector('.theory-pane');
      var idePane = document.querySelector('.ide-container-pane');
      var resizer = document.getElementById('pane-resizer');

      if (!root || !theoryPane || !idePane || !resizer) return;

      var MIN_THEORY = 260;
      var MIN_IDE = 300;
      var DEFAULT_RATIO = 1 / 3;
      var ratioAtual = DEFAULT_RATIO;
      var arrastando = false;
      var vertical = false;
      var frameAgendado = null;

      function atualizarOrientacao() {
        vertical = getComputedStyle(root).flexDirection === 'column';
        resizer.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');
        resizer.style.cursor = vertical ? 'row-resize' : 'col-resize';
      }

      function limites(total) {
        var minimoTeoria = Math.min(MIN_THEORY, total * 0.45);
        var minimoIde = Math.min(MIN_IDE, total * 0.45);
        return { min: minimoTeoria, max: Math.max(minimoTeoria, total - minimoIde) };
      }

      function posicionarResizer() {
        atualizarOrientacao();
        var tamanhoTeoria = vertical
          ? theoryPane.getBoundingClientRect().height
          : theoryPane.getBoundingClientRect().width;
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
        posicionarResizer();
        window.dispatchEvent(new Event('ide:resize'));
      }

      function tamanhoPeloPonteiro(clientX, clientY) {
        var rect = root.getBoundingClientRect();
        return vertical ? clientY - rect.top : clientX - rect.left;
      }

      function agendarTamanho(px) {
        if (frameAgendado) cancelAnimationFrame(frameAgendado);
        frameAgendado = requestAnimationFrame(function () {
          frameAgendado = null;
          aplicarTamanho(px);
        });
      }

      function finalizarArraste() {
        if (!arrastando) return;
        arrastando = false;
        resizer.classList.remove('is-dragging');
        root.classList.remove('is-resizing-panels');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }

      resizer.addEventListener('pointerdown', function (event) {
        if (root.classList.contains('ide-recolhido')) return;
        atualizarOrientacao();
        arrastando = true;
        resizer.classList.add('is-dragging');
        root.classList.add('is-resizing-panels');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
        if (resizer.setPointerCapture) resizer.setPointerCapture(event.pointerId);
        event.preventDefault();
      });

      resizer.addEventListener('pointermove', function (event) {
        if (!arrastando) return;
        agendarTamanho(tamanhoPeloPonteiro(event.clientX, event.clientY));
      });
      resizer.addEventListener('pointerup', finalizarArraste);
      resizer.addEventListener('pointercancel', finalizarArraste);

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
        var rect = root.getBoundingClientRect();
        aplicarTamanho((vertical ? rect.height : rect.width) * DEFAULT_RATIO);
      });

      window.addEventListener('resize', function () {
        atualizarOrientacao();
        var rect = root.getBoundingClientRect();
        aplicarTamanho((vertical ? rect.height : rect.width) * ratioAtual, false);
      });

      var rectInicial = root.getBoundingClientRect();
      aplicarTamanho((getComputedStyle(root).flexDirection === 'column' ? rectInicial.height : rectInicial.width) * DEFAULT_RATIO);
    })();
