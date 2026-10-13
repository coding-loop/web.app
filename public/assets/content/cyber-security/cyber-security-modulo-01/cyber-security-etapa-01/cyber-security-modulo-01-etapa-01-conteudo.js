(function () {
  'use strict';
  function feedback(bloco, classe, texto) {
    var saida = bloco.querySelector('.cs-feedback');
    if (!saida) {
      saida = document.createElement('p');
      saida.className = 'cs-feedback';
      saida.setAttribute('role', 'status');
      bloco.appendChild(saida);
    }
    saida.hidden = false;
    saida.classList.remove('cs-correto', 'cs-errado');
    if (classe) saida.classList.add(classe);
    saida.textContent = texto;
  }

  function selectTab(tab) {
    var container = tab.closest('.cs-abas');
    var tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    tabs.forEach(function (item) {
      var active = item === tab;
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      item.tabIndex = active ? 0 : -1;
      container.querySelector('#' + item.getAttribute('aria-controls')).hidden = !active;
    });
    tab.focus();
  }

  function moveStep(button, direction) {
    var item = button.closest('li');
    var target = direction < 0 ? item.previousElementSibling : item.nextElementSibling;
    if (!target) return;
    if (direction < 0) item.parentNode.insertBefore(item, target);
    else item.parentNode.insertBefore(target, item);
    item.parentNode.querySelectorAll('li').forEach(function (step) {
      step.classList.remove('cs-correto', 'cs-errado');
    });
  }

  function runExample(button) {
    var editor = button.closest('.cs-editor');
    var output = [];
    var safeConsole = { log: function () { output.push(Array.from(arguments).join(' ')); } };
    try {
      new Function('console', editor.querySelector('textarea').value)(safeConsole);
    } catch (error) {
      output.push('Erro: ' + error.message);
    }
    editor.querySelector('pre').textContent = output.join('\n') || '(o código não exibiu nada)';
  }

  function handleClick(event) {
    if (!event.target.closest('.cs-etapa')) return;
    var button = event.target.closest('[data-rc], .cs-flashcard');
    if (!button) return;

    if (button.classList.contains('cs-flashcard')) {
      var flipped = button.classList.toggle('flipped');
      button.setAttribute('aria-pressed', flipped ? 'true' : 'false');
      return;
    }

    var action = button.getAttribute('data-rc');
    if (action === 'cenario') {
      var scenario = button.closest('.cs-cenario');
      var correct = button.dataset.correta === 'true';
      scenario.querySelectorAll('[data-rc="cenario"]').forEach(function (option) { option.disabled = true; });
      button.classList.add(correct ? 'cs-correto' : 'cs-errado');
      feedback(scenario, correct ? 'cs-correto' : 'cs-errado', correct
        ? 'Correto. Confirme o pedido por um canal oficial, sem usar o link recebido.'
        : 'Essa ação pode expor sua conta. Confirme a solicitação por um canal oficial.');
    } else if (action === 'ouvir') {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        return;
      }
      var speech = new SpeechSynthesisUtterance(button.dataset.texto || '');
      speech.lang = 'pt-BR';
      window.speechSynthesis.speak(speech);
    } else if (action === 'deck-ant' || action === 'deck-prox') {
      var deck = button.closest('.cs-deck');
      var items = Array.from(deck.querySelectorAll('.cs-deck-item'));
      var current = items.findIndex(function (item) { return !item.hidden; });
      var next = (current + (action === 'deck-prox' ? 1 : -1) + items.length) % items.length;
      items.forEach(function (item, index) {
        item.hidden = index !== next;
        var card = item.querySelector('.cs-flashcard');
        if (card) card.classList.remove('flipped');
      });
      deck.querySelector('.cs-deck-contagem').textContent = (next + 1) + ' / ' + items.length;
    } else if (action === 'aba') {
      selectTab(button);
    } else if (action === 'ordem-sobe' || action === 'ordem-desce') {
      moveStep(button, action === 'ordem-sobe' ? -1 : 1);
    } else if (action === 'ordem-verificar') {
      var list = button.closest('.cs-ordem').querySelector('ol');
      var steps = Array.from(list.querySelectorAll('li'));
      var correctCount = 0;
      steps.forEach(function (step, index) {
        var correct = Number(step.dataset.pos) === index + 1;
        step.classList.toggle('cs-correto', correct);
        step.classList.toggle('cs-errado', !correct);
        if (correct) correctCount++;
      });
      feedback(button.closest('.cs-ordem'), correctCount === steps.length ? 'cs-correto' : 'cs-errado',
        correctCount === steps.length ? 'Sequência correta.' : correctCount + ' de ' + steps.length + ' passos estão na posição certa.');
    } else if (action === 'vf') {
      var item = button.closest('.cs-vf-item');
      var correct = button.dataset.resp === item.dataset.gabarito;
      item.querySelectorAll('button').forEach(function (option) { option.disabled = true; });
      button.classList.add(correct ? 'cs-correto' : 'cs-errado');
      feedback(item, correct ? 'cs-correto' : 'cs-errado', (correct ? 'Correto. ' : 'Revise. ') + item.dataset.explica);
    } else if (action === 'lacuna-verificar') {
      var blanks = button.closest('.cs-lacuna').querySelectorAll('select');
      var correctCount = 0;
      blanks.forEach(function (blank) {
        var correct = blank.value === blank.dataset.certa;
        blank.classList.toggle('cs-correto', correct);
        blank.classList.toggle('cs-errado', !correct);
        if (correct) correctCount++;
      });
      feedback(button.closest('.cs-lacuna'), correctCount === blanks.length ? 'cs-correto' : 'cs-errado',
        correctCount === blanks.length ? 'Tudo certo: confidencialidade, integridade e disponibilidade.' : 'Confira as lacunas marcadas.');
    } else if (action === 'exec-rodar') {
      runExample(button);
    } else if (action === 'exec-copiar') {
      var code = button.closest('.cs-editor').querySelector('textarea').value;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code);
    }
  }

  var theoryPane = document.querySelector('.theory-pane');
  if (theoryPane) {
    theoryPane.addEventListener('click', handleClick);
    theoryPane.addEventListener('keydown', function (event) {
      if (!event.target.closest || !event.target.closest('.cs-etapa')) return;
      var tab = event.target.closest('.cs-abas [role="tab"]');
      if (!tab || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
      var tabs = Array.from(tab.closest('.cs-abas').querySelectorAll('[role="tab"]'));
      var index = tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1);
      selectTab(tabs[(index + tabs.length) % tabs.length]);
    });
    theoryPane.addEventListener('change', function (event) {
      if (!event.target.closest('.cs-etapa') || !event.target.matches('.cs-checklist input[type="checkbox"]')) return;
      var checklist = event.target.closest('.cs-checklist');
      var boxes = checklist.querySelectorAll('input[type="checkbox"]');
      var checked = checklist.querySelectorAll('input:checked').length;
      checklist.querySelector('.cs-progresso').value = checked;
      checklist.querySelector('.cs-progresso-texto').textContent = checked + ' de ' + boxes.length + ' boas práticas revisadas.';
    });
  }


})();
