# Padrão de Conteúdo das Etapas

Este documento define como organizar o conteúdo das etapas nos cursos HTML, CSS, JavaScript, Lógica de Programação e Cyber Security.

## Estrutura de pastas

Cada modulo tem uma pasta, e cada etapa tem sua propria subpasta. Dentro dela ficam o registro da etapa e os arquivos HTML, CSS e JS das quatro abas:

```text
public/assets/content/<curso>/<curso>-modulo-01/
└── <curso>-etapa-01/
    ├── <curso>-modulo-01-etapa-01.js
    ├── <curso>-modulo-01-etapa-01-conteudo.html
    ├── <curso>-modulo-01-etapa-01-conteudo.css
    ├── <curso>-modulo-01-etapa-01-conteudo.js
    ├── <curso>-modulo-01-etapa-01-exercicio.html
    ├── <curso>-modulo-01-etapa-01-exercicio.css
    ├── <curso>-modulo-01-etapa-01-exercicio.js
    ├── <curso>-modulo-01-etapa-01-questoes.html
    ├── <curso>-modulo-01-etapa-01-questoes.css
    ├── <curso>-modulo-01-etapa-01-questoes.js
    ├── <curso>-modulo-01-etapa-01-desafio.html
    ├── <curso>-modulo-01-etapa-01-desafio.css
    └── <curso>-modulo-01-etapa-01-desafio.js
```

Use somente letras minúsculas, números e hífens nos nomes. Os prefixos atuais são `html`, `css`, `js`, `logprog` e `cyber-security`. O curso `programming-logic` usa o prefixo e a pasta `logprog` nos arquivos.

## Responsabilidade de cada arquivo

- O JS principal da etapa registra `titulo`, `codigoInicial` e `verificar(codigo)`. Mantenha nele somente dados necessários ao índice, ao editor e ao progresso.
- O HTML de `conteudo` apresenta a explicação principal da etapa.
- O HTML de `exercicio` descreve a missão prática.
- O HTML de `questoes` contém o ponto de montagem `<div data-step-questions></div>`. As perguntas, opções, índice da resposta correta e explicação ficam no JS de `questoes`, em `CL.curso.questoesPorEtapa`, conforme o contrato usado por `ide.js`.
- O HTML de `desafio` apresenta a atividade aberta ou uma aplicação mais autônoma.
- O CSS de cada aba deve estilizar somente o conteúdo daquela aba. Prefixe classes com a sigla do curso ou com um nome específico da etapa para evitar conflitos.
- O JS de cada aba implementa somente as interações daquele conteúdo. Como os scripts são carregados sob demanda e ficam em cache, não registre o mesmo listener em mais de um arquivo.

## Estrutura semântica do conteúdo

O documento de Conteúdo é um fragmento inserido dentro da aba da IDE, não uma página HTML completa. Use um único `<article>` como raiz semântica da aula. Dentro do `<header>` do artigo, use um `<h2 class="step-content-title">` para o título da etapa; ele deve corresponder ao campo `titulo` do JS principal. Use `<h3>` para as seções principais e `<h4>` para subseções.

Exemplo:

```html
<article class="cs-etapa">
  <header class="cs-hero">
    <span class="cs-kicker">Módulo 1 · Etapa 1</span>
    <h2 class="step-content-title">Proteja sistemas, informacoes e pessoas</h2>
    <p class="cs-introducao">
      Apresente o tema, o contexto e o que a pessoa vai aprender.
    </p>
  </header>

  <section class="cs-bloco" aria-labelledby="conceitos-basicos">
    <h3 id="conceitos-basicos">Conceitos básicos</h3>
    <p>Explique uma ideia principal por parágrafo, com linguagem direta.</p>

    <figure>
      <img src="caminho-relativo-da-imagem.jpg" alt="Descrição objetiva do que a imagem mostra">
      <figcaption>Legenda que acrescenta contexto à imagem.</figcaption>
    </figure>
  </section>

  <section class="cs-bloco" aria-labelledby="aplicacao">
    <h3 id="aplicacao">Aplicação prática</h3>
    <p>Mostre como reconhecer ou aplicar o conceito em uma situacao real.</p>
  </section>
</article>
```

