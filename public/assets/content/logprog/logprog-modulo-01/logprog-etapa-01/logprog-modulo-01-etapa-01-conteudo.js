(function () {
  'use strict';
  function toggleFlashcard(card) {
    var flipped = card.classList.toggle('flipped');
    card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
  }

  function showFeedback(container, correct, message) {
    var feedback = container.querySelector(':scope > .rc-feedback');
    if (!feedback) {
      feedback = document.createElement('p');
      feedback.className = 'rc-feedback';
      feedback.setAttribute('role', 'status');
      container.appendChild(feedback);
    }
    feedback.className = 'rc-feedback ' + (correct ? 'rc-ok' : 'rc-erro');
    feedback.textContent = message;
  }

  function selectTab(tab) {
    var tabs = tab.closest('.rc-abas');
    tabs.querySelectorAll('[role="tab"]').forEach(function (item) {
      var active = item === tab;
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      item.tabIndex = active ? 0 : -1;
      tabs.querySelector('#' + item.getAttribute('aria-controls')).hidden = !active;
    });
    tab.focus();
  }

  function moveStep(button, direction) {
    var item = button.closest('li');
    var target = direction < 0 ? item.previousElementSibling : item.nextElementSibling;
    if (!target) return;
    if (direction < 0) item.parentNode.insertBefore(item, target);
    else item.parentNode.insertBefore(target, item);
  }

  function handleClick(event) {
    if (!event.target.closest('.logprog-etapa')) return;
    var card = event.target.closest('.flashcard-container');
    if (card) {
      toggleFlashcard(card);
      return;
    }
    var button = event.target.closest('[data-rc]');
    if (!button) return;
    var action = button.dataset.rc;

    if (action === 'deck-prox' || action === 'deck-ant') {
      var deck = button.closest('.rc-deck');
      var items = Array.from(deck.querySelectorAll('.rc-deck-item'));
      var current = items.findIndex(function (item) { return !item.hidden; });
      var next = (current + (action === 'deck-prox' ? 1 : -1) + items.length) % items.length;
      items.forEach(function (item, index) { item.hidden = index !== next; });
      deck.querySelector('.rc-deck-contagem').textContent = (next + 1) + ' / ' + items.length;
    } else if (action === 'aba') {
      selectTab(button);
    } else if (action === 'ordem-sobe' || action === 'ordem-desce') {
      moveStep(button, action === 'ordem-sobe' ? -1 : 1);
    } else if (action === 'ordem-verificar') {
      var list = button.closest('.rc-ordem').querySelectorAll('li');
      var correctCount = 0;
      list.forEach(function (item, index) {
        var correct = Number(item.dataset.pos) === index + 1;
        item.classList.toggle('rc-certo', correct);
        item.classList.toggle('rc-errado', !correct);
        if (correct) correctCount++;
      });
      showFeedback(button.closest('.rc-ordem'), correctCount === list.length,
        correctCount === list.length ? 'Sequência correta.' : correctCount + ' de ' + list.length + ' passos estão na posição certa.');
    } else if (action === 'vf') {
      var statement = button.closest('.rc-vf-item');
      var correct = button.dataset.resp === statement.dataset.gabarito;
      statement.querySelectorAll('button').forEach(function (item) { item.disabled = true; });
      showFeedback(statement, correct, (correct ? 'Correto. ' : 'Revise. ') + statement.dataset.explica);
    } else if (action === 'lacuna-verificar') {
      var block = button.closest('.rc-lacuna');
      var blanks = block.querySelectorAll('select');
      var correctCount = 0;
      blanks.forEach(function (blank) {
        var correct = blank.value === blank.dataset.certa;
        blank.classList.toggle('rc-certo', correct);
        blank.classList.toggle('rc-errado', !correct);
        if (correct) correctCount++;
      });
      showFeedback(block, correctCount === blanks.length, correctCount === blanks.length
        ? 'Tudo certo: um algoritmo tem uma sequência finita de instruções.'
        : 'Confira as respostas marcadas.');
    } else if (action === 'exec-rodar') {
      var editor = button.closest('.rc-exec');
      var output = [];
      var safeConsole = { log: function () { output.push(Array.from(arguments).join(' ')); } };
      try {
        new Function('console', editor.querySelector('textarea').value)(safeConsole);
      } catch (error) {
        output.push('Erro: ' + error.message);
      }
      editor.querySelector('pre').textContent = output.join('\n') || '(o código não exibiu nada)';
    } else if (action === 'ouvir') {
      if ('speechSynthesis' in window) {
        var speech = new SpeechSynthesisUtterance(button.dataset.texto || '');
        speech.lang = 'pt-BR';
        window.speechSynthesis.speak(speech);
      }
    }
  }

  var theoryPane = document.querySelector('.theory-pane');
  if (theoryPane) {
    theoryPane.addEventListener('click', handleClick);
    theoryPane.addEventListener('keydown', function (event) {
      if (!event.target.closest || !event.target.closest('.logprog-etapa')) return;
      var card = event.target.closest('.flashcard-container');
      if (card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        toggleFlashcard(card);
        return;
      }
      var tab = event.target.closest('.rc-abas [role="tab"]');
      if (!tab || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
      var tabs = Array.from(tab.closest('.rc-abas').querySelectorAll('[role="tab"]'));
      var index = tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1);
      selectTab(tabs[(index + tabs.length) % tabs.length]);
    });
    theoryPane.addEventListener('change', function (event) {
      if (!event.target.closest('.logprog-etapa') || !event.target.matches('.rc-check input[type="checkbox"]')) return;
      var checklist = event.target.closest('.rc-check');
      var boxes = checklist.querySelectorAll('input[type="checkbox"]');
      var checked = checklist.querySelectorAll('input:checked').length;
      checklist.querySelector('progress').value = checked;
      checklist.querySelector('.rc-check-texto').textContent = checked + ' de ' + boxes.length + ' concluídas.';
    });
  }


})();
