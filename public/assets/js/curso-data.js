/* =====================================================
   CURSO-DATA.JS
   Fonte única dos dados do curso (módulos/etapas) — antes
   vivia só dentro de ide.js. Agora fica aqui, exposto em
   CL.curso, pra ser usado tanto pelo IDE (teoria + editor)
   quanto pela Dashboard (trilha de módulos).

   Carregar ANTES de ide.js e ANTES de qualquer script que
   monte a trilha (ver assets/js/trilha.js).

   Cada módulo ganhou o campo `linguagem` ('html'|'css'|'js'),
   usado só pra escolher qual logo mostrar no nível da trilha.
   ===================================================== */
(function () {
  'use strict';

  window.CL = window.CL || {};
  var CL = window.CL;

  CL.curso = CL.curso || {};

  CL.curso.MODULOS = [
    {
      id: 'modulo-1-introducao-html',
      nome: 'Introdução ao HTML',
      linguagem: 'html',
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
      linguagem: 'css',
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
      linguagem: 'js',
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

  /* ===================================================== */
  /* HELPERS — usados tanto pela trilha da Dashboard (nível
     = módulo) quanto pela trilha do IDE (nível = etapa).
     Recebem sempre o "progresso" no formato que já existe em
     CL.api.listProgress(): { "moduloId:step": {concluida, percentual} }
     ===================================================== */

  function chaveEtapa(moduloId, step) {
    return moduloId + ':' + step;
  }
  CL.curso.chaveEtapa = chaveEtapa;

  function moduloConcluido(modulo, progresso) {
    return modulo.etapas.every(function (etapa, i) {
      var p = progresso[chaveEtapa(modulo.id, i + 1)];
      return p && p.concluida;
    });
  }
  CL.curso.moduloConcluido = moduloConcluido;

  function tituloTextoPlano(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  CL.curso.tituloTextoPlano = tituloTextoPlano;

  /* Um nó por módulo — usado na trilha da Dashboard. */
  CL.curso.buildModuloNodes = function (progresso, moduloAtualId) {
    progresso = progresso || {};
    var modulos = CL.curso.MODULOS;

    return modulos.map(function (modulo, i) {
      var concluido = moduloConcluido(modulo, progresso);
      var anteriorConcluido = i === 0 || moduloConcluido(modulos[i - 1], progresso);
      var status = concluido ? 'completed' : (anteriorConcluido ? 'available' : 'locked');
      if (modulo.id === moduloAtualId && !concluido) status = 'current';

      return {
        id: modulo.id,
        numero: i + 1,
        titulo: 'Módulo ' + (i + 1) + ': ' + modulo.nome,
        linguagem: modulo.linguagem,
        status: status,
        connectorFilled: i > 0 && moduloConcluido(modulos[i - 1], progresso)
      };
    });
  };

  /* Um nó por etapa DE UM módulo — usado na trilha do IDE (☰). */
  CL.curso.buildEtapaNodes = function (modulo, progresso, currentStep) {
    progresso = progresso || {};

    return modulo.etapas.map(function (etapa, i) {
      var numero = i + 1;
      var p = progresso[chaveEtapa(modulo.id, numero)] || {};
      var anteriorConcluida = numero === 1 ||
        (progresso[chaveEtapa(modulo.id, numero - 1)] && progresso[chaveEtapa(modulo.id, numero - 1)].concluida);

      var status;
      if (p.concluida) {
        status = 'completed';
      } else if (numero === currentStep) {
        status = 'current';
      } else if (anteriorConcluida) {
        status = 'available';
      } else {
        status = 'locked';
      }

      return {
        id: chaveEtapa(modulo.id, numero),
        numero: numero,
        titulo: tituloTextoPlano(etapa.titulo),
        linguagem: modulo.linguagem,
        status: status,
        percentual: (typeof p.percentual === 'number') ? p.percentual : null,
        showReset: true,
        connectorFilled: anteriorConcluida && numero > 1
      };
    });
  };

})();
