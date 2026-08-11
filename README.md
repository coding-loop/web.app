# Coding Loop

Plataforma de cursos práticos de programação. O site é estático (HTML, CSS e JavaScript) e usa Firebase para autenticação, progresso e exercícios salvos.

## Executar localmente

Abra a pasta `public` com Live Server/Live Preview em `http://localhost`. Não abra os arquivos por duplo clique (`file://`), pois o Firebase Auth exige HTTP(S).

## Onde fica o conteúdo

Todo conteúdo novo deve ficar em `public/assets/content/`. Antes de montar o dashboard ou a IDE, a aplicação escolhe um dos dois catálogos abaixo.

## Escolher catálogo automático ou manual

- `catalogo-automatico.js`: criado pelo gerador ao varrer as pastas.
- `catalogo-manual.js`: lista de arquivos que você edita manualmente.

O arquivo ativo é `modo.js`. Para mudar pelo nome do arquivo, renomeie o `modo.js` atual para `modo-anterior.js` e renomeie `modo-automatico.js` ou `modo-manual.js` para `modo.js`. Recarregue a página depois da troca. O modo ativo inicial é o automático.

Os arquivos-modelo estão em `public/assets/content/templates/`:

- `curso.js.example`
- `modulo.js.example`
- `etapa.js.example`

Cada arquivo é independente: ele apenas registra um curso, módulo ou etapa na API `CL.curso`.

## Criar um curso

1. Crie `public/assets/content/<curso>/curso.js` a partir de `templates/curso.js.example`.
2. Escolha um `id` permanente, minúsculo e sem espaços, por exemplo `python`.
3. Informe `nome`, `linguagem` e, opcionalmente, `logo` no registro.
4. Crie os módulos e etapas do curso como descrito abaixo.
5. No modo automático, rode `powershell -ExecutionPolicy Bypass -File .\scripts\gerar-manifest-conteudo.ps1`. No modo manual, inclua o caminho do arquivo em `catalogo-manual.js`.

O curso aparecerá automaticamente no menu do dashboard e em `#course/<id>`.

## Criar um módulo

1. Crie `public/assets/content/<curso>/modulo-01/modulo.js` a partir de `templates/modulo.js.example`.
2. Use um id permanente como `<curso>-modulo-01`.
3. Defina `numero`, `nome` e deixe `etapas: []`.
4. Crie as etapas na mesma pasta.
5. Atualize o catálogo escolhido.

Os módulos são ordenados pela ordem em que seus arquivos são carregados. Mantenha nomes com zero à esquerda (`modulo-01`, `modulo-02`) para a ordem ficar previsível.

## Criar uma etapa

1. Crie `public/assets/content/<curso>/modulo-01/etapa-01.js` a partir de `templates/etapa.js.example`.
2. Informe `moduloId`, número da etapa, `titulo`, `texto`, `missao` e `codigoInicial`.
3. Faça `verificar(codigo)` retornar de 0 a 100. `codigo` possui `html`, `css` e `js`.
4. Atualize o catálogo escolhido.

Exemplo de validação simples:

```js
verificar: function (codigo) {
  return /<h1[^>]*>\s*[^<]+/i.test(codigo.html || '') ? 100 : 0;
}
```

## Regra importante para não perder progresso

Nunca mude o `id` de um curso ou módulo depois de publicar. O progresso salvo no Firestore usa a chave `<moduloId>:<numeroDaEtapa>`. É seguro corrigir textos, missões, código inicial e regras de validação; para reorganizações grandes, crie um novo módulo em vez de renomear o antigo.

## Conteúdo existente

O catálogo anterior foi mantido em `public/assets/js/curso-data.js` para preservar os cursos atuais. As novas etapas de HTML do módulo 1 já foram extraídas para `public/assets/content/html/modulo-01/` como referência real de implementação. Os próximos conteúdos devem ser adicionados na nova estrutura, não no catálogo legado.
