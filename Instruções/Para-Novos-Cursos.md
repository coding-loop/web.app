# Guia para criar um novo curso

Use este guia para criar uma trilha, seus módulos e etapas na **convenção final**.
Os exemplos usam o curso `python`. Troque `python` pelo ID do seu curso.

Um curso completo tem **duas partes**, e as duas são obrigatórias:

- **Parte A — Conteúdo** (passos 1 a 6): a pasta do curso em `public/assets/content/`, com módulos, etapas, módulos futuros e posições.
- **Parte B — Registro no app** (passos 7 a 9): os pontos de código que fazem o curso aparecer no menu, com logo, fundo e formato de trilha próprios, e que permitem à IDE carregar o conteúdo.

Só a Parte A deixa o curso funcionando pela metade: os módulos existem, mas ele fica sem logo, sem fundo próprio, com o formato de trilha de outro curso e, na IDE, sem o conteúdo das abas (ver "Problemas comuns").

## Convenção de nomes (resumo)

```text
public/assets/content/python/
├── python-modulos-planejamento.js
├── python-posicoes-trilha.js                      (opcional)
└── python-modulo-01/
    ├── python-00-modulo-01.js                     (registra o módulo)
    └── python-etapa-01/
        ├── python-modulo-01-etapa-01.js           (registro da etapa)
        ├── python-modulo-01-etapa-01-conteudo.html / .css / .js
        ├── python-modulo-01-etapa-01-exercicio.html / .css / .js
        ├── python-modulo-01-etapa-01-questoes.html / .css / .js
        └── python-modulo-01-etapa-01-desafio.html / .css / .js
```

| Item | Regra |
|---|---|
| Pasta e prefixo | simples, minúsculos, sem espaços; hífen para mais de uma palavra (`cyber-security`) |
| ID do curso | normalmente igual à pasta. Pode diferir (o LogProg tem pasta `logprog` e ID `programming-logic`, ligados em `PASTAS_DE_CONTEUDO`) |
| ID do módulo | `<idDoCurso>-modulo-NN`, dois dígitos (`python-modulo-01`) |
| Pasta do módulo | `<prefixo>-modulo-NN/` |
| Pasta da etapa | `<prefixo>-etapa-NN/` dentro da pasta do módulo |
| Arquivos da etapa | **13**: o registro `.js` + 4 abas × `.html/.css/.js` |

> Cada curso tem a sua própria pasta e seus próprios arquivos. Nenhum arquivo é compartilhado entre cursos.

## 1. Crie a pasta do curso

```text
public/assets/content/python/
```

## 2. Registre o curso em `curso-data.js`

Abra `public/assets/js/curso-data.js` e acrescente uma chave em `CL.curso.CURSOS`, no formato dos outros cursos, com `modulos: []` (o conteúdo vem dos arquivos da pasta):

```js
'python': {
  id: 'python',
  nome: 'Python',
  linguagem: 'python',
  descricao: 'Aprenda Python do zero.',
  modulos: []
}
```

Depois coloque o ID em `CL.curso.ORDEM_CURSOS`, na posição em que o curso deve aparecer no menu. Hoje a ordem é:

```js
CL.curso.ORDEM_CURSOS = ['programming-logic', 'cyber-security', 'html', 'css', 'js'];
```

O `curso-data.js` é a **fonte única** dos metadados básicos e da ordem global. **Não crie `curso.js`**: `registrarCurso()` só cria o curso se ele ainda não existir, então com o curso já cadastrado a chamada não faz nada. O ID será usado em todos os arquivos seguintes e na rota do curso (`#course/python`).

## 3. Crie o primeiro módulo

Crie `python/python-modulo-01/python-00-modulo-01.js`:

```js
(function () {
  window.CL.curso.registrarModulo('python', {
    id: 'python-modulo-01',
    numero: 1,
    nome: 'Primeiros passos',
    etapas: []
  });
})();
```

- O primeiro argumento de `registrarModulo` é o **ID do curso**, não o do módulo. O curso precisa existir em `curso-data.js`, senão dá erro.
- O ID do módulo deve permanecer estável depois de publicado.
- Não registre duas vezes o mesmo ID: o sistema preserva o primeiro módulo encontrado, sem aviso.

## 4. Crie as etapas

Cada etapa tem a **sua pasta** e **13 arquivos**. Nada é obrigatório em branco: um arquivo sem conteúdo ainda precisa existir (o `scripts/verify-deploy.cjs` confere).

### 4.1 O registro da etapa

`python/python-modulo-01/python-etapa-01/python-modulo-01-etapa-01.js`:

