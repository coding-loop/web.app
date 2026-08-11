/* =====================================================
   TRILHA.JS
   Motor de renderização da "trilha do curso": uma sequência
   de níveis (bolhas numeradas, com o logo da linguagem)
   conectados por um caminho — estilo jogo/fases.

   Usado em dois lugares, com o MESMO visual:
     - Dashboard (#cl-page-course): 1 nível = 1 Módulo.
     - IDE (☰ menu do índice):      1 nível = 1 Etapa.

   Não decide o que é "concluído"/"bloqueado" — isso vem
   pronto em cada nó (ver CL.curso.buildModuloNodes /
   buildEtapaNodes em curso-data.js). Este arquivo só desenha.

   Depende de: nada (pode carregar em qualquer ordem, só
   precisa existir antes do primeiro CL.trilha.render()).
   ===================================================== */
(function () {
  'use strict';

  window.CL = window.CL || {};
  var CL = window.CL;

  CL.trilha = CL.trilha || {};

  /* SVGs locais, sem número de versão. O número do módulo é desenhado
     separadamente por .trilha-node-numero, logo escala para qualquer curso. */
  CL.trilha.LOGOS = {
    html: 'assets/images/icons/html.svg',
    css: 'assets/images/icons/css.svg',
    js: 'assets/images/icons/javascript.svg'
  };

  function escapeAttr(texto) {
    return String(texto || '').replace(/"/g, '&quot;');
  }

  /* Converte a ordem do módulo em uma posição numa curva de Hilbert.
     A curva dobra em escalas pequenas e grandes, percorre as quatro
     direções e nunca cria salto: vizinhos sempre estão a um passo. */
  function pontoHilbert(indice, ordem) {
    var tamanho = Math.pow(2, ordem);
    var x = 0;
    var y = 0;
    var t = indice;

    for (var passo = 1; passo < tamanho; passo *= 2) {
      var rx = 1 & Math.floor(t / 2);
      var ry = 1 & (t ^ rx);

      if (ry === 0) {
        if (rx === 1) {
          x = passo - 1 - x;
          y = passo - 1 - y;
        }
        var temporario = x;
        x = y;
        y = temporario;
      }

      x += passo * rx;
      y += passo * ry;
      t = Math.floor(t / 4);
    }

    return { x: x, y: y };
  }

  /* Rio de três faixas: começa no alto à esquerda, desce em curvas de
     serpente e termina no canto inferior esquerdo. Os dois últimos nós
     fecham o percurso para a esquerda sem aproximar o fim do começo. */
  function pontoRio(indice) {
    if (indice < 498) {
      var linha = Math.floor(indice / 3);
      var posicao = indice % 3;
      return {
        x: linha % 2 === 0 ? posicao : 2 - posicao,
        y: linha
      };
    }
    if (indice === 498) return { x: 1, y: 166 };
    return { x: 0, y: 167 };
  }

  function nodeHTML(node, index, options) {
    var logoUrl = CL.trilha.LOGOS[node.linguagem] || '';
    var statusClass = 'trilha-node--' + (node.status || 'available');
    var gradeTriangular = options && options.layout === 'triangular';
    var trilhaSerpente = options && options.layout === 'serpente';
    var trilhaRio = options && options.layout === 'rio';
    var trilhaQuatroColunas = options && options.layout === 'quatro-colunas';
    var trilhaVinteUm = options && options.layout === 'vinte-um-por-tela';
    var colunas = Math.max(1, Number(options && options.columns) || 10);
    var indiceLinha = Math.floor(index / colunas);
    var linha = indiceLinha + 1;
    var posicaoNaLinha = index % colunas;
    /* Percurso em serpentina: linhas pares vão para a direita e linhas
       ímpares voltam para a esquerda. Isso mantém 10→11, 20→21 etc.
       tão próximos quanto quaisquer dois módulos vizinhos. */
    var coluna = indiceLinha % 2 === 0
      ? posicaoNaLinha + 1
      : colunas - posicaoNaLinha;

    if (trilhaSerpente && options.order) {
      var ordemHilbert = Math.max(1, Number(options.order) || 5);
      var ponto = pontoHilbert(index, ordemHilbert);
      colunas = Math.pow(2, ordemHilbert);
      coluna = ponto.x + 1;
      linha = ponto.y + 1;
    }

    if (trilhaRio) {
      var pontoDoRio = pontoRio(index);
      colunas = 3;
      coluna = pontoDoRio.x + 1;
      linha = pontoDoRio.y + 1;
      indiceLinha = pontoDoRio.y;
    }

    if (trilhaQuatroColunas) {
      colunas = 4;
      indiceLinha = Math.floor(index / colunas);
      linha = indiceLinha + 1;
      posicaoNaLinha = index % colunas;
      // A linha seguinte retorna para manter 4→5, 8→9 etc. próximos.
      coluna = indiceLinha % 2 === 0 ? posicaoNaLinha + 1 : colunas - posicaoNaLinha;
    }

    if (trilhaVinteUm) {
      colunas = 7;
      var pagina = Math.floor(index / 21);
      var indiceNaPagina = index % 21;
      indiceLinha = Math.floor(indiceNaPagina / colunas);
      linha = indiceLinha + 1;
      posicaoNaLinha = indiceNaPagina % colunas;
      coluna = indiceLinha % 2 === 0 ? posicaoNaLinha + 1 : colunas - posicaoNaLinha;
    }

    /* Zigue-zague: alterna pra cima/baixo por CLASSE (não por
       nth-child), porque o SVG do caminho (ver desenharCaminho())
       também é filho de .trilha-caminho — se dependesse de
       nth-child, o SVG bagunçaria a contagem par/ímpar. */
    var onda = (index % 2 === 0) ? 'trilha-item--sobe' : 'trilha-item--desce';
    var classePosicao = trilhaVinteUm
      ? 'trilha-item--vinte-um'
      : (trilhaQuatroColunas
      ? 'trilha-item--quatro-colunas'
      : (trilhaRio
      ? 'trilha-item--rio'
      : (trilhaSerpente
      ? 'trilha-item--serpente'
      : (gradeTriangular ? 'trilha-item--triangular' : onda))));
    var estiloPosicao = trilhaVinteUm
      ? ' style="--trilha-pagina-y:' + (pagina * 100) + 'vh;--trilha-linha-y:' + (100 + (indiceLinha * 136)) + 'px;--trilha-x:' + (6 + ((coluna - 1) * (88 / 6))).toFixed(4) + '%"'
      : (trilhaQuatroColunas
      ? ' style="--trilha-coluna:' + coluna + ';--trilha-linha:' + linha + '"'
      : (trilhaRio
      ? ' style="--trilha-coluna:' + coluna + ';--trilha-linha:' + linha + ';--trilha-deslocamento:' + (indiceLinha % 2 === 1 ? 'var(--trilha-meio-passo)' : '0px') + '"'
      : (trilhaSerpente
      ? ' style="--trilha-coluna:' + coluna + ';--trilha-linha:' + linha + ';--trilha-deslocamento:' + (indiceLinha % 2 === 1 ? 'var(--trilha-meio-passo)' : '0px') + '"'
      : (gradeTriangular
      ? ' style="--trilha-coluna:' + coluna + ';--trilha-linha:' + linha + ';--trilha-deslocamento:' + (indiceLinha % 2 === 1 ? 60 : 0) + 'px"'
      : ''))));

    var posicoesDoCurso = CL.trilha.POSICOES && CL.trilha.POSICOES[options && options.cursoId];
    var ajuste = posicoesDoCurso && posicoesDoCurso[index];
    if (ajuste) {
      /* A string sempre termina na aspas do atributo style. Acrescentar
         antes dela preserva o HTML válido e as variáveis CSS dos pontos. */
      estiloPosicao = estiloPosicao.slice(0, -1) +
        ';--trilha-ajuste-x:' + ajuste.x + 'px;--trilha-ajuste-y:' + ajuste.y + 'px"';
    }

    var check = (node.status === 'completed')
      ? '<span class="trilha-node-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg></span>'
      : '';

    var percentual = (typeof node.percentual === 'number')
      ? '<span class="trilha-node-percentual">' + node.percentual + '%</span>'
      : '';

    var resetBtn = node.showReset
      ? '<button type="button" class="trilha-node-reset" data-trilha-reset data-id="' + escapeAttr(node.id) + '" title="Refazer" aria-label="Refazer nível">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.958 7.958 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L13 11h7V4l-2.35 2.35z"/></svg>' +
        '</button>'
      : '';

    return (
      '<div class="trilha-item ' + classePosicao + '" data-trilha-item data-index="' + index + '"' + estiloPosicao + '>' +
        '<div class="trilha-node-col">' +
          '<button type="button" class="trilha-node ' + statusClass + '" data-trilha-node data-id="' + escapeAttr(node.id) + '" title="' + escapeAttr(node.titulo) + '">' +
            (logoUrl ? '<img class="trilha-node-logo" src="' + logoUrl + '" alt="" aria-hidden="true"/>' : '') +
            '<span class="trilha-node-numero">' + node.numero + '</span>' +
            check +
          '</button>' +
          '<span class="trilha-node-titulo">' + node.titulo + '</span>' +
          '<div class="trilha-node-footer">' + percentual + resetBtn + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* Desenha (ou redesenha) o SVG com a linha curva que liga o
     CENTRO de cada bolinha, na ordem em que elas aparecem — é
     isso que dá a impressão de "caminho" ligando os módulos,
     acompanhando o zigue-zague de verdade (não uma barra reta
     fixa como antes). Precisa ser recalculado sempre que a
     trilha for redesenhada ou a tela for redimensionada, porque
     as posições dos nós mudam com a largura disponível. */
  function desenharCaminho(container) {
    var caminho = container.querySelector('.trilha-caminho');
    var svg = container.querySelector('.trilha-path-svg');
    if (!caminho || !svg) return;

    var itens = Array.prototype.slice.call(caminho.querySelectorAll('[data-trilha-item]'));

    var caminhoRect = caminho.getBoundingClientRect();

    // Página ainda escondida (display:none) ou sem nós -> nada pra desenhar.
    if (!caminhoRect.width || itens.length < 2) {
      svg.innerHTML = '';
      return;
    }

    svg.setAttribute('width', caminhoRect.width);
    svg.setAttribute('height', caminhoRect.height);
    svg.setAttribute('viewBox', '0 0 ' + caminhoRect.width + ' ' + caminhoRect.height);

    var pontos = itens.map(function (item) {
      var bolinha = item.querySelector('.trilha-node');
      var r = (bolinha || item).getBoundingClientRect();
      return {
        x: (r.left + r.width / 2) - caminhoRect.left,
        y: (r.top + r.height / 2) - caminhoRect.top
      };
    });

    var svgns = 'http://www.w3.org/2000/svg';
    var fragmento = document.createDocumentFragment();

    for (var i = 1; i < pontos.length; i++) {
      var a = pontos[i - 1];
      var b = pontos[i];

      // Curva em "S" suave passando pelo ponto médio, em vez de
      // linha reta — fica com cara de trilha sinuosa de verdade.
      var mx = (a.x + b.x) / 2;
      var d = 'M ' + a.x + ' ' + a.y +
              ' Q ' + mx + ' ' + a.y + ' ' + mx + ' ' + ((a.y + b.y) / 2) +
              ' Q ' + mx + ' ' + b.y + ' ' + b.x + ' ' + b.y;

      // O trecho fica "andado" (preenchido) se o nó de CHEGADA já
      // estiver concluído ou for o nó atual — mesmo critério que o
      // antigo node.connectorFilled usava.
      var bolinhaDestino = itens[i].querySelector('.trilha-node');
      var andado = bolinhaDestino && (
        bolinhaDestino.classList.contains('trilha-node--completed') ||
        bolinhaDestino.classList.contains('trilha-node--current')
      );

      var path = document.createElementNS(svgns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'trilha-path-segmento' + (andado ? ' is-andado' : ''));
      fragmento.appendChild(path);
    }

    svg.innerHTML = '';
    svg.appendChild(fragmento);
  }

  function atualizarTituloFixo(container, options) {
    var pagina = container.closest('#cl-page-course');
    if (!pagina) return;

    var titulo = pagina.querySelector('.trilha-titulo-fixo');
    var imagensTitulo = {
      html: 'assets/images/trilha-titulo-bg-html.png',
      css: 'assets/images/trilha-titulo-bg-css.png',
      js: 'assets/images/trilha-titulo-bg-js.png'
    };
    var imagemTitulo = options && imagensTitulo[options.cursoId];

    if (!imagemTitulo) {
      if (titulo) titulo.remove();
      return;
    }

    if (!titulo) {
      titulo = document.createElement('div');
      titulo.className = 'trilha-titulo-fixo';
      titulo.setAttribute('aria-hidden', 'true');
      pagina.appendChild(titulo);
    }

    titulo.innerHTML = '<img src="' + imagemTitulo + '" alt="">';
  }

  /* Redesenha o caminho de TODOS os containers já renderizados
     nesta página (normalmente só existe um por vez — Dashboard OU
     IDE — mas não custa nada cobrir os dois). Debounced pra não
     recalcular a cada pixel enquanto o usuário arrasta a borda da
     janela. */
  var containersAtivos = [];
  var resizeTimer = null;

  function calcularGradeSerpente(container) {
    var largura = Math.max(container.clientWidth || 0, 360);
    var margem = 20;
    var larguraNo = 96;
    var passoDesejado = 168;
    var areaUtil = Math.max(1, largura - (margem * 2) - larguraNo);
    /* A meia coluna extra comporta a linha triangular deslocada. */
    var colunas = Math.max(3, Math.ceil((areaUtil / passoDesejado) + 0.5));
    var passo = areaUtil / (colunas - 0.5);

    return {
      colunas: colunas,
      passo: passo,
      meioPasso: passo / 2,
      altura: passo * Math.sqrt(3) / 2
    };
  }

  function agendarRedesenho() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      containersAtivos.forEach(function (container) {
        if (container.isConnected) {
          if (container._trilhaAutoColunas && container._trilhaSourceOptions) {
            CL.trilha.render(container, container._trilhaSourceOptions);
          } else {
            desenharCaminho(container);
          }
        }
      });
    }, 120);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', agendarRedesenho);
  }

  /* CL.trilha.render(container, {
       nodes: [...],
       onSelect: function (nodeId) {},
       onReset:  function (nodeId) {}   // opcional
     }) */
  CL.trilha.render = function (container, options) {
    if (!container) return;
    options = options || {};
    atualizarTituloFixo(container, options);
    var optionsOriginais = options;
    var usaColunasAutomaticas = options.layout === 'serpente' && options.columns === 'auto';

    if (usaColunasAutomaticas) {
      var grade = calcularGradeSerpente(container);
      options = Object.assign({}, options, {
        columns: grade.colunas,
        passoX: grade.passo,
        meioPasso: grade.meioPasso,
        passoY: grade.altura
      });
    }

    var nodes = options.nodes || [];

    var classeLayout = options.layout === 'vinte-um-por-tela'
      ? ' trilha-caminho--vinte-um'
      : (options.layout === 'quatro-colunas'
      ? ' trilha-caminho--quatro-colunas'
      : (options.layout === 'rio'
      ? ' trilha-caminho--rio'
      : (options.layout === 'serpente'
      ? ' trilha-caminho--serpente'
      : (options.layout === 'triangular' ? ' trilha-caminho--triangular' : ''))));
    var estiloLayout = options.layout === 'vinte-um-por-tela'
      ? ' style="height:' + (Math.max(1, Math.ceil(nodes.length / 21)) * 100) + 'vh"'
      : (options.layout === 'quatro-colunas'
      ? ' style="--trilha-colunas:4"'
      : (options.layout === 'rio'
      ? ' style="--trilha-colunas:3"'
      : (options.layout === 'serpente'
      ? ' style="--trilha-colunas:' + (Math.max(2, Number(options.columns) || 4)) +
        ';--trilha-passo-x:' + (Number(options.passoX) || 168) + 'px' +
        ';--trilha-meio-passo:' + (Number(options.meioPasso) || 84) + 'px' +
        ';--trilha-passo-y:' + (Number(options.passoY) || 145.49) + 'px"'
      : (options.layout === 'triangular'
      ? ' style="--trilha-colunas:' + (Math.max(1, Number(options.columns) || 10)) + '"'
      : ''))));

    container.innerHTML = '<div class="trilha-caminho' + classeLayout + '"' + estiloLayout + '>' +
      '<svg class="trilha-path-svg" aria-hidden="true"></svg>' +
      nodes.map(function (node, index) { return nodeHTML(node, index, options); }).join('') +
      '</div>';

    container._trilhaOptions = options;
    container._trilhaSourceOptions = optionsOriginais;
    container._trilhaAutoColunas = usaColunasAutomaticas;

    if (containersAtivos.indexOf(container) === -1) {
      containersAtivos.push(container);
    }

    // requestAnimationFrame garante que o navegador já terminou o
    // layout (posição/tamanho reais das bolinhas) antes de medir.
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(function () {
        desenharCaminho(container);
      });
    } else {
      desenharCaminho(container);
    }

    if (!container._trilhaBound) {
      container.addEventListener('click', function (e) {
        var opts = container._trilhaOptions || {};

        var resetBtn = e.target.closest('[data-trilha-reset]');
        if (resetBtn) {
          e.stopPropagation();
          if (typeof opts.onReset === 'function') {
            opts.onReset(resetBtn.getAttribute('data-id'));
          }
          return;
        }

        var node = e.target.closest('[data-trilha-node]');
        if (node && typeof opts.onSelect === 'function') {
          opts.onSelect(node.getAttribute('data-id'));
        }
      });
      container._trilhaBound = true;
    }
  };

  /* Editor de posições para uso pelo DevTools (F12). As coordenadas ficam
     apenas na memória do navegador até serem exportadas e salvas no arquivo
     posicoes-trilha.js. Os módulos são numerados a partir de 1 na API. */
  var posicoesOriginais = JSON.parse(JSON.stringify(CL.trilha.POSICOES || {}));

  function redesenharCurso(cursoId) {
    containersAtivos.forEach(function (container) {
      var opcoes = container._trilhaSourceOptions;
      if (container.isConnected && opcoes && opcoes.cursoId === cursoId) {
        CL.trilha.render(container, opcoes);
      }
    });
  }

  function validarPosicoes(valor) {
    if (!Array.isArray(valor)) throw new Error('As posições devem ser uma lista JSON.');
    return valor.map(function (ponto, indice) {
      if (!ponto || !isFinite(Number(ponto.x)) || !isFinite(Number(ponto.y))) {
        throw new Error('Posição inválida no módulo ' + (indice + 1) + '. Use {"x": número, "y": número}.');
      }
      return { x: Number(ponto.x), y: Number(ponto.y) };
    });
  }

  CL.trilha.editor = {
    mover: function (cursoId, numeroModulo, x, y) {
      var posicoes = CL.trilha.POSICOES && CL.trilha.POSICOES[cursoId];
      var indice = Number(numeroModulo) - 1;
      if (!posicoes || indice < 0 || indice >= posicoes.length) {
        throw new Error('Módulo ou curso inválido. Ex.: mover("html", 1, -40, 30).');
      }
      if (!isFinite(Number(x)) || !isFinite(Number(y))) {
        throw new Error('x e y precisam ser números em pixels.');
      }
      posicoes[indice] = { x: Number(x), y: Number(y) };
      redesenharCurso(cursoId);
      return posicoes[indice];
    },

    deslocar: function (cursoId, numeroModulo, deltaX, deltaY) {
      var posicoes = CL.trilha.POSICOES && CL.trilha.POSICOES[cursoId];
      var indice = Number(numeroModulo) - 1;
      if (!posicoes || !posicoes[indice]) throw new Error('Módulo ou curso inválido.');
      return this.mover(cursoId, numeroModulo,
        posicoes[indice].x + Number(deltaX || 0),
        posicoes[indice].y + Number(deltaY || 0));
    },

    aplicarJSON: function (cursoId, json) {
      var dados = typeof json === 'string' ? JSON.parse(json) : json;
      var lista = dados && dados.posicoes ? dados.posicoes : dados;
      CL.trilha.POSICOES[cursoId] = validarPosicoes(lista);
      redesenharCurso(cursoId);
      return CL.trilha.POSICOES[cursoId];
    },

    exportarJSON: function (cursoId) {
      var posicoes = CL.trilha.POSICOES && CL.trilha.POSICOES[cursoId];
      if (!posicoes) throw new Error('Curso inválido: ' + cursoId + '.');
      return JSON.stringify({ cursoId: cursoId, posicoes: posicoes }, null, 2);
    },

    restaurar: function (cursoId) {
      if (!posicoesOriginais[cursoId]) throw new Error('Não há posições originais para ' + cursoId + '.');
      CL.trilha.POSICOES[cursoId] = JSON.parse(JSON.stringify(posicoesOriginais[cursoId]));
      redesenharCurso(cursoId);
    },

    ativarArraste: function (cursoId) {
      var container = document.querySelector('.trilha-container[data-curso="' + cursoId + '"]');
      if (!container) throw new Error('Abra a trilha do curso ' + cursoId + ' antes de ativar o arraste.');
      if (container._trilhaEditorArraste) return 'O arraste já está ativo.';
      container._trilhaEditorArraste = true;

      function ligar(item) {
        if (item._trilhaEditorArrasteLigado) return;
        item._trilhaEditorArrasteLigado = true;
        item.style.cursor = 'grab';
        item.addEventListener('pointerdown', function (evento) {
          if (evento.button !== 0) return;
          evento.preventDefault();
          var indice = Number(item.getAttribute('data-index'));
          var posicoes = CL.trilha.POSICOES[cursoId];
          var base = posicoes[indice];
          if (!base) return;
          var inicioX = evento.clientX;
          var inicioY = evento.clientY;
          item.setPointerCapture(evento.pointerId);
          item.style.cursor = 'grabbing';

          function mover(eventoMover) {
            var x = base.x + eventoMover.clientX - inicioX;
            var y = base.y + eventoMover.clientY - inicioY;
            posicoes[indice] = { x: x, y: y };
            /* Preserva o transform do CSS: só muda as variáveis manuais. */
            item.style.setProperty('--trilha-ajuste-x', x + 'px');
            item.style.setProperty('--trilha-ajuste-y', y + 'px');
          }

          function soltar() {
            item.style.cursor = 'grab';
            item.removeEventListener('pointermove', mover);
            item.removeEventListener('pointerup', soltar);
            item.removeEventListener('pointercancel', soltar);
            /* Refaz conectores, centralização e folgas depois do ajuste. */
            redesenharCurso(cursoId);
          }

          item.addEventListener('pointermove', mover);
          item.addEventListener('pointerup', soltar);
          item.addEventListener('pointercancel', soltar);
        });
      }

      function ligarTodos() {
        Array.prototype.forEach.call(container.querySelectorAll('[data-trilha-item]'), ligar);
      }

      ligarTodos();
      var observador = new MutationObserver(ligarTodos);
      observador.observe(container, { childList: true, subtree: true });
      container._trilhaEditorArrasteParar = function () {
        observador.disconnect();
        container._trilhaEditorArraste = false;
      };
      return 'Arraste ativo. Ao terminar, use CL.trilha.editor.exportarJSON("' + cursoId + '").';
    },

    desativarArraste: function (cursoId) {
      var container = document.querySelector('.trilha-container[data-curso="' + cursoId + '"]');
      if (container && container._trilhaEditorArrasteParar) container._trilhaEditorArrasteParar();
    }
  };

  /* Rola até o nível informado e dá um destaque rápido —
     usado quando se chega na trilha já mirando um nível
     específico (ex.: veio do ícone HTML/CSS/JS da Dashboard). */
  CL.trilha.destacar = function (container, nodeId) {
    if (!container || !nodeId) return;
    var alvo = container.querySelector('[data-trilha-node][data-id="' + nodeId.replace(/"/g, '') + '"]');
    if (!alvo) return;
    // A trilha é vertical. scrollIntoView pode movimentar ancestrais na
    // horizontal; calculamos somente a rolagem vertical do seu container.
    var area = container.getBoundingClientRect();
    var alvoRect = alvo.getBoundingClientRect();
    container.scrollLeft = 0;
    container.scrollTo({
      top: Math.max(0, container.scrollTop + alvoRect.top - area.top -
        ((container.clientHeight - alvoRect.height) / 2)),
      behavior: 'smooth'
    });
    alvo.classList.add('is-destacado');
    setTimeout(function () { alvo.classList.remove('is-destacado'); }, 1);
  };

})();
