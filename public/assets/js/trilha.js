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
    'programming-logic': 'assets/images/icons.svg/logica-de-programacao.svg?v=20260829-4',
    html: 'assets/images/icons.svg/logo-html.svg',
    css: 'assets/images/icons.svg/logo-css.svg',
    js: 'assets/images/icons.svg/logo-javascript.svg'
  };

  function escapeAttr(texto) {
    return String(texto || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  /* Motor comum das trilhas dos cursos. Cada bloco possui 10 segmentos:
     7 horizontais em três grupos de 1 a 3 unidades e três descidas D1.
     Cada curso usa uma sequência própria; os blocos são equilibrados aos
     pares para compensar os desvios à direita e à esquerda do centro. */
  var CICLOS_TRILHA = {
    'programming-logic': [
      ['R', [2, 3, 2]], ['L', [3, 3, 1]], ['R', [2, 2, 3]], ['L', [3, 2, 2]],
      ['R', [1, 3, 3]], ['L', [2, 3, 2]], ['R', [3, 3, 1]], ['L', [1, 3, 3]],
      ['R', [3, 2, 2]], ['L', [2, 2, 3]], ['R', [2, 3, 2]], ['L', [3, 3, 1]]
    ],
    html: [
      ['R', [3, 3, 1]], ['L', [2, 3, 2]], ['R', [3, 2, 2]], ['L', [2, 2, 3]],
      ['R', [2, 3, 2]], ['L', [1, 3, 3]], ['R', [1, 3, 3]], ['L', [3, 3, 1]],
      ['R', [2, 2, 3]], ['L', [3, 2, 2]], ['R', [3, 3, 1]], ['L', [2, 3, 2]]
    ],
    css: [
      ['R', [1, 3, 3]], ['L', [3, 3, 1]], ['R', [2, 3, 2]], ['L', [1, 3, 3]],
      ['R', [3, 2, 2]], ['L', [2, 2, 3]], ['R', [3, 3, 1]], ['L', [2, 3, 2]],
      ['R', [2, 2, 3]], ['L', [3, 2, 2]], ['R', [1, 3, 3]], ['L', [3, 3, 1]]
    ],
    js: [
      ['R', [2, 2, 3]], ['L', [3, 2, 2]], ['R', [3, 3, 1]], ['L', [1, 3, 3]],
      ['R', [2, 3, 2]], ['L', [3, 3, 1]], ['R', [1, 3, 3]], ['L', [2, 3, 2]],
      ['R', [3, 2, 2]], ['L', [2, 2, 3]], ['R', [3, 3, 1]], ['L', [1, 3, 3]]
    ]
  };

  /* Distância fixa entre módulos de LogProg. Quando não há largura para
     acomodar um passo lateral, aquele passo é encaminhado para baixo em vez
     de aproximar os módulos ou criar rolagem horizontal. */
  var PASSO_HORIZONTAL_LOGPROG = 255;
  var PASSO_VERTICAL_LOGPROG = 170;
  var MARGEM_LATERAL_LOGPROG = 40;
  var MARGEM_SUPERIOR_MODULOS = 240;
  var MARGEM_SUPERIOR_ETAPAS = 24;

  function limiteLateralLogProg(largura) {
    var espacoDeUmLado = (Number(largura) || 0) / 2 - MARGEM_LATERAL_LOGPROG;
    return Math.max(0, Math.min(3, Math.floor(espacoDeUmLado / PASSO_HORIZONTAL_LOGPROG)));
  }

  /* Geometria-base compartilhada. Os dois chamadores abaixo mantêm a
     configuração dos módulos e das etapas separada, para que uma não
     herde os ajustes visuais da outra. */
  function pontoBaseLogProg(indice, limiteLateral, cursoId) {
    var ponto = { x: 0, y: 0 };
    var segmentosGerados = 0;
    var ciclo = 0;
    limiteLateral = Math.max(0, Number(limiteLateral) || 0);
    var ciclos = CICLOS_TRILHA[cursoId] || CICLOS_TRILHA['programming-logic'];

    while (segmentosGerados <= indice) {
      var definicao = ciclos[ciclo % ciclos.length];
      var sentidoInicial = definicao[0] === 'R' ? 1 : -1;
      var grupos = definicao[1].map(function (tamanho, indiceGrupo) {
        return {
          tamanho: tamanho,
          direcao: indiceGrupo % 2 === 0 ? sentidoInicial : -sentidoInicial
        };
      });

      for (var grupo = 0; grupo < grupos.length; grupo++) {
        for (var passo = 0; passo < grupos[grupo].tamanho; passo++) {
          var proximoX = ponto.x + grupos[grupo].direcao;
          /* Em painéis estreitos, a trilha dobra o trecho horizontal para
             baixo. Assim o espaçamento se mantém e todos os módulos seguem
             conectados por um único caminho ortogonal. */
          if (Math.abs(proximoX) <= limiteLateral) ponto.x = proximoX;
          else ponto.y += 1;
          if (segmentosGerados === indice) return { x: ponto.x, y: ponto.y };
          segmentosGerados += 1;
        }
        // Cada bloco horizontal termina com uma única descida.
        ponto.y += 1;
        if (segmentosGerados === indice) return { x: ponto.x, y: ponto.y };
        segmentosGerados += 1;
      }
      ciclo += 1;
    }
  }

  function pontoModuloLogProg(indice, limiteLateral, cursoId) {
    return pontoBaseLogProg(indice, limiteLateral, cursoId);
  }

  function pontoEtapaLogProg(indice, limiteLateral, cursoId) {
    return pontoBaseLogProg(indice, limiteLateral, cursoId);
  }

  function configuracaoDePosicionamento(options) {
    var etapas = options && options.tipoTrilha === 'etapas';
    return {
      margemSuperior: etapas ? MARGEM_SUPERIOR_ETAPAS : MARGEM_SUPERIOR_MODULOS,
      ponto: etapas ? pontoEtapaLogProg : pontoModuloLogProg,
      /* POSICOES contém exclusivamente os ajustes manuais do mapa de
         módulos. Etapas podem ganhar ajustes próprios em POSICOES_ETAPAS,
         sem nunca alterar o mapa do curso. */
      ajustes: etapas ? (CL.trilha.POSICOES_ETAPAS || {}) : (CL.trilha.POSICOES || {})
    };
  }

  function nodeHTML(node, index, options) {
    var logoUrl = CL.trilha.LOGOS[node.linguagem] || '';
    var statusClass = 'trilha-node--' + (node.status || 'available');
    var status = node.status || 'available';
    var bloqueado = status === 'locked';
    var gradeTriangular = options && options.layout === 'triangular';
    var trilhaSerpente = options && options.layout === 'serpente';
    var trilhaRio = options && options.layout === 'rio';
    var trilhaQuatroColunas = options && options.layout === 'quatro-colunas';
    var trilhaVinteUm = options && options.layout === 'vinte-um-por-tela';
    var trilhaLogProg = options && options.layout === 'logprog-ziguezague';
    var trilhaEtapas = options && options.layout === 'etapas-responsivas';
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
      colunas = 10;
      var pagina = Math.floor(index / 21);
      var indiceNaPagina = index % 21;
      indiceLinha = Math.floor(indiceNaPagina / colunas);
      linha = indiceLinha + 1;
      posicaoNaLinha = indiceNaPagina % colunas;
      coluna = indiceLinha % 2 === 0 ? posicaoNaLinha + 1 : colunas - posicaoNaLinha;
    }

    if (trilhaLogProg) {
      var configuracaoLogProg = configuracaoDePosicionamento(options);
      var pontoDaLogica = configuracaoLogProg.ponto(index, options.logprogLimiteLateral, options.cursoId);
      colunas = 13;
      coluna = pontoDaLogica.x + 7;
      linha = pontoDaLogica.y + 1;
      indiceLinha = pontoDaLogica.y;
    }

    if (trilhaEtapas) {
      colunas = Math.max(1, Number(options.colunasEtapas) || 1);
      indiceLinha = Math.floor(index / colunas);
      linha = indiceLinha + 1;
      posicaoNaLinha = index % colunas;
      /* A ordem alterna nas linhas para que o caminho conecte a última
         etapa de uma linha à primeira da próxima sem cruzar a grade. */
      coluna = indiceLinha % 2 === 0 ? posicaoNaLinha + 1 : colunas - posicaoNaLinha;
    }

    /* Zigue-zague: alterna pra cima/baixo por CLASSE (não por
       nth-child), porque o SVG do caminho (ver desenharCaminho())
       também é filho de .trilha-caminho — se dependesse de
       nth-child, o SVG bagunçaria a contagem par/ímpar. */
    var onda = (index % 2 === 0) ? 'trilha-item--sobe' : 'trilha-item--desce';
    var classePosicao = onda;
    var estiloPosicao = '';
    if (gradeTriangular) {
      classePosicao = 'trilha-item--triangular';
      estiloPosicao = ' style="--trilha-coluna:' + coluna + ';--trilha-linha:' + linha + ';--trilha-deslocamento:' + (indiceLinha % 2 === 1 ? 60 : 0) + 'px"';
    }
    if (trilhaSerpente || trilhaRio) {
      classePosicao = trilhaSerpente ? 'trilha-item--serpente' : 'trilha-item--rio';
      estiloPosicao = ' style="--trilha-coluna:' + coluna + ';--trilha-linha:' + linha + ';--trilha-deslocamento:' + (indiceLinha % 2 === 1 ? 'var(--trilha-meio-passo)' : '0px') + '"';
    }
    if (trilhaQuatroColunas) {
      classePosicao = 'trilha-item--quatro-colunas';
      estiloPosicao = ' style="--trilha-coluna:' + coluna + ';--trilha-linha:' + linha + '"';
    }
    if (trilhaVinteUm) {
      classePosicao = 'trilha-item--vinte-um';
      estiloPosicao = ' style="--trilha-pagina-y:' + (pagina * 100) + 'vh;--trilha-linha-y:' + (100 + (indiceLinha * 136)) + 'px;--trilha-x:' + (6 + ((coluna - 1) * (88 / 6))).toFixed(4) + '%"';
    }
    if (trilhaLogProg) {
      classePosicao = 'trilha-item--logprog';
      estiloPosicao = ' style="--trilha-x:calc(50% + ' + (pontoDaLogica.x * PASSO_HORIZONTAL_LOGPROG) + 'px);--trilha-y:' + (configuracaoLogProg.margemSuperior + (pontoDaLogica.y * PASSO_VERTICAL_LOGPROG)) + 'px"';
    }
    if (trilhaEtapas) {
      classePosicao = 'trilha-item--etapas';
      estiloPosicao = ' style="--trilha-coluna:' + coluna + ';--trilha-linha:' + linha + '"';
    }

    var posicoesDoCurso = configuracaoLogProg
      ? configuracaoLogProg.ajustes[options && options.cursoId]
      : (CL.trilha.POSICOES && CL.trilha.POSICOES[options && options.cursoId]);
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

    var rotuloRefazer = node.resetLabel || 'Refazer nível';
    var resetBtn = node.showReset
      ? '<button type="button" class="trilha-node-reset" data-trilha-reset data-id="' + escapeAttr(node.id) + '" title="' + escapeAttr(rotuloRefazer) + '" aria-label="' + escapeAttr(rotuloRefazer) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.958 7.958 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L13 11h7V4l-2.35 2.35z"/></svg>' +
        '</button>'
      : '';

    return (
      '<div class="trilha-item ' + classePosicao + '" data-trilha-item data-index="' + index + '"' + estiloPosicao + '>' +
        '<div class="trilha-node-col">' +
          '<div class="trilha-node-surface trilha-node-surface--' + escapeAttr(status) + '">' +
            resetBtn +
            '<button type="button" class="trilha-node ' + statusClass + '" data-trilha-node data-id="' + escapeAttr(node.id) + '" data-status="' + escapeAttr(status) + '"' + (bloqueado ? ' aria-disabled="true" title="Bloqueado: conclua o nível anterior"' : ' title="' + escapeAttr(node.titulo) + '"') + '>' +
              (logoUrl ? '<img class="trilha-node-logo" src="' + escapeAttr(logoUrl) + '" alt="" aria-hidden="true"/>' : '') +
              '<span class="trilha-node-numero">' + node.numero + '</span>' +
              check +
            '</button>' +
          '</div>' +
          '<span class="trilha-node-titulo">' + escapeAttr(node.titulo) + '</span>' +
          '<div class="trilha-node-footer">' + percentual + '</div>' +
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

      // LogProg usa os segmentos retos da grade de referência. Os
      // demais cursos mantêm as curvas em S do mapa original.
      var usaSegmentosRetos = caminho.classList.contains('trilha-caminho--logprog');
      var mx = (a.x + b.x) / 2;
      var d = usaSegmentosRetos
        ? 'M ' + a.x + ' ' + a.y + ' L ' + b.x + ' ' + b.y
        : 'M ' + a.x + ' ' + a.y +
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

      /* O contorno entra primeiro para ficar atrás do traço colorido. Como
         ambos seguem a mesma curva, a linha preserva os estados pontilhado
         e concluído sem sobrepor os módulos. */
      var contorno = document.createElementNS(svgns, 'path');
      contorno.setAttribute('d', d);
      contorno.setAttribute('class', 'trilha-path-contorno' + (andado ? ' is-andado' : ''));
      fragmento.appendChild(contorno);

      var path = document.createElementNS(svgns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'trilha-path-segmento' + (andado ? ' is-andado' : ''));
      fragmento.appendChild(path);
    }

    svg.innerHTML = '';
    svg.appendChild(fragmento);
  }

  /* As coordenadas manuais da visão de 21 módulos foram criadas para uma
     tela larga. Quando uma IA integrada reduz a largura da página, elas
     podem levar nós para fora da área visível. Em vez de limitar cada nó
     isoladamente (o que deformaria o caminho), aplicamos a mesma escala
     horizontal a todos: o desenho inteiro é comprimido para uma faixa
     segura e o SVG é redesenhado em seguida usando as novas posições. */
  function ajustarTrilhaNaLarguraDisponivel(container) {
    var caminho = container.querySelector('.trilha-caminho--vinte-um');
    if (!caminho) return false;

    var itens = Array.prototype.slice.call(caminho.querySelectorAll('[data-trilha-item]'));
    var area = caminho.getBoundingClientRect();
    if (!area.width || !itens.length) return false;

    var pontos = itens.map(function (item) {
      var rect = item.getBoundingClientRect();
      return {
        item: item,
        x: rect.left + (rect.width / 2) - area.left,
        y: rect.top + (rect.height / 2) - area.top
      };
    });
    var menorX = Math.min.apply(null, pontos.map(function (ponto) { return ponto.x; }));
    var maiorX = Math.max.apply(null, pontos.map(function (ponto) { return ponto.x; }));
    var margemSegura = Math.min(64, Math.max(48, area.width * 0.09));
    var inicioSeguro = margemSegura;
    var fimSeguro = Math.max(inicioSeguro, area.width - margemSegura);

    // Já cabe: preserva exatamente a composição original.
    if (menorX >= inicioSeguro && maiorX <= fimSeguro) return false;

    var intervaloOriginal = Math.max(1, maiorX - menorX);
    var escala = Math.min(1, (fimSeguro - inicioSeguro) / intervaloOriginal);
    /* Ao perder largura, a trilha ganha altura. Assim os módulos não são
       apenas apertados lateralmente: eles seguem o percurso em uma coluna
       verticalmente mais espaçada, como ocorre no mapa de etapas. */
    var menorY = Math.min.apply(null, pontos.map(function (ponto) { return ponto.y; }));
    var escalaVertical = 1 + ((1 - escala) * 1.35);
    var pontosAjustados = [];
    var distanciaMinimaEntreModulos = 112;
    pontos.forEach(function (ponto, indice) {
      var destino = {
        x: inicioSeguro + ((ponto.x - menorX) * escala),
        y: menorY + ((ponto.y - menorY) * escalaVertical)
      };

      /* Cada módulo anterior vira uma referência espacial. Se o novo nó
         entrar no raio mínimo de qualquer um deles, avança pelo sentido do
         próprio percurso; assim a trilha ganha espaço em todas as direções
         sem desmontar a ordem dos módulos. */
      for (var tentativa = 0; tentativa < 16; tentativa++) {
        var referencia = null;
        var menorDistancia = Infinity;
        pontosAjustados.forEach(function (anterior) {
          var dxReferencia = destino.x - anterior.x;
          var dyReferencia = destino.y - anterior.y;
          var distanciaReferencia = Math.sqrt((dxReferencia * dxReferencia) + (dyReferencia * dyReferencia));
          if (distanciaReferencia < menorDistancia) {
            menorDistancia = distanciaReferencia;
            referencia = anterior;
          }
        });
        if (!referencia || menorDistancia >= distanciaMinimaEntreModulos) break;

        var anteriorNoPercurso = pontosAjustados[indice - 1] || referencia;
        var dx = destino.x - anteriorNoPercurso.x;
        var dy = destino.y - anteriorNoPercurso.y;
        var distancia = Math.sqrt((dx * dx) + (dy * dy));
        if (distancia < 1) {
          dx = destino.x - referencia.x;
          dy = destino.y - referencia.y;
          distancia = Math.sqrt((dx * dx) + (dy * dy));
        }
        /* Se o sentido do percurso apontar de volta para a referência que
           causou o conflito, usa o vetor que afasta os dois nós. */
        var afastamentoX = destino.x - referencia.x;
        var afastamentoY = destino.y - referencia.y;
        if ((dx * afastamentoX) + (dy * afastamentoY) <= 0) {
          dx = afastamentoX;
          dy = afastamentoY;
          distancia = Math.sqrt((dx * dx) + (dy * dy));
        }
        if (distancia < 1) {
          dx = indice % 2 ? 0.6 : -0.6;
          dy = 0.8;
          distancia = 1;
        }
        var avanco = distanciaMinimaEntreModulos - menorDistancia + 8;
        destino.x += (dx / distancia) * avanco;
        destino.y += (dy / distancia) * avanco;
        destino.x = Math.max(inicioSeguro, Math.min(fimSeguro, destino.x));
      }

      pontosAjustados.push(destino);
      ponto.item.style.setProperty('--trilha-x-visivel', destino.x.toFixed(2) + 'px');
      // xAjustado já considera o deslocamento manual original.
      ponto.item.style.setProperty('--trilha-transform-x', '0px');
      ponto.item.style.setProperty('--trilha-auto-deslocamento-y', (destino.y - ponto.y).toFixed(2) + 'px');
    });
    /* O container acompanha a nova extensão vertical para que os últimos
       módulos e seus conectores continuem dentro da área rolável. */
    var maiorYAjustado = Math.max.apply(null, pontosAjustados.map(function (ponto) { return ponto.y; }));
    var alturaNecessaria = Math.ceil(maiorYAjustado + 112);
    if (alturaNecessaria > caminho.clientHeight) caminho.style.height = alturaNecessaria + 'px';
    return true;
  }

  function atualizarTituloFixo(container, options) {
    /* Por padrão, o banner pertence à página de curso do dashboard. A
       Learning Platform informa seu próprio painel para reutilizar a mesma
       arte nas trilhas de etapas. */
    var pagina = (options && options.titleHost) || container.closest('#cl-page-course');
    if (!pagina) return;

    var titulo = pagina.querySelector('.trilha-titulo-fixo');
    var imagensTitulo = {
      'programming-logic': 'assets/images/trilha-titulo-bg-logprog.png',
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
      /* Na Learning Platform o banner precisa ser o primeiro filho do
         painel, acima do conteúdo de etapas. */
      if (options && options.titleHost) {
        pagina.insertBefore(titulo, pagina.firstChild);
      } else {
        pagina.appendChild(titulo);
      }
    }

    if (options && options.titleHost && titulo !== pagina.firstElementChild) {
      pagina.insertBefore(titulo, pagina.firstChild);
    }

    titulo.innerHTML = '<img src="' + imagemTitulo + '" alt="">';
  }

  // A visão em índice não usa CL.trilha.render(), mas compartilha o mesmo
  // cabeçalho visual (logo + "From Basic to Advanced") do mapa.
  CL.trilha.atualizarTituloFixo = atualizarTituloFixo;

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

  /* As etapas ocupam o painel estreito da Learn Platform. A largura útil
     determina a grade: três colunas no painel largo, duas no médio e uma
     coluna vertical no estreito. */
  function calcularGradeEtapas(container) {
    var largura = Math.max(0, container.clientWidth || 0);
    return { colunas: largura >= 520 ? 3 : (largura >= 340 ? 2 : 1) };
  }

  function agendarRedesenho() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      containersAtivos.forEach(function (container) {
        if (container.isConnected) {
          var usaMapaComAjusteResponsivo = container.querySelector('.trilha-caminho--vinte-um, .trilha-caminho--logprog');
          if ((container._trilhaAutoColunas || container._trilhaEtapasResponsiva || usaMapaComAjusteResponsivo) && container._trilhaSourceOptions) {
            CL.trilha.render(container, container._trilhaSourceOptions);
          } else {
            desenharCaminho(container);
          }
        }
      });
    }, 120);
  }

  /* A largura da Platform Learn também muda quando a IDE é recolhida ou
     quando o divisor interno é arrastado. Essas alterações não disparam o
     evento resize da janela, então observamos diretamente cada trilha. */
  var largurasObservadas = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var observerTrilha = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(function (entries) {
        var larguraMudou = entries.some(function (entry) {
          var largura = entry.contentRect.width;
          var anterior = largurasObservadas ? largurasObservadas.get(entry.target) : entry.target._trilhaLarguraObservada;
          if (largurasObservadas) largurasObservadas.set(entry.target, largura);
          else entry.target._trilhaLarguraObservada = largura;
          return typeof anterior === 'number' && Math.abs(anterior - largura) > 0.5;
        });
        if (larguraMudou) agendarRedesenho();
      })
    : null;

  function observarRedimensionamento(container) {
    if (!observerTrilha || container._trilhaResizeObserved) return;
    container._trilhaResizeObserved = true;
    var larguraInicial = container.getBoundingClientRect().width;
    if (largurasObservadas) largurasObservadas.set(container, larguraInicial);
    else container._trilhaLarguraObservada = larguraInicial;
    observerTrilha.observe(container);
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

    if (options.layout === 'etapas-responsivas') {
      options = Object.assign({}, options, {
        colunasEtapas: calcularGradeEtapas(container).colunas
      });
    }

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

    var classeLayout = '';
    var estiloLayout = '';
    if (options.layout === 'triangular') {
      classeLayout = ' trilha-caminho--triangular';
      estiloLayout = ' style="--trilha-colunas:' + (Math.max(1, Number(options.columns) || 10)) + '"';
    }
    if (options.layout === 'serpente') {
      classeLayout = ' trilha-caminho--serpente';
      estiloLayout = ' style="--trilha-colunas:' + (Math.max(2, Number(options.columns) || 4)) +
        ';--trilha-passo-x:' + (Number(options.passoX) || 168) + 'px' +
        ';--trilha-meio-passo:' + (Number(options.meioPasso) || 84) + 'px' +
        ';--trilha-passo-y:' + (Number(options.passoY) || 145.49) + 'px"';
    }
    if (options.layout === 'etapas-responsivas') {
      classeLayout = ' trilha-caminho--etapas';
      estiloLayout = ' style="--trilha-colunas:' + options.colunasEtapas + '"';
    }
    if (options.layout === 'rio') {
      classeLayout = ' trilha-caminho--rio';
      estiloLayout = ' style="--trilha-colunas:3"';
    }
    if (options.layout === 'quatro-colunas') {
      classeLayout = ' trilha-caminho--quatro-colunas';
      estiloLayout = ' style="--trilha-colunas:4"';
    }
    if (options.layout === 'vinte-um-por-tela') {
      classeLayout = ' trilha-caminho--vinte-um';
      estiloLayout = ' style="height:' + (Math.max(1, Math.ceil(nodes.length / 21)) * 100) + 'vh"';
    }
    if (options.layout === 'logprog-ziguezague') {
      options = Object.assign({}, options, {
        logprogLimiteLateral: limiteLateralLogProg(container.clientWidth)
      });
      classeLayout = ' trilha-caminho--logprog';
      var configuracaoLogProg = configuracaoDePosicionamento(options);
      estiloLayout = ' style="height:' + (Math.max(1, configuracaoLogProg.ponto(Math.max(0, nodes.length - 1), options.logprogLimiteLateral, options.cursoId).y) * PASSO_VERTICAL_LOGPROG + configuracaoLogProg.margemSuperior + 120) + 'px"';
    }

    container.innerHTML = '<div class="trilha-caminho' + classeLayout + '"' + estiloLayout + '>' +
      '<svg class="trilha-path-svg" aria-hidden="true"></svg>' +
      nodes.map(function (node, index) { return nodeHTML(node, index, options); }).join('') +
      '</div>';

    container._trilhaOptions = options;
    container._trilhaSourceOptions = optionsOriginais;
    container._trilhaAutoColunas = usaColunasAutomaticas;
    container._trilhaEtapasResponsiva = options.layout === 'etapas-responsivas';

    if (containersAtivos.indexOf(container) === -1) {
      containersAtivos.push(container);
    }
    observarRedimensionamento(container);

    // requestAnimationFrame garante que o navegador já terminou o
    // layout (posição/tamanho reais das bolinhas) antes de medir.
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(function () {
        var caminhoLogProg = container.querySelector('.trilha-caminho--logprog');
        if (caminhoLogProg) {
          container.scrollLeft = Math.max(0, (caminhoLogProg.scrollWidth - container.clientWidth) / 2);
        }
        ajustarTrilhaNaLarguraDisponivel(container);
        desenharCaminho(container);
      });
    } else {
      var caminhoLogProgSemAnimacao = container.querySelector('.trilha-caminho--logprog');
      if (caminhoLogProgSemAnimacao) {
        container.scrollLeft = Math.max(0, (caminhoLogProgSemAnimacao.scrollWidth - container.clientWidth) / 2);
      }
      ajustarTrilhaNaLarguraDisponivel(container);
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
          if (node.getAttribute('data-status') === 'locked') {
            e.preventDefault();
            if (CL.ui && typeof CL.ui.showToast === 'function') {
              CL.ui.showToast('Conclua o nível anterior para liberar este conteúdo.', 'warning');
            }
            return;
          }
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
    var caminhoLogProg = container.querySelector('.trilha-caminho--logprog');
    container.scrollLeft = caminhoLogProg
      ? Math.max(0, (caminhoLogProg.scrollWidth - container.clientWidth) / 2)
      : 0;
    container.scrollTo({
      top: Math.max(0, container.scrollTop + alvoRect.top - area.top -
        ((container.clientHeight - alvoRect.height) / 2)),
      behavior: 'smooth'
    });
    alvo.classList.add('is-destacado');
    setTimeout(function () { alvo.classList.remove('is-destacado'); }, 1600);
  };

})();
