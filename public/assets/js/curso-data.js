/* =====================================================
   CURSO-DATA.JS
   Fonte única dos dados do curso — TEMPLATE de conteúdo.

   Existem 3 trilhas INDEPENDENTES (uma por linguagem), cada
   uma com 10 módulos e 5 etapas por módulo:
     CL.curso.CURSOS.html  -> html-modulo-1  ... html-modulo-10
     CL.curso.CURSOS.css   -> css-modulo-1   ... css-modulo-10
     CL.curso.CURSOS.js    -> js-modulo-1    ... js-modulo-10

   Cada trilha é 100% independente das outras: terminar o
   último módulo de HTML não destrava nada em CSS/JS. Cada
   uma tem seu próprio "módulo 1" (início da trilha) e seu
   próprio "módulo 10" (fim da trilha).

   ===================================================================
   COMO ACRESCENTAR CONTEÚDO (é só isso que você precisa saber):
   ===================================================================

   1) EDITAR UMA ETAPA JÁ EXISTENTE
      Localize o módulo (ex.: 'css-modulo-3') e a etapa (ex.: a 2ª do
      array `etapas`) e edite os campos:
        titulo: string curta (aparece no <h3> da etapa e no nível da trilha)
        texto: HTML explicando a teoria (pode usar <p>, <code>, <strong>...)
        missao: HTML descrevendo o que o aluno deve fazer no editor
      Campos opcionais:
        codigoInicial: { html, css, js } — código que aparece no editor
                        quando o aluno abre essa etapa pela 1ª vez
                        (se omitido, herda o que estava salvo/anterior)
        verificar: function (codigo) { ... return 0-100; }
                   — calcula o % de acerto a partir do código atual do
                   editor ({html, css, js}); usado pro selo de % na
                   trilha. Se omitido, a etapa não mostra percentual,
                   só o check de "concluída" (que já acontece ao clicar
                   "Próxima Etapa").

   2) ACRESCENTAR UMA ETAPA A UM MÓDULO
      Todo módulo tem exatamente 5 etapas hoje, mas isso NÃO é uma
      trava do código — é só quantas foram criadas até agora. Pra
      acrescentar uma 6ª etapa, dentro do array `etapas` do módulo,
      adicione mais um objeto (mesmo formato acima) ao final do array.
      Nada mais precisa mudar: a trilha do IDE (☰) e o progresso se
      adaptam sozinhos ao novo tamanho.

   3) ACRESCENTAR UM MÓDULO A UMA TRILHA
      Dentro de CL.curso.CURSOS.<html|css|js>.modulos, adicione mais um
      objeto ao final do array:
        {
          id: 'html-modulo-11',      // <cursoId>-modulo-<N>, sempre único
          nome: 'Nome do novo módulo',
          etapas: [ ...5 objetos de etapa, como acima... ]
        }
      A trilha da Dashboard (que lista os módulos) se adapta sozinha.

   4) CRIAR UMA TRILHA NOVA (ex.: um 4º curso)
      Adicione uma nova chave em CL.curso.CURSOS, no mesmo formato de
      'html'/'css'/'js' (id, nome, linguagem, modulos). Se a linguagem
      for diferente de html/css/js, adicione também o logo dela em
      CL.trilha.LOGOS (ver assets/js/trilha.js).
   ===================================================================
   ===================================================== */