```js
(function () {
  'use strict';

  window.CL.curso.registrarEtapa('python-modulo-01', 1, {
    titulo: 'Olá, Python',
    codigoInicial: { html: '', css: '', js: 'console.log("Olá, Python!");' },
    verificar: function (codigo) {
      return /console\.log\s*\(/.test(codigo.js || '') ? 100 : 0;
    }
  });
})();
```

- O segundo argumento deve acompanhar o número da etapa e o número nos nomes dos arquivos. O sistema não valida isso.
- `verificar(codigo)` recebe `{ html, css, js }` e devolve de 0 a 100. Ele confere só o **texto** do código (regex): um comentário no código do aluno pode enganá-lo. Se isso importar, remova comentários antes de testar (`html.replace(/<!--[\s\S]*?-->/g, '')`).
- O registro **não** tem `texto`, `questoes` nem `desafio`: esses vêm dos arquivos de aba.

### 4.2 Os arquivos de aba

A IDE carrega cada aba sob demanda, na ordem HTML → CSS → JS, e só uma vez.

| Aba na IDE | Arquivos | O que vai neles |
|---|---|---|
| Conteúdo | `-conteudo.html/.css/.js` | teoria e exemplos interativos (HTML livre) |
| Exercício | `-exercicio.html/.css/.js` | enunciado da missão (o código inicial e a validação ficam no registro) |
| Desafio | `-desafio.html/.css/.js` | enunciado do desafio (HTML livre, sem verificação própria) |
| Quiz | `-questoes.html/.css/.js` | contêiner de questões e o JS que as publica |

Ordem em que o aluno libera as abas: Conteúdo → Exercício → Desafio → Quiz.

`-questoes.html` precisa conter o contêiner onde a IDE desenha as questões:

```html
<div data-step-questions></div>
```

`-questoes.js` publica as questões na chave `<moduloId>:<número da etapa>`:

```js
(function () {
  var curso = window.CL.curso;
  curso.questoesPorEtapa = curso.questoesPorEtapa || {};
  curso.questoesPorEtapa['python-modulo-01:1'] = [
    {
      pergunta: 'Qual comando exibe uma mensagem no console?',
      opcoes: ['console.log()', 'print()', 'alert()'],
      correta: 0,
      explicacao: 'console.log() escreve no console.'
    }
  ];
})();
```

Cada questão tem ao menos duas `opcoes`, e `correta` é o índice (a partir de `0`) da resposta certa. Os arquivos de aba que não precisam de nada (por exemplo `-exercicio.js`) podem conter só `(function () {})();`, e os `.css` vazios, só o comentário de cabeçalho dos outros.

### 4.3 Isolamento (obrigatório)

Os fragmentos de várias etapas e cursos convivem na mesma página, então:

- **CSS:** todo seletor fica dentro da raiz da etapa. Use um prefixo próprio do curso (`.py-*`, variáveis `--py-*` definidas em `.py-etapa`) ou `@scope (.python-etapa) { ... }`. Nada de seletor global, `:root` ou classe genérica (`.card`, `.logo`).
- **JS:** registre listeners no `.theory-pane` e ignore eventos que não venham da raiz da sua etapa (`event.target.closest('.py-etapa')`). Não use `onclick` inline e não exponha funções em `window`.
- **Caminhos:** imagens e links usam caminho **relativo** (`assets/images/...`). Um caminho absoluto como `/public/assets/...` funciona no servidor local e quebra no GitHub Pages.
- **Dados do aluno:** campos de reflexão ou anotação não devem ser salvos nem enviados a lugar algum, a menos que isso seja decidido e documentado.

## 5. Planeje módulos futuros

`python/python-modulos-planejamento.js` registra os módulos **ainda não publicados**, começando no primeiro número livre. Ele **nunca** pode criar módulos vazios antes dos reais: o índice do curso deve abrir num módulo publicado, com suas etapas, e não num espaço reservado.

```js
(function () {
  'use strict';

  var PRIMEIRO_MODULO_PLANEJADO = 3; // os módulos 1 e 2 estão publicados
  var ULTIMO_MODULO = 120;
  for (var numero = PRIMEIRO_MODULO_PLANEJADO; numero <= ULTIMO_MODULO; numero++) {
    var numeroFormatado = String(numero).padStart(2, '0');
    window.CL.curso.registrarModulo('python', {
      id: 'python-modulo-' + numeroFormatado,
      numero: numero,
      nome: 'Módulo ' + numero,
      etapas: []
    });
  }
})();
```

Ao publicar um módulo planejado, aumente `PRIMEIRO_MODULO_PLANEJADO` e crie a pasta e o registro do módulo real, **com o mesmo `id`**.

