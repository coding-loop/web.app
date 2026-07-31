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
    // ==========================================================
    const MODULOS = [
      {
        id: 'modulo-1-introducao-html',
        nome: 'Introdução ao HTML',
        etapas: [
          {
            titulo: '<p> Bem Vindo ao Curso de HTML </p> <br>',
            texto: `<p> 1- Começe a mexer no ⌨ para aprender. </p> <br>
            <p> 2- Front-End Developer é Projeto Piloto de Coding-Loop, e para continuar de onde parou você precisará usar o mesmo aparelho e o mesmo navegador, pois esté é um site estático e não possui </p><br>
            <p> 3- Cline em 💾 para salvar o código e continuar de onde parou.</p> <br>
            <p> 4- Se você estiver em um 📱, para acessar todos os botões do IDE você precisará rolar para esquerda 🔙 e 🔜 direita. </p>    `,

            missao: `Mude o conteúdo do texto dentro do elemento <code>&lt;h1&gt;</code> no editor de código para o seu nome e observe o preview atualizar ao lado.`,
            codigoInicial: {
  				html: `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>My First Webpage</title>
</head>
<body>

	<h1>Welcome to My Website</h1>
	<p>This is a simple paragraph of text on my webpage.</p>
</body>
</html>`,
              css: 'body {\n  font-family: sans-serif;\n  background-color: #f9f9f9;\n  padding: 20px;\n  color: #333;\n}',
              js: 'console.log("Ambiente carregado com sucesso!");'
            },
            // Exemplo de verificação automática: dá 100% se o texto do <h1>
            // foi alterado (a missão pede pra trocar pelo nome do aluno).
            verificar: function (codigo) {
              var html = codigo.html || '';
              var match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
              var textoH1 = match ? match[1].trim() : '';
              return (textoH1 && textoH1 !== 'Welcome to My Website') ? 100 : 0;
            }
          },
          {
            titulo: "Etapa 2: Adicionando Cores (CSS)",
            texto: `<p>Podemos aplicar estilos visuais utilizando a aba CSS do editor.</p>`,
            missao: `Na aba CSS do editor, altere a cor de fundo (<code>background-color</code>) para um tom de sua preferência, como <code>#e0f7fa</code>.`
          },
          {
            titulo: "Etapa 3: Interatividade (JavaScript)",
            texto: `<p>O comportamento dinâmico é adicionado usando a aba JavaScript do editor.</p>`,
            missao: `Teste adicionar um botão ou modificar o script interativo na aba correspondente. Parabéns por concluir a introdução!`
          }
        ]
      },
      {
        id: 'modulo-2-estilizando-com-css',
        nome: 'Estilizando com CSS',
        etapas: [
          {
            titulo: "Etapa 1: Seletores CSS",
            texto: `<p>[Placeholder] Explicação sobre seletores de elemento, classe (<code>.classe</code>) e id (<code>#id</code>).</p>`,
            missao: `[Placeholder] Crie uma classe CSS e aplique-a em um elemento no HTML.`
          },
          {
            titulo: "Etapa 2: Cores e Fundos",
            texto: `<p>[Placeholder] Explicação sobre <code>color</code>, <code>background-color</code> e imagens de fundo.</p>`,
            missao: `[Placeholder] Altere a cor do texto e do fundo de um elemento à sua escolha.`
          },
          {
            titulo: "Etapa 3: Box Model",
            texto: `<p>[Placeholder] Explicação sobre <code>margin</code>, <code>padding</code>, <code>border</code> e o modelo de caixas.</p>`,
            missao: `[Placeholder] Adicione margem e preenchimento a um elemento e observe o efeito no preview.`
          }
        ]
      },
      {
        id: 'modulo-3-interatividade-com-javascript',
        nome: 'Interatividade com JavaScript',
        etapas: [
          {
            titulo: "Etapa 1: Variáveis e Tipos",
            texto: `<p>[Placeholder] Explicação sobre <code>let</code>, <code>const</code> e os tipos básicos de dados em JavaScript.</p>`,
            missao: `[Placeholder] Declare uma variável e exiba seu valor com <code>console.log</code>.`
          },
          {
            titulo: "Etapa 2: Eventos",
            texto: `<p>[Placeholder] Explicação sobre <code>addEventListener</code> e a reação a cliques do usuário.</p>`,
            missao: `[Placeholder] Adicione um botão no HTML e faça-o exibir um alerta ao ser clicado.`
          },
          {
            titulo: "Etapa 3: Manipulando o DOM",
            texto: `<p>[Placeholder] Explicação sobre <code>document.querySelector</code> e alteração de conteúdo da página via JavaScript.</p>`,
            missao: `[Placeholder] Use JavaScript para alterar o texto de um elemento da página.`
          }
        ]
      }
    ];

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

    const theoryContentEl = document.getElementById('theory-content');
    const moduleTitleEl = document.getElementById('module-title');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const progressBar = document.getElementById('progress-bar');

    // ---------- Índice do curso (novo) ----------
    const toggleIndiceBtn = document.getElementById('toggle-indice');
    const indicePanelEl = document.getElementById('indice-etapas');
    const indiceListaEl = document.getElementById('indice-lista');
    const indiceVoltarDashboardBtn = document.getElementById('indice-back-to-dashboard');
    const btnVoltarDashboard = document.getElementById('btn-voltar-dashboard');
    const URL_DASHBOARD = 'https://coding-loop.blogspot.com/p/dashboar_01809940765.html#dashboard';

    // Botão com o ícone do HTML + seta "<" no cabeçalho: sempre volta direto
    // para a dashboard (não abre mais o índice).
    btnVoltarDashboard.addEventListener('click', function () {
      window.location.href = URL_DASHBOARD;
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

    function tituloTextoPlano(html) {
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function renderIndice() {
      indiceListaEl.innerHTML = MODULOS.map(function (modulo, mIndex) {
        const itens = modulo.etapas.map(function (etapa, i) {
          const numero = i + 1;
          const ativo = mIndex === currentModuleIndex && numero === currentStep;
          const progresso = getProgressoEtapa(modulo.id, numero);

          const marcadorConcluido = progresso.concluida
            ? '<span class="indice-item-check" title="Etapa concluída">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg>' +
              '</span>'
            : '<span class="indice-item-check indice-item-check--pendente" title="Etapa ainda não concluída"></span>';

          const marcadorPercentual = (typeof progresso.percentual === 'number')
            ? '<span class="indice-item-percentual" title="Percentual de acerto do exercício">' + progresso.percentual + '%</span>'
            : '<span class="indice-item-percentual indice-item-percentual--vazio" title="Ainda sem avaliação">—</span>';

          return (
            '<div class="indice-item-linha">' +
              '<button type="button" class="indice-item' + (ativo ? ' is-current' : '') + '" data-modulo="' + mIndex + '" data-step="' + numero + '">' +
                '<span class="indice-item-numero">' + numero + '</span>' +
                '<span class="indice-item-texto">' + tituloTextoPlano(etapa.titulo) + '</span>' +
                marcadorConcluido +
                marcadorPercentual +
              '</button>' +
              '<button type="button" class="indice-item-reset" data-modulo="' + mIndex + '" data-step="' + numero + '" title="Refazer etapa" aria-label="Refazer etapa ' + numero + '">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.958 7.958 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L13 11h7V4l-2.35 2.35z"/></svg>' +
              '</button>' +
            '</div>'
          );
        }).join('');

        return (
          '<div class="indice-modulo-titulo">Módulo ' + (mIndex + 1) + ': ' + modulo.nome + '</div>' +
          itens
        );
      }).join('');
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

    indiceVoltarDashboardBtn.addEventListener('click', function () {
      window.location.href = URL_DASHBOARD;
    });

    indiceListaEl.addEventListener('click', function (e) {
      const resetBtn = e.target.closest('.indice-item-reset');
      if (resetBtn) {
        e.stopPropagation();
        const moduloReset = parseInt(resetBtn.getAttribute('data-modulo'), 10);
        const etapaReset = parseInt(resetBtn.getAttribute('data-step'), 10);
        const moduloIdReset = MODULOS[moduloReset].id;
        const confirmado = window.confirm('Refazer esta etapa? O progresso e o código salvo dela serão apagados.');
        if (!confirmado) return;
        resetarProgressoEtapa(moduloIdReset, etapaReset);
        renderIndice();
        return;
      }

      const item = e.target.closest('.indice-item');
      if (!item) return;

      const modulo = parseInt(item.getAttribute('data-modulo'), 10);
      const etapa = parseInt(item.getAttribute('data-step'), 10);

      if (modulo !== currentModuleIndex) {
        currentModuleIndex = modulo;
        currentStep = etapa;
        renderEtapas();
      } else {
        currentStep = etapa;
      }

      updateStepsUI();
      fecharIndice();
    });

    // Permite que outros scripts leiam a etapa atual sem depender da ordem
    // de carregamento dos <script>.
    window.getEtapaAtual = function () {
      return getEtapasDoModulo()[currentStep - 1];
    };

    function renderEtapas() {
      moduleTitleEl.textContent = getModuloAtual().nome;
      theoryContentEl.innerHTML = getEtapasDoModulo().map(function (etapa, i) {
        return (
          '<section class="step-card' + (i === 0 ? ' active' : '') + '" data-step="' + (i + 1) + '">' +
            '<h3>' + etapa.titulo + '</h3>' +
            etapa.texto +
            '<div class="task-box"><strong>Missão:</strong> ' + etapa.missao + '</div>' +
          '</section>'
        );
      }).join('');
    }

    function updateStepsUI() {
      document.querySelectorAll('.step-card').forEach(function (card) {
        card.classList.toggle('active', parseInt(card.dataset.step, 10) === currentStep);
      });

      prevBtn.disabled = currentStep === 1 && currentModuleIndex === 0;
      progressBar.style.width = (currentStep / getTotalEtapas()) * 100 + '%';

      // Se o índice estiver aberto, mantém o item ativo em sincronia com
      // avanços/retrocessos feitos pelos botões prev/next.
      if (!indicePanelEl.hidden) {
        renderIndice();
      }

      window.dispatchEvent(new CustomEvent('etapa:mudou', { detail: window.getEtapaAtual() }));

      salvarProgresso();
    }

    nextBtn.addEventListener('click', () => {
      const etapaConcluidaAgora = window.getEtapaAtual();
      const moduloIdAtual = getModuloAtual().id;
      const percentualCalculado = calcularPercentualEtapa(etapaConcluidaAgora);
      const dadosProgresso = { concluida: true };
      if (percentualCalculado !== null) dadosProgresso.percentual = percentualCalculado;
      setProgressoEtapa(moduloIdAtual, currentStep, dadosProgresso);

      if (currentStep < getTotalEtapas()) {
        currentStep++;
        updateStepsUI();
      } else if (currentModuleIndex < MODULOS.length - 1) {
        currentModuleIndex++;
        currentStep = 1;
        renderEtapas();
        updateStepsUI();
      } else {
        alert('Parabéns! Você concluiu todos os módulos do curso.');
      }
    });

    prevBtn.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateStepsUI();
      } else if (currentModuleIndex > 0) {
        currentModuleIndex--;
        currentStep = MODULOS[currentModuleIndex].etapas.length;
        renderEtapas();
        updateStepsUI();
      }
    });

    // ==========================================================
    // SALVAMENTO DE PROGRESSO (Firestore)
    // Duas coisas diferentes ficavam juntas na chave antiga do
    // localStorage; agora cada uma vai pro lugar que faz sentido
    // no modelo de dados do Firestore (ver api.js):
    //   - "onde o aluno está" (módulo/etapa atual) -> perfil do
    //     usuário (users/{uid}.idePosition), via CL.auth.updateUser.
    //   - código digitado em cada etapa -> um documento por etapa
    //     em users/{uid}/exercises/{moduloId:step} (CL.api.saveExercise/
    //     getExercise), carregado inteiro no boot para exerciciosCache.
    // ==========================================================

    // Preenchido no boot (bootIde) a partir de CL.api.listExercises().
    let exerciciosCache = exerciciosCarregado || {};

    // Grava só a posição atual (módulo + etapa) no perfil. "Fire and
    // forget": CL.auth.updateUser já trata falhas internamente e não
    // precisa travar a navegação do aluno por causa disso.
    function salvarProgresso() {
      if (!CL.auth || typeof CL.auth.updateUser !== 'function') return;
      CL.auth.updateUser({
        idePosition: { moduloId: getModuloAtual().id, etapa: currentStep }
      });
    }

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

    restaurarProgressoSalvo(posicaoCarregada);
    renderEtapas();
    updateStepsUI();
  } // fim de iniciarTeoria
  // Chamada pelo bootIde() (rodapé deste arquivo) só depois que o Ace
  // (window.ace) estiver carregado E os dados do Firestore já tiverem
  // chegado (iniciarTeoria já rodou, então window.getCodigoInicialParaEditor
  // já reflete o código salvo do aluno, se houver).
  function iniciarEditorDeCodigo() {
      function iniciar() {
        var htmlEditor, cssEditor, jsEditor, debounceTimeout, itemArrastado = null;

        var mainWindowContainer = document.getElementById('main-window-container');
        var contentWrapper = document.getElementById('window-content-wrapper');
        var editorsContainer = document.getElementById('editors-container');
        var previewContainer = document.getElementById('preview-container');
        var btnPreviewLayout = document.getElementById('btn-preview-layout');
        var btnPreviewMaximize = document.getElementById('btn-preview-maximize');
        var iconPreviewMax = document.getElementById('icon-preview-max');
        var iconPreviewRestore = document.getElementById('icon-preview-restore');
        var btnRun = document.getElementById('btn-run');
        var btnImportFile = document.getElementById('btn-import-file');
        var btnExportFile = document.getElementById('btn-export-file');
        var btnSaveFile = document.getElementById('btn-save-file');
        var saveBtnDot = document.getElementById('save-btn-dot');
        var saveToastEl = document.getElementById('save-toast');
        var inputImportFile = document.getElementById('input-import-file');
        var btnIdeCollapse = document.getElementById('btn-ide-collapse');
        var iconCollapse = document.getElementById('icon-collapse');
        var iconExpand = document.getElementById('icon-expand');
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

        function atualizarAlturaReal() {
          var altura = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
          document.documentElement.style.setProperty('--ide-vh', altura + 'px');
        }

        function criarEditor(id, modo, valorInicial) {
          var editor = ace.edit(id);
          editor.setTheme('ace/theme/solarized_dark');
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

        function carregarCodigoDaEtapa() {
          var codigo = (window.getCodigoInicialParaEditor && window.getCodigoInicialParaEditor()) || {};
          if (codigo.html !== undefined) htmlEditor.setValue(codigo.html, -1);
          if (codigo.css !== undefined) cssEditor.setValue(codigo.css, -1);
          if (codigo.js !== undefined) jsEditor.setValue(codigo.js, -1);
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
          if (saveBtnDot) saveBtnDot.classList.add('is-visible');
        }

        function marcarComoSalvo() {
          if (saveBtnDot) saveBtnDot.classList.remove('is-visible');
        }

        function salvarCodigoAgora() {
          if (!window.salvarCodigoDoAluno) return;
          var resultado = window.salvarCodigoDoAluno({
            html: htmlEditor.getValue(),
            css: cssEditor.getValue(),
            js: jsEditor.getValue()
          });
          // salvarCodigoDoAluno agora grava no Firestore (CL.api.saveExercise)
          // e retorna uma Promise. Só marca "salvo" quando a gravação
          // realmente terminar; se falhar, o dot continua indicando "não
          // salvo" e o próprio CL.api já mostra um toast de erro.
          if (resultado && typeof resultado.then === 'function') {
            resultado.then(marcarComoSalvo).catch(function () {});
          } else {
            marcarComoSalvo();
          }
        }

        var salvarCodigoTimeout = null;
        function agendarSalvamentoCodigo() {
          marcarComoNaoSalvo();
          clearTimeout(salvarCodigoTimeout);
          salvarCodigoTimeout = setTimeout(salvarCodigoAgora, 500);
        }

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

          var prefixo = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<style>\n' + css + '\nbody { margin-top: 0 !important; padding-top: 0 !important; }\n</style>\n</head>\n<body>\n' + html + '\n<script>\n' + handlerErros;

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

          clearTimeout(timeoutErrosExecucao);
          timeoutErrosExecucao = null;
          filaErrosExecucao = [];
          anotacoesExecucaoJS = [];
          mesclarAnotacoesExecucaoJS();
          finalizarAtualizacaoJS();

          var novoIframe = document.createElement('iframe');
          novoIframe.className = 'preview-iframe';
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
          alternarIcones(iconCollapse, iconExpand, !IDE_ABERTO);

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

          setTimeout(redimensionarEditores, 50);
        }

        [htmlEditor, cssEditor, jsEditor].forEach(function (editor) {
          editor.on('change', agendarAtualizacaoPreview);
          editor.on('change', agendarSalvamentoCodigo);
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

        btnSaveFile.addEventListener('click', function () {
          clearTimeout(salvarCodigoTimeout);
          salvarCodigoAgora();
          mostrarToast('Progresso salvo!');
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
            clearTimeout(salvarCodigoTimeout);
            salvarCodigoAgora();
            mostrarToast('Arquivo importado e separado em HTML/CSS/JS.');
          };
          reader.readAsText(file);
          inputImportFile.value = '';
        });

        btnExportFile.addEventListener('click', function () {
          var blob = new Blob([montarCodigoPreview()], { type: 'text/html;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = 'codigo-editado.html';
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          mostrarToast('Código exportado!');
        });

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

          setTimeout(redimensionarEditores, 150);
        });

        btnPreviewMaximize.addEventListener('click', function () {
          abrirJanela();
          var maximizado = contentWrapper.classList.toggle('preview-maximized');
          prefPreviewMaximized = maximizado;
          btnPreviewMaximize.classList.toggle('is-active', maximizado);
          btnPreviewMaximize.setAttribute('aria-pressed', String(maximizado));
          alternarIcones(iconPreviewMax, iconPreviewRestore, maximizado);

          setTimeout(redimensionarEditores, 150);
        });

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

    var progressoCarregado = {};
    var exerciciosCarregado = {};
    var posicaoCarregada = null;

    try {
      var resultados = await Promise.all([
        CL.api.listProgress(),
        CL.api.listExercises(),
        CL.api.getProfile()
      ]);
      progressoCarregado = resultados[0] || {};
      exerciciosCarregado = resultados[1] || {};
      posicaoCarregada = (resultados[2] && resultados[2].idePosition) || null;
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

      var arrastando = false;
      var vertical = false;
      var frameAgendado = null;

      function aplicarTamanho(px) {
        theoryPane.style.flexGrow = '0';
        theoryPane.style.flexShrink = '0';
        theoryPane.style.flexBasis = px + 'px';
        theoryPane.style.minWidth = '0';
        theoryPane.style.maxWidth = 'none';
        theoryPane.style.width = vertical ? '' : px + 'px';
        theoryPane.style.height = vertical ? px + 'px' : '';

        window.dispatchEvent(new Event('ide:resize'));
      }

      function calcularPosicao(clientX, clientY) {
        var rect = root.getBoundingClientRect();
        var resizerTamanho = vertical ? resizer.offsetHeight : resizer.offsetWidth;
        var total = vertical ? rect.height : rect.width;
        var pos = vertical ? (clientY - rect.top) : (clientX - rect.left);
        var maxTheory = total - MIN_IDE - resizerTamanho;
        return Math.max(MIN_THEORY, Math.min(pos, maxTheory));
      }

      function iniciarArraste(clientX, clientY) {
        if (root.classList.contains('ide-recolhido')) return;
        arrastando = true;
        vertical = getComputedStyle(root).flexDirection === 'column';
        resizer.classList.add('is-dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
      }

      function moverArraste(clientX, clientY) {
        if (!arrastando) return;
        if (frameAgendado) return;
        frameAgendado = requestAnimationFrame(function () {
          frameAgendado = null;
          aplicarTamanho(calcularPosicao(clientX, clientY));
        });
      }

      function finalizarArraste() {
        if (!arrastando) return;
        arrastando = false;
        resizer.classList.remove('is-dragging');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }

      resizer.addEventListener('mousedown', function (e) {
        iniciarArraste(e.clientX, e.clientY);
        e.preventDefault();
      });

      document.addEventListener('mousemove', function (e) {
        moverArraste(e.clientX, e.clientY);
      });

      document.addEventListener('mouseup', finalizarArraste);

      resizer.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        if (t) iniciarArraste(t.clientX, t.clientY);
      }, { passive: true });

      document.addEventListener('touchmove', function (e) {
        if (!arrastando) return;
        var t = e.touches[0];
        if (t) {
          moverArraste(t.clientX, t.clientY);
          e.preventDefault();
        }
      }, { passive: false });

      document.addEventListener('touchend', finalizarArraste);
    })();
