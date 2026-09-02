(function () {
  'use strict';

  function atualizar(controle) {
    var viewport = controle.querySelector('[data-scroll-viewport]');
    if (!viewport) return;
    var margem = 2;
    var limite = viewport.scrollWidth - viewport.clientWidth;
    controle.classList.toggle('can-scroll-left', viewport.scrollLeft > margem);
    controle.classList.toggle('can-scroll-right', viewport.scrollLeft < limite - margem);
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
