(function () {
  'use strict';

  function atualizar(controle) {
    var viewport = controle.querySelector('[data-scroll-viewport]');
    if (!viewport) return;
    var margem = 2;
    // Com setas visíveis, soma a largura delas à área disponível na medida.
    // Isso impede um falso overflow quando os controles caberiam sem reservar
    // os 52 px usados pelos indicadores.
    var larguraDasSetas = 0;
    if (controle.classList.contains('has-horizontal-overflow')) {
      controle.querySelectorAll('[data-scroll-direction]').forEach(function (botao) {
        larguraDasSetas += botao.offsetWidth;
      });
    }
    var temOverflow = viewport.scrollWidth > viewport.clientWidth + larguraDasSetas + margem;
    controle.classList.toggle('has-horizontal-overflow', temOverflow);

    var limite = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    controle.classList.toggle('can-scroll-left', temOverflow && viewport.scrollLeft > margem);
    controle.classList.toggle('can-scroll-right', temOverflow && viewport.scrollLeft < limite - margem);
  }

  function preparar(controle) {
    if (!controle || controle.dataset.scrollControlsReady) {
      if (controle) atualizar(controle);
      return;
    }
    var viewport = controle.querySelector('[data-scroll-viewport]');
    if (!viewport) return;
    controle.dataset.scrollControlsReady = 'true';
    viewport.addEventListener('scroll', function () { atualizar(controle); }, { passive: true });
    controle.querySelectorAll('[data-scroll-direction]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        var direcao = botao.getAttribute('data-scroll-direction') === 'left' ? -1 : 1;
        viewport.scrollBy({ left: direcao * Math.max(96, viewport.clientWidth * .7), behavior: 'smooth' });
      });
    });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { atualizar(controle); }).observe(viewport);
    }
    if (window.MutationObserver) {
      new MutationObserver(function () { atualizar(controle); }).observe(viewport, { childList: true, subtree: true });
    }
    requestAnimationFrame(function () { atualizar(controle); });
  }

  window.CLScrollableControls = {
    refresh: function (raiz) {
      var escopo = raiz || document;
      if (escopo.matches && escopo.matches('[data-scrollable-controls]')) preparar(escopo);
      escopo.querySelectorAll('[data-scrollable-controls]').forEach(preparar);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    window.CLScrollableControls.refresh();
  });
}());