## 6. Defina as posições da trilha

A posição de cada módulo na trilha vem de duas camadas, e só a primeira é obrigatória:

- **Camada 1 — o formato do ziguezague (`CICLOS_TRILHA`, em `trilha.js`).** Sem entrada, o curso cai no formato do `programming-logic`. Faz-se no passo 7.
- **Camada 2 — o ajuste fino (`python-posicoes-trilha.js`, opcional).** Soma um deslocamento em pixels a cada módulo. Crie o arquivo **só se houver geometria personalizada**; hoje existem em `css`, `html`, `js` e `cyber-security` (o LogProg usa só a camada 1).

Para criar o arquivo, copie `templates/posicoes-trilha.js` para `python/python-posicoes-trilha.js` e troque `window.CL.trilha.POSICOES['id-do-curso']` por `window.CL.trilha.POSICOES.python` (ou `POSICOES['cyber-security']`, para IDs com hífen). Cada posição corresponde a um módulo, em ordem: o índice `0` é o módulo 1, o primeiro valor é o deslocamento horizontal e o segundo, o vertical.

## 7. Registre o visual do curso no app

**a) `public/assets/js/trilha.js`** — três mapas, uma entrada em cada:

```js
// CICLOS_TRILHA — formato do ziguezague (12 blocos; cada trio soma 7)
'python': [
  ['R', [3, 2, 2]], ['L', [1, 3, 3]], ['R', [3, 3, 1]], ['L', [2, 3, 2]],
  ['R', [2, 2, 3]], ['L', [3, 2, 2]], ['R', [1, 3, 3]], ['L', [3, 3, 1]],
  ['R', [2, 3, 2]], ['L', [2, 2, 3]], ['R', [3, 2, 2]], ['L', [1, 3, 3]]
],

// CL.trilha.LOGOS — ícone dentro do nó do módulo
'python': 'assets/images/icons.svg/logo-python.svg',

// imagensTitulo (em atualizarTituloFixo) — banner fixo do topo
'python': 'assets/images/trilha-titulo-bg-python.png',
```

Use uma sequência de `CICLOS_TRILHA` que não repita a de outro curso.

**b) `public/assets/css/trilha.css`** — duas regras:

```css
.trilha-container[data-curso="python"] {
  background-image:
    linear-gradient(rgba(0, 0, 0, .55), rgba(0, 0, 0, .55)),
    url("../images/trilha-bg-python.png");
}

.trilha-container:not(.trilha-container--indice)[data-curso="python"] {
  background-image: linear-gradient(rgba(0, 0, 0, .4), rgba(0, 0, 0, .4)), url("../images/trilha-bg-python.png");
}
```

**c) `public/assets/js/pagina-curso.js`** — em `logoCursoSvg()` (logo grande do menu) e em `layoutPorCurso`:

```js
if (linguagem === 'python') {
  return '<span class="cl-course-logo cl-course-logo--python" aria-hidden="true">' +
    '<img class="cl-course-logo__theme" src="assets/images/icons.svg/logo-python.svg" alt="">' +
    '</span>';
}
// ...
'python': 'logprog-ziguezague',
```

**d) Imagens** (arquivos reais; nomes sem `#`, parênteses ou espaços — o `#` vira fragmento de URL e o `<img>` não carrega):

- `public/assets/images/icons.svg/logo-python.svg`
- `public/assets/images/trilha-titulo-bg-python.png`
- `public/assets/images/trilha-bg-python.png`

## 8. Ligue o curso à IDE e à verificação

**a) `public/assets/js/ide.js`** — acrescente o curso em `PASTAS_DE_CONTEUDO`. Sem essa entrada a IDE não carrega os arquivos de aba e as etapas ficam sem teoria, exercício, desafio e quiz:

```js
const PASTAS_DE_CONTEUDO = {
  // ...
  python: { pasta: 'python', prefixo: 'python' }
};
```

A chave é o **ID do curso** (`programming-logic`, por exemplo); `pasta` e `prefixo` são os da pasta em `content/`.

**b) `scripts/verify-deploy.cjs`** — acrescente o curso em `cursosComEtapas`, para o script conferir os 13 arquivos de cada etapa:

```js
{ pasta: 'python', prefixo: 'python' }
```

## 9. Atualize o catálogo de conteúdo

Depois de criar, apagar ou renomear arquivos em `public/assets/content`, execute na raiz do projeto:

```powershell
.\scripts\gerar-manifest-conteudo.ps1
```

