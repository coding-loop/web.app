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

  /* Mesmos ícones já usados na Dashboard (cl-sidebar) e no
     cabeçalho do IDE — mantém a identidade visual do curso. */
  CL.trilha.LOGOS = {
    html: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiHU3hohCSw9z_h4LYa-_TRv4hn6LXNtLQAB7er3G0ic3gcqzAV8Tp069RP4CDSHU4aYUCfq3B_uWeegLlc-DgkaYLERLgvkoBqLAv1gvGfpr1CBkfMVCt3C4pM1hAEKQ2pt_hYxhmoJEr386YD_zaClGbE1z0OZQO_ZKn-pfsCspQ3HQ/s1600/Html5.png',
    css: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjdqbtPc55KC93dvtBISIZatsWe5HBb10tTQlSpcFoaSIB7zz1CbVPd_-Olv4TIgUhFazZUavRBfEsveyGybySmRkotC0twEKzU1QO7bjiLtiOvQjHgPxXqZPcnnSf-pPTcIU0epDuDhqoZ1uTj4FCyNyliOdxxWSApLwXsTz4MgUCTkA/s1600/Css3.png',
    js: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhlpGod03wzuYc-fV4BZWRxS7pqcZQjpNncN5J9Gj0yh0pOUzIrJAwCnQumcIizsYUT1oHf407xSuQb1mvz8qGL99eTYkAw5moaF5peAjsxyJW-M-Rmg1YZISwGv8vxO02-5-IH2YTxbceQgMGUGad0AFPhCpsHngT8nrOMp6fVI-2qtQ/s1600/JS.png'
  };

  function escapeAttr(texto) {
    return String(texto || '').replace(/"/g, '&quot;');
  }

  function nodeHTML(node, index) {
    var logoUrl = CL.trilha.LOGOS[node.linguagem] || '';
    var statusClass = 'trilha-node--' + (node.status || 'available');

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
      '<div class="trilha-item">' +
        (index > 0 ? '<div class="trilha-connector' + (node.connectorFilled ? ' is-filled' : '') + '"></div>' : '') +
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

  /* CL.trilha.render(container, {
       nodes: [...],
       onSelect: function (nodeId) {},
       onReset:  function (nodeId) {}   // opcional
     }) */
  CL.trilha.render = function (container, options) {
    if (!container) return;
    options = options || {};
    var nodes = options.nodes || [];

    container.innerHTML = '<div class="trilha-caminho">' +
      nodes.map(nodeHTML).join('') +
      '</div>';

    container._trilhaOptions = options;

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

  /* Rola até o nível informado e dá um destaque rápido —
     usado quando se chega na trilha já mirando um nível
     específico (ex.: veio do ícone HTML/CSS/JS da Dashboard). */
  CL.trilha.destacar = function (container, nodeId) {
    if (!container || !nodeId) return;
    var alvo = container.querySelector('[data-trilha-node][data-id="' + nodeId.replace(/"/g, '') + '"]');
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    alvo.classList.add('is-destacado');
    setTimeout(function () { alvo.classList.remove('is-destacado'); }, 1);
  };

})();