(function () {
  'use strict';

  window.CL = window.CL || {};
  var CL = window.CL;

  CL.curso = CL.curso || {};

  CL.curso.CURSOS = {
  html: {
    id: 'html',
    nome: 'HTML',
    linguagem: 'html',
    modulos: [
    {
      id: 'html-modulo-1',
      linguagem: 'html',
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
          // Dá 100% se o texto do <h1> foi alterado (a missão pede pra
          // trocar pelo nome do aluno).
          verificar: function (codigo) {
            var html = codigo.html || '';
            var match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            var textoH1 = match ? match[1].trim() : '';
            return (textoH1 && textoH1 !== 'Welcome to My Website') ? 100 : 0;
          }
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Introdução ao HTML" (HTML · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Introdução ao HTML" (HTML · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Introdução ao HTML" (HTML · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Introdução ao HTML" (HTML · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-2',
      linguagem: 'html',
      nome: 'Estrutura do Documento',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Estrutura do Documento" (HTML · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Estrutura do Documento" (HTML · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Estrutura do Documento" (HTML · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Estrutura do Documento" (HTML · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Estrutura do Documento" (HTML · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-3',
      linguagem: 'html',
      nome: 'Textos e Formatação',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Textos e Formatação" (HTML · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Textos e Formatação" (HTML · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Textos e Formatação" (HTML · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Textos e Formatação" (HTML · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Textos e Formatação" (HTML · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-4',
      linguagem: 'html',
      nome: 'Links e Navegação',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Links e Navegação" (HTML · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Links e Navegação" (HTML · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Links e Navegação" (HTML · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Links e Navegação" (HTML · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Links e Navegação" (HTML · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-5',
      linguagem: 'html',
      nome: 'Imagens e Mídia',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Imagens e Mídia" (HTML · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Imagens e Mídia" (HTML · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Imagens e Mídia" (HTML · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Imagens e Mídia" (HTML · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Imagens e Mídia" (HTML · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-6',
      linguagem: 'html',
      nome: 'Listas',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Listas" (HTML · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Listas" (HTML · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Listas" (HTML · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Listas" (HTML · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Listas" (HTML · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-7',
      linguagem: 'html',
      nome: 'Tabelas',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Tabelas" (HTML · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Tabelas" (HTML · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Tabelas" (HTML · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Tabelas" (HTML · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Tabelas" (HTML · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-8',
      linguagem: 'html',
      nome: 'Formulários',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Formulários" (HTML · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Formulários" (HTML · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Formulários" (HTML · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Formulários" (HTML · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Formulários" (HTML · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-9',
      linguagem: 'html',
      nome: 'Elementos Semânticos',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Elementos Semânticos" (HTML · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Elementos Semânticos" (HTML · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Elementos Semânticos" (HTML · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Elementos Semânticos" (HTML · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Elementos Semânticos" (HTML · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'html-modulo-10',
      linguagem: 'html',
      nome: 'Projeto Final de HTML',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Projeto Final de HTML" (HTML · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Projeto Final de HTML" (HTML · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Projeto Final de HTML" (HTML · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Projeto Final de HTML" (HTML · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Projeto Final de HTML" (HTML · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    }
    ]
  },

  css: {
    id: 'css',
    nome: 'CSS',
    linguagem: 'css',
    modulos: [
    {
      id: 'css-modulo-1',
      linguagem: 'css',
      nome: 'Introdução ao CSS',
      etapas: [
        {
          titulo: 'Bem-vindo à trilha de CSS',
          texto: `<p>Aqui você aprende a estilizar páginas HTML: cores, espaçamentos, tipografia e layout.</p>
          <p>Use a aba <strong>CSS</strong> do editor para escrever seus estilos — o preview atualiza em tempo real.</p>`,
          missao: `Na aba CSS do editor, altere a cor de fundo (<code>background-color</code>) do <code>&lt;body&gt;</code> para um tom diferente do atual.`,
          codigoInicial: {
            html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Praticando CSS</title>
</head>
<body>
  <h1>Título da página</h1>
  <p>Edite o CSS ao lado para estilizar este conteúdo.</p>
</body>
</html>`,
            css: 'body {\n  font-family: sans-serif;\n  background-color: #ffffff;\n  padding: 20px;\n  color: #333;\n}',
            js: ''
          },
          // Dá 100% se o background-color do body foi alterado.
          verificar: function (codigo) {
            var css = codigo.css || '';
            var match = css.match(/body\s*\{[^}]*background-color\s*:\s*([^;]+);/i);
            var cor = match ? match[1].trim() : '';
            return (cor && cor !== '#ffffff') ? 100 : 0;
          }
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Introdução ao CSS" (CSS · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Introdução ao CSS" (CSS · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Introdução ao CSS" (CSS · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Introdução ao CSS" (CSS · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-2',
      linguagem: 'css',
      nome: 'Seletores CSS',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Seletores CSS" (CSS · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Seletores CSS" (CSS · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Seletores CSS" (CSS · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Seletores CSS" (CSS · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Seletores CSS" (CSS · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-3',
      linguagem: 'css',
      nome: 'Cores e Fundos',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Cores e Fundos" (CSS · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Cores e Fundos" (CSS · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Cores e Fundos" (CSS · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Cores e Fundos" (CSS · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Cores e Fundos" (CSS · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-4',
      linguagem: 'css',
      nome: 'Box Model',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Box Model" (CSS · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Box Model" (CSS · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Box Model" (CSS · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Box Model" (CSS · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Box Model" (CSS · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-5',
      linguagem: 'css',
      nome: 'Tipografia',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Tipografia" (CSS · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Tipografia" (CSS · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Tipografia" (CSS · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Tipografia" (CSS · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Tipografia" (CSS · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-6',
      linguagem: 'css',
      nome: 'Flexbox',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Flexbox" (CSS · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Flexbox" (CSS · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Flexbox" (CSS · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Flexbox" (CSS · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Flexbox" (CSS · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-7',
      linguagem: 'css',
      nome: 'Grid Layout',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Grid Layout" (CSS · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Grid Layout" (CSS · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Grid Layout" (CSS · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Grid Layout" (CSS · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Grid Layout" (CSS · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-8',
      linguagem: 'css',
      nome: 'Posicionamento',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Posicionamento" (CSS · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Posicionamento" (CSS · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Posicionamento" (CSS · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Posicionamento" (CSS · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Posicionamento" (CSS · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-9',
      linguagem: 'css',
      nome: 'Responsividade',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Responsividade" (CSS · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Responsividade" (CSS · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Responsividade" (CSS · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Responsividade" (CSS · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Responsividade" (CSS · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'css-modulo-10',
      linguagem: 'css',
      nome: 'Projeto Final de CSS',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Projeto Final de CSS" (CSS · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Projeto Final de CSS" (CSS · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Projeto Final de CSS" (CSS · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Projeto Final de CSS" (CSS · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Projeto Final de CSS" (CSS · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    }
    ]
  },

  js: {
    id: 'js',
    nome: 'JavaScript',
    linguagem: 'js',
    modulos: [
    {
      id: 'js-modulo-1',
      linguagem: 'js',
      nome: 'Introdução ao JavaScript',
      etapas: [
        {
          titulo: 'Bem-vindo à trilha de JavaScript',
          texto: `<p>Aqui você aprende a dar comportamento e interatividade às páginas usando JavaScript.</p>
          <p>Use a aba <strong>JavaScript</strong> do editor — abra o console do navegador (ou o preview) pra ver a saída do seu código.</p>`,
          missao: `Na aba JavaScript do editor, use <code>console.log()</code> para exibir uma mensagem de sua escolha.`,
          codigoInicial: {
            html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Praticando JavaScript</title>
</head>
<body>
  <h1>Abra o console para ver a saída do seu código</h1>
</body>
</html>`,
            css: 'body {\n  font-family: sans-serif;\n  padding: 20px;\n  color: #333;\n}',
            js: '// Escreva seu código aqui.\n'
          },
          // Dá 100% se o aluno chamou console.log(...) com algo além do
          // comentário inicial.
          verificar: function (codigo) {
            var js = codigo.js || '';
            return /console\.log\s*\(/.test(js) ? 100 : 0;
          }
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Introdução ao JavaScript" (JavaScript · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Introdução ao JavaScript" (JavaScript · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Introdução ao JavaScript" (JavaScript · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Introdução ao JavaScript" (JavaScript · Módulo 1). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-2',
      linguagem: 'js',
      nome: 'Variáveis e Tipos de Dados',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Variáveis e Tipos de Dados" (JavaScript · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Variáveis e Tipos de Dados" (JavaScript · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Variáveis e Tipos de Dados" (JavaScript · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Variáveis e Tipos de Dados" (JavaScript · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Variáveis e Tipos de Dados" (JavaScript · Módulo 2). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-3',
      linguagem: 'js',
      nome: 'Operadores e Condicionais',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Operadores e Condicionais" (JavaScript · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Operadores e Condicionais" (JavaScript · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Operadores e Condicionais" (JavaScript · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Operadores e Condicionais" (JavaScript · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Operadores e Condicionais" (JavaScript · Módulo 3). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-4',
      linguagem: 'js',
      nome: 'Loops e Repetição',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Loops e Repetição" (JavaScript · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Loops e Repetição" (JavaScript · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Loops e Repetição" (JavaScript · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Loops e Repetição" (JavaScript · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Loops e Repetição" (JavaScript · Módulo 4). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-5',
      linguagem: 'js',
      nome: 'Funções',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Funções" (JavaScript · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Funções" (JavaScript · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Funções" (JavaScript · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Funções" (JavaScript · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Funções" (JavaScript · Módulo 5). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-6',
      linguagem: 'js',
      nome: 'Arrays',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Arrays" (JavaScript · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Arrays" (JavaScript · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Arrays" (JavaScript · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Arrays" (JavaScript · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Arrays" (JavaScript · Módulo 6). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-7',
      linguagem: 'js',
      nome: 'Objetos',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Objetos" (JavaScript · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Objetos" (JavaScript · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Objetos" (JavaScript · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Objetos" (JavaScript · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Objetos" (JavaScript · Módulo 7). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-8',
      linguagem: 'js',
      nome: 'Manipulação do DOM',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Manipulação do DOM" (JavaScript · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Manipulação do DOM" (JavaScript · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Manipulação do DOM" (JavaScript · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Manipulação do DOM" (JavaScript · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Manipulação do DOM" (JavaScript · Módulo 8). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-9',
      linguagem: 'js',
      nome: 'Eventos',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Eventos" (JavaScript · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Eventos" (JavaScript · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Eventos" (JavaScript · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Eventos" (JavaScript · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Eventos" (JavaScript · Módulo 9). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    },

    {
      id: 'js-modulo-10',
      linguagem: 'js',
      nome: 'Projeto Final de JavaScript',
      etapas: [
        {
          titulo: 'Etapa 1',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 1 do módulo "Projeto Final de JavaScript" (JavaScript · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 2',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 2 do módulo "Projeto Final de JavaScript" (JavaScript · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 3',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 3 do módulo "Projeto Final de JavaScript" (JavaScript · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 4',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 4 do módulo "Projeto Final de JavaScript" (JavaScript · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        },
        {
          titulo: 'Etapa 5',
          texto: '<p>[Placeholder] Conteúdo teórico da Etapa 5 do módulo "Projeto Final de JavaScript" (JavaScript · Módulo 10). Substitua este texto pela explicação real.</p>',
          missao: '[Placeholder] Descreva aqui a missão prática que o aluno deve cumprir nesta etapa.'
          // Campos opcionais que podem ser adicionados a qualquer etapa:
          // codigoInicial: { html: '...', css: '...', js: '...' },
          // verificar: function (codigo) { return 0; } // 0-100, calcula o % de acerto
        }
      ]
    }
    ]
  }  };

  /* Ordem de exibição das trilhas (ex.: se algum dia quiser listar
     "todas as trilhas" em algum lugar). */
  CL.curso.ORDEM_CURSOS = ['html', 'css', 'js'];

  CL.curso.getCurso = function (cursoId) {
    return CL.curso.CURSOS[cursoId] || null;
  };

  /* ===================================================== */
  /* HELPERS — usados tanto pela trilha da Dashboard (nível
     = módulo, dentro de UMA trilha) quanto pela trilha do
     IDE (nível = etapa, dentro de UM módulo). Recebem sempre
     o "progresso" no formato de CL.api.listProgress():
     { "moduloId:step": {concluida, percentual} }
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

  /* Procura um módulo pelo id em TODAS as trilhas — usado pelo IDE
     pra descobrir a qual curso (html/css/js) um moduloId pertence
     (ex.: veio de ide.html?modulo=css-modulo-4 ou de idePosition
     salvo no perfil do aluno). */
  CL.curso.encontrarModulo = function (moduloId) {
    var cursoIds = CL.curso.ORDEM_CURSOS;
    for (var i = 0; i < cursoIds.length; i++) {
      var curso = CL.curso.CURSOS[cursoIds[i]];
      if (!curso) continue;
      for (var j = 0; j < curso.modulos.length; j++) {
        if (curso.modulos[j].id === moduloId) {
          return { cursoId: cursoIds[i], curso: curso, modulo: curso.modulos[j], indice: j };
        }
      }
    }
    return null;
  };

  /* Um nó por módulo DE UMA trilha — usado na trilha da Dashboard.
     `modulos` é o array de UM curso (ex.: CL.curso.CURSOS.css.modulos),
     nunca módulos de trilhas diferentes misturados. */
  CL.curso.buildModuloNodes = function (modulos, progresso, moduloAtualId) {
    progresso = progresso || {};
    modulos = modulos || [];

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
