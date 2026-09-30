(function () {
  const ID_DO_CSS = 'css-programming-logic-modulo-01-etapa-01';

  // Injeção dinâmica de CSS
  if (!document.getElementById(ID_DO_CSS)) {
    const link = document.createElement('link');
    link.id = ID_DO_CSS;
    link.rel = 'stylesheet';
    link.href = new URL('./etapa-01.css', document.currentScript.src).href;
    document.head.appendChild(link);
  }

  // Função auxiliar para permitir o giro via Teclado (Acessibilidade)
  window.toggleFlashcard = function (event, cardElement) {
    if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') {
      if (event.key === ' ') event.preventDefault(); // Evita a rolagem da página
      cardElement.classList.toggle('flipped');
    }
  };

  // Registro da etapa na plataforma
  window.CL.curso.registrarEtapa('programming-logic-modulo-01', 1, {
    titulo: 'Seu primeiro algoritmo',
    texto: `
      <p>Um algoritmo é uma sequência de instruções para resolver um problema. Vamos começar exibindo uma mensagem.</p>

      <!-- Flashcard 16:9 Interativo com Acessibilidade -->
      <div
        class="flashcard-container"
        tabindex="0"
        role="button"
        aria-label="Flashcard de Lógica: Clique ou aperte Enter para virar"
        onclick="toggleFlashcard(event, this)"
        onkeydown="toggleFlashcard(event, this)"
      >
        <div class="flashcard-inner">

          <!-- Frente do Flashcard -->
          <div class="flashcard-front">
            <div class="flashcard-content">
              <strong class="flashcard-title">💡 Conceito Chave</strong>
              <p class="flashcard-definition">
                É uma sequência lógica e finita, um passo a passo com instruções em uma sequência exata para realizar uma tarefa ou resolver um problema.
              </p>
              <span class="flashcard-hint">👆 Clique para ver um exemplo</span>
            </div>
          </div>

          <!-- Verso do Flashcard -->
          <div class="flashcard-back">
            <div class="flashcard-content">
              <strong class="flashcard-title">💡 Exemplo Simples: Fazer Achocolatado</strong>
              <ol class="flashcard-steps">
                <li>Pegar um copo limpo.</li>
                <li>Adicionar 2 colheres de achocolatado.</li>
                <li>Despejar o leite no copo.</li>
                <li>Misturar bem com uma colher.</li>
                <li>Beber o achocolatado.</li>
              </ol>
              <span class="flashcard-hint">🔄 Clique para voltar</span>
            </div>
          </div>

        </div>
      </div>

      <div class="video-container">
        <iframe
src="https://www.youtube-nocookie.com/embed/kUMe1FH4CHE?start=1634&end=1800"
          title="Seu primeiro algoritmo"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen>
        </iframe>
      </div>
    `,
    questoes: [
      {
        pergunta: 'Para que serve um algoritmo?',
        opcoes: [
          'Para guardar imagens no computador.',
          'Para definir uma sequência de instruções que resolve um problema.',
          'Para substituir toda linguagem de programação.'
        ],
        correta: 1,
        explicacao: 'Um algoritmo organiza os passos necessários para resolver um problema.'
      }
    ],
    missao: 'Use <code>console.log()</code> para exibir uma mensagem de boas-vindas.',
    desafio: `
      <p>Personalize a mensagem do console com o seu nome e algo que você quer aprender a programar.</p>
      <div class="task-box">
        <strong>Desafio:</strong> Escreva uma única mensagem clara, usando <code>console.log()</code>.
      </div>
    `,
    codigoInicial: {
      html: '<h1>Lógica de Programação</h1>',
      css: '',
      js: '// Escreva sua mensagem aqui\n'
    },
    verificar: function (codigo) {
      // Aceita aspas simples, duplas ou template strings
      const possuiConsoleLog = /console\.log\s*\(\s*[`\'"][^`\'"]+[`\'"]\s*\)/.test(codigo.js || '');
      return possuiConsoleLog ? 100 : 0;
    }
  });
})();