O exemplo de classes `cs-*` é específico de Cyber Security. Nos outros cursos, use as classes já adotadas pelo curso ou crie classes com o prefixo correspondente.

### Titulos e secoes

- Mantenha o título do HTML de Conteúdo igual ao `titulo` do registro da etapa.
- Use o nível de cabeçalho seguinte para seções principais e avance os níveis sem saltos para subseções.
- Não use `<h1>` apenas para aumentar a fonte; a aparência pertence ao CSS.
- Agrupe cada assunto principal em `<section>` com um título que descreva seu conteúdo.
- Use `<article>` uma vez para a aula completa. Um bloco que não representa um assunto independente pode ser `<div>` ou outro elemento semântico adequado.
- Prefira elementos nativos como listas, `<figure>`, `<figcaption>`, `<blockquote>`, `<code>` e `<pre>` quando eles representam corretamente o conteúdo.

## Acessibilidade e qualidade

- Escreva textos alternativos úteis para imagens informativas. Use `alt=""` em imagens puramente decorativas.
- Associe controles a rótulos; torne botões acionáveis por teclado e apresente feedback em texto, não apenas por cor.
- Use IDs únicos no documento e rótulos claros em iframes, regiões e grupos de controles.
- Evite parágrafos longos, títulos vagos, texto usado apenas para inserir palavras-chave e repetição artificial de termos.
- Teste o contraste de texto, fundo, bordas e estados interativos nos temas Solarized Light e Solarized Dark. Não fixe uma combinação de cores que só funcione em um tema.
- Mantenha imagens e outros recursos com caminhos relativos que funcionem no GitHub Pages sob `/web.app/`.

## SEO e dados estruturados

A IDE e áreas de estudo exigem autenticação e estão classificadas com `noindex`. Os HTMLs acima são fragmentos, não URLs públicas independentes; portanto, `<article>` melhora a semântica e a manutenção, mas não torna a etapa indexável nem garante resultado enriquecido no Google.

- Não adicione `<html>`, `<head>`, `<body>`, meta description, canonical ou meta robots aos fragmentos carregados dentro das abas.
- Não use `itemscope`, `itemtype` ou propriedades Schema.org com a expectativa de melhorar o ranking da IDE.
- Não invente autor, data de publicação, imagem ou fonte. Inclua esses dados somente quando existirem e forem exibidos de forma coerente para a pessoa usuária.
- Se uma aula se tornar uma página pública independente, crie uma rota/documento completo fora do fluxo autenticado, com conteúdo acessível sem login, título e descrição próprios, canonical correto e dados estruturados válidos quando aplicáveis. Reavalie `robots` nessa página pública; não remova o `noindex` da IDE.
- `noindex` orienta buscadores, mas não protege arquivos estáticos. Não coloque segredos ou dados privados em `public/assets/content/`.

## Exemplo do registro principal

```js
(function () {
  'use strict';

  window.CL.curso.registrarEtapa('html-modulo-01', 1, {
    titulo: 'Bem-vindo ao HTML',
    codigoInicial: {
      html: '<h1>Minha pagina</h1>',
      css: '',
      js: ''
    },
    verificar: function (codigo) {
      return /<h1[^>]*>\s*[^<]+/i.test(codigo.html || '') ? 100 : 0;
    }
  });
})();
```

O texto explicativo não deve ser duplicado no campo `texto` do registro e no HTML de Conteúdo. A missão e o desafio ficam nos respectivos HTMLs; as questões ficam no JS próprio da aba.

## Lista de verificacao

- Cada etapa possui uma pasta e os 13 arquivos esperados: um JS de registro e quatro trios HTML/CSS/JS.
- O título do registro corresponde ao `<h2 class="step-content-title">` no HTML de Conteúdo e fica dentro do `<article>`.
- O Conteúdo tem um `<article>` raiz e seções com títulos descritivos.
- Questões mantem o placeholder `data-step-questions` e seus dados no JS da aba.
- Os scripts nao duplicam listeners; o CSS considera os dois temas.
- O catalogo ativo foi atualizado e `node scripts/verify-deploy.cjs` passa.