Isso atualiza `catalogo-automatico.js`. O catálogo lista **só os registros** (`*-00-modulo-NN.js`, `*-modulo-NN-etapa-NN.js`, planejamento e posições); os arquivos de aba não entram nele. **Rode o script também ao apagar arquivos**: se o catálogo listar um arquivo que não existe, dá 404 e os módulos de todos os cursos podem sumir de uma vez.

Se usar o modo manual, mantenha `catalogo-manual.js` com os mesmos arquivos e na mesma ordem do automático. Depois de trocar arquivos de `assets/js` ou `assets/css`, recarregue com **Ctrl+F5**.

## Estrutura final esperada

```text
public/assets/content/python/
├── python-modulos-planejamento.js
├── python-posicoes-trilha.js          (opcional)
└── python-modulo-01/
    ├── python-00-modulo-01.js
    └── python-etapa-01/               (13 arquivos)

public/assets/js/curso-data.js         ← chave do curso + ORDEM_CURSOS
public/assets/js/trilha.js             ← CICLOS_TRILHA, LOGOS, imagensTitulo
public/assets/js/pagina-curso.js       ← logoCursoSvg, layoutPorCurso
public/assets/js/ide.js                ← PASTAS_DE_CONTEUDO
public/assets/css/trilha.css           ← 2 regras de fundo (data-curso)
scripts/verify-deploy.cjs              ← cursosComEtapas
public/assets/images/icons.svg/logo-python.svg
public/assets/images/trilha-titulo-bg-python.png
public/assets/images/trilha-bg-python.png
```

## Checklist antes de publicar

**Parte A — conteúdo**

- A pasta do curso existe em `assets/content/<pasta>/` e cada etapa tem os **13 arquivos**.
- Cada módulo publicado tem ID único (`<curso>-modulo-NN`) e pelo menos uma etapa.
- O arquivo de planejamento **não** cria módulos antes dos publicados.
- O arquivo de posições, se existir, usa o ID correto do curso.
- IDs já publicados não foram renomeados.
- CSS e JS de etapa estão isolados (seção 4.3) e os caminhos de imagem são relativos.

**Parte B — registro no app**

- O curso está em `CL.curso.CURSOS` e em `CL.curso.ORDEM_CURSOS`.
- `CICLOS_TRILHA`, `LOGOS` e `imagensTitulo` (`trilha.js`) têm a entrada do curso.
- `trilha.css` tem as duas regras de fundo.
- `pagina-curso.js` tem o caso em `logoCursoSvg()` e a entrada em `layoutPorCurso`.
- `ide.js` tem a entrada em `PASTAS_DE_CONTEUDO` e `verify-deploy.cjs`, em `cursosComEtapas`.
- Os 3 arquivos de imagem existem, com os nomes exatos.
- O catálogo foi regenerado e `node scripts/verify-deploy.cjs` passa.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| A etapa abre vazia ou com "Não foi possível carregar o conteúdo desta aba" | Falta a entrada em `PASTAS_DE_CONTEUDO` (`ide.js`), um dos 13 arquivos não existe ou o nome não segue `<prefixo>-modulo-NN-etapa-NN-<aba>.<ext>` |
| O Quiz abre sem questões | `-questoes.js` não publica em `questoesPorEtapa['<moduloId>:<n>']`, ou o ID do módulo/número da etapa estão errados |
| O índice abre num módulo "vazio" ou sem etapas | O planejamento está criando módulos antes dos publicados, ou o módulo real não foi registrado |
| A trilha do curso novo tem o mesmo formato da do LogProg | Falta a entrada em `CICLOS_TRILHA` (cai no fallback), ou o `trilha.js` novo não foi copiado para `assets/js` |
| O curso não tem logo no menu | Falta o caso em `logoCursoSvg()` ou o nome do SVG não bate com o arquivo (ou tem `#` no nome) |
| Os nós dos módulos ficam sem ícone | Falta a entrada em `CL.trilha.LOGOS` |
| Fundo ou banner do topo da trilha ausente | Falta a regra em `trilha.css` ou a entrada em `imagensTitulo` |
| Imagem de uma etapa não aparece só no site publicado | O caminho é absoluto (`/public/...`); use caminho relativo |
| Estilo ou clique de uma etapa afeta outra | Seletor CSS global ou listener fora da raiz da etapa (seção 4.3) |
| Os módulos sumiram de todas as trilhas depois de apagar arquivos | O catálogo ainda lista o arquivo apagado: rode `gerar-manifest-conteudo.ps1` |
| Erro ao carregar `*-00-modulo-NN.js` | O curso não foi registrado em `curso-data.js`: `registrarModulo` exige que o curso exista |
