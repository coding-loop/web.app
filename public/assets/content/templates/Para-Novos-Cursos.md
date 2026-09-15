# Guia para criar um novo curso

Use este guia para criar uma nova trilha, seus módulos, etapas e posições.
Os exemplos usam o curso `python`. Troque `python` pelo ID do seu curso.

## 1. Crie a pasta do curso

Em `public/assets/content`, crie a pasta do novo curso:

```text
public/assets/content/python/
```

O ID deve ser simples, minúsculo e sem espaços. Exemplos: `python`, `react`, `sql`.

## 2. Registre o curso

Copie `templates/curso.js` para `python/curso.js` e ajuste os dados:

```js
(function () {
  window.CL.curso.registrarCurso({
    id: 'python',
    nome: 'Python',
    linguagem: 'python',
    descricao: 'Aprenda Python do zero.'
  });
})();
```

O `id` será usado em todos os arquivos seguintes e também na rota do curso:

```text
#course/python
```

## 3. Crie o primeiro módulo

Crie a pasta `python/modulo-01/` e, dentro dela, o arquivo `00-modulo.js`:

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

Regras importantes:

- O ID do módulo deve permanecer estável depois de publicado.
- O `numero` deve ser único dentro do curso.
- Use `python-modulo-02`, `python-modulo-03` e assim por diante para os próximos módulos.

## 4. Crie uma etapa/aula

Na mesma pasta do módulo, crie `etapa-01.js`:

```js
(function () {
  window.CL.curso.registrarEtapa('python-modulo-01', 1, {
    titulo: 'Olá, Python',
    texto: '<p>Conheça os primeiros comandos.</p>',
    questoes: [
      {
        pergunta: 'Qual comando exibe uma mensagem no console?',
        opcoes: ['console.log()', 'print()', 'alert()'],
        correta: 1,
        explicacao: 'Em Python, print() exibe texto no console.'
      }
    ],
    missao: 'Exiba uma mensagem no console.',
    codigoInicial: {
      html: '',
      css: '',
      js: 'console.log("Olá, Python!");'
    },
    verificar: function (codigo) {
      return /console\.log\s*\(/.test(codigo.js || '') ? 100 : 0;
    }
  });
})();
```

`questoes` é opcional. Cada questão precisa ter ao menos duas `opcoes` e
`correta` deve ser o índice (começando em `0`) da resposta correta. Use
`pergunta` e `explicacao` como texto simples; quando precisar de marcação HTML
no enunciado, use o campo opcional `perguntaHtml`.

Para mais aulas, crie `etapa-02.js`, `etapa-03.js` etc. O segundo argumento de `registrarEtapa` deve acompanhar o número da etapa.

Um módulo passa a ter conteúdo real quando possui etapas registradas. Evite trocar IDs de módulos e etapas publicados, pois o progresso dos usuários é associado a eles.

## 5. Planeje módulos futuros

Para exibir módulos futuros bloqueados, crie `python/modulos-planejamento.js`:

```js
(function () {
  'use strict';

  for (var numero = 2; numero <= 120; numero++) {
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

Quando for publicar um módulo planejado, mantenha o mesmo `id` e `numero`. Retire esse número do laço de planejamento e crie o arquivo do módulo real. Por exemplo, para publicar o módulo 2, acrescente antes do `registrarModulo`:

```js
if (numero === 2) continue;
```

Em seguida, crie `python/modulo-02/00-modulo.js` com `id: 'python-modulo-02'` e adicione suas etapas. Não registre duas vezes o mesmo ID: o sistema preserva o primeiro módulo encontrado.

## 6. Defina as posições da trilha

Copie `templates/posicoes-trilha.js` para `python/posicoes-trilha.js`.

No arquivo copiado, troque:

```js
window.CL.trilha.POSICOES['id-do-curso']
```

por:

```js
window.CL.trilha.POSICOES.python
```

Cada posição corresponde a um módulo, em ordem:

```js
var pontos = [
  [0, 0],     // módulo 1
  [100, 80],  // módulo 2
  [0, 160]    // módulo 3
];
```

- Primeiro valor: deslocamento horizontal (`x`), em pixels.
- Segundo valor: deslocamento vertical (`y`), em pixels.
- Índice `0` do array corresponde ao módulo `1`.

Você pode começar copiando as posições de HTML, CSS ou JS e adaptá-las. Cada curso deve ter seu próprio `posicoes-trilha.js`, para que alterações futuras não afetem outros cursos.

## 7. Atualize o catálogo de conteúdo

Depois de criar ou renomear arquivos `.js` em `public/assets/content`, execute no PowerShell, na raiz do projeto:

```powershell
.\scripts\gerar-manifest-conteudo.ps1
```

Isso atualiza `public/assets/content/catalogo-automatico.js`, que é responsável por carregar os arquivos do curso.

## Estrutura final esperada

```text
public/assets/content/python/
├── curso.js
├── modulos-planejamento.js
├── posicoes-trilha.js
└── modulo-01/
    ├── 00-modulo.js
    ├── etapa-01.js
    └── etapa-02.js
```

## Checklist antes de publicar

- O curso foi registrado em `curso.js`.
- Cada módulo publicado possui um ID único e pelo menos uma etapa.
- Módulos publicados foram removidos do laço de módulos planejados.
- O arquivo de posições usa o ID correto do curso.
- O catálogo automático foi regenerado.
- IDs já publicados não foram renomeados.
