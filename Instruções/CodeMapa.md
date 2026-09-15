# MAPA.md — Guia de seleção de arquivos por tarefa

> Objetivo: antes de começar a trabalhar em uma tarefa, consultar este mapa
> pra decidir **quais arquivos colar na conversa**, além do que já está no
> conhecimento permanente do projeto. Evita subir o repositório inteiro.
> Complementa `STATUS.md` (estado) e as instruções do projeto (convenções).
>
> **Atualizado** após a sessão de deploy do Firebase + GitHub Pages +
> ambiente local — ver STATUS.md §11 para o relato completo. Adicionadas
> as linhas de "Deploy/infra" que não existiam antes (o mapa original só
> cobria o código do app, não a operação de publicação).

## Como usar

1. Identifique a área da tarefa na tabela da seção 2.
2. Suba os arquivos da coluna **"Subir agora"**. Os da coluna **"Já no
   núcleo"** não precisam ser colados de novo — só cite o nome se for
   relevante lembrar.
3. Se a tarefa cruzar duas áreas (ex.: "mexer no backup E na aba Questões"),
   una as linhas correspondentes.
4. Se a tarefa não bater com nenhuma linha, veja a seção 4.

## 1. Núcleo (sempre presente no conhecimento do projeto)

`firebase-init.js` · `auth.js` · `api.js` · `router.js` · `app.js` ·
`firebase.json` · `firestore.rules` · `curso.js`/`etapa.js`/`modulo.js`/
`posicoes-trilha.js` (templates) · `Para-Novos-Cursos.md` ·
`pagina-dashboard.js` (exemplo de página) · `STATUS.md`

Não suba de novo nenhum desses — se a tarefa precisar deles, eles já estão
carregados.

---

## 2. Tarefa → arquivos

| Área da tarefa | Subir agora | Não precisa |
|---|---|---|
| **Login/cadastro, OAuth, "esqueci a senha", exclusão de conta (tela)** | `index.html` (landing/login) | `dashboard.html`, `ide.*` |
| **Dashboard do aluno (cards de progresso, avisos, saudação)** | `dashboard.html`, `dashboard.css`, `carrossel.js` (se envolver o carrossel de destaques) | `ide.*`, `curso-data.js` inteiro (só se for mexer em curso específico) |
| **Trilha/mapa de módulos (visual, posições, bloqueio sequencial)** | `trilha.js`, `trilha.css`, `pagina-curso.js` | `ide.*` |
| **Criar/editar curso, módulo ou etapa (conteúdo pedagógico)** | o arquivo de conteúdo específico do curso em `assets/content/<curso>/...` (pedir pro usuário colar), `curso-data.js` **só** se for um dos cursos nativos (html/css/js) | os outros `pagina-*.js`, CSS |
| **Sistema de carregamento de conteúdo (manifest automático/manual)** | `catalogo-automatico.js`, `catalogo-manual.js`, `modo.js`, `curso-etapas-loader.js` | `curso-data.js` inteiro |
| **Editor de código / Monaco / verificação de exercício** | `ide.html`, `ide.js`, `ide.css` | `dashboard.html`, `trilha.*` |
| **Preview do código do aluno (iframe, sandbox, postMessage)** | `ide.js` (seção do iframe, ~linha 2900-3030 na versão auditada) | resto do IDE se a dúvida for só sobre o preview |
| **Backup manual (Drive/OneDrive/computador/local)** | `ide.js` (seções de backup, ~linha 600-940 e ~770-820 na versão auditada), `api.js` (já no núcleo — funções `getBackupSettings`/`saveBackupSettings`/`saveLocalBackup`) | `ide.html` inteiro se a dúvida for só na lógica |
| **Abas da etapa no IDE (Conteúdo/Questões/Exercício/Desafio)** | `ide.js` (função `renderEtapas`, ~linha 393-580 na versão auditada), `ide.css` (classes `.step-*`) | `trilha.*`, `dashboard.*` |
| **Tradução de erros do TypeScript/Monaco pro português** | `integracao-traducao-diagnosticos.js`, arquivo `dicionario-typescript-pt-br.js` (pedir pro usuário colar — não estava nos uploads) | resto do `ide.js` |
| **Configurações de conta (tema, layout, trocar senha, excluir conta)** | `pagina-configuracoes.js`, trecho de `dashboard.html` com `id="cl-page-settings"` | `ide.*`, `trilha.*` |
| **Roteamento, navegação entre páginas, ordem de carregamento de scripts** | `router.js` e `app.js` (já no núcleo) + o `<head>`/lista de `<script>` do HTML da página em questão (`dashboard.html` ou `index.html`) | conteúdo interno das páginas |
| **Toasts, modais, tema claro/escuro, helpers de DOM genéricos** | `app.js` (já no núcleo, seções `CL.ui`/`CL.dom`/`CL.events`) — se o bug for na landing/IDE especificamente, também o `<script>` inline correspondente em `index.html`/`ide.html` | CSS, a não ser que seja visual |
| **CSS / estilo visual (cores, espaçamento, tema)** | o `.css` específico da tela (`dashboard.css`, `trilha.css`, `ide.css`) + `global.css` se for algo compartilhado (variáveis de tema, toast, botão genérico) | JS, a não ser que o bug seja de classe não aplicada |
| **Scroll horizontal de abas/tabs que "trava" ou não aparece** | `scrollable-controls.js` + o HTML da tela específica (procurar por `data-scrollable-controls`/`data-scroll-viewport`) | o resto do JS da tela |
| **Regras de segurança do Firestore, quem pode ler/escrever o quê** | `firestore.rules` (já no núcleo) | — |
| **Deploy do Firebase (regras/índices do Firestore, script de publicação)** | `firebase.json` (raiz), `.firebaserc`, `firestore.indexes.json`, `scripts/deploy-firebase.ps1` | `public/firebase.json` (é só config de emulador local, referencia o mesmo `firestore.rules`), qualquer JS do app |
| **Publicação do site (GitHub Pages / GitHub Actions)** | `.github/workflows/pages.yml` (pedir pro usuário colar — não estava nos uploads até agora), a seção "Publicar o site no GitHub Pages" do `README.md` | `firebase.json`, regras/índices |
| **Ambiente de desenvolvimento local (emuladores Auth/Firestore + Live Server)** | `firebase-init.js` (já no núcleo — citar mesmo assim), a seção "Executar localmente com emuladores" do `README.md` | resto do app, a não ser que o bug se manifeste num fluxo específico (aí soma com a linha correspondente, ex.: Login) |
| **Corrigir um item específico da lista de pendências do `STATUS.md`** | ver a coluna "Onde" da tabela de pendências no `STATUS.md` — ela já aponta o arquivo certo | — |

---

## 3. Acoplamento por ordem de carregamento (não é import — é `<script defer>`)

Cada página carrega um conjunto diferente de scripts, **na ordem abaixo**
(scripts `defer` executam nessa ordem, antes do `DOMContentLoaded`):

**`dashboard.html`:**
```
firebase SDKs → firebase-init.js → auth.js → api.js → curso-data.js →
assets/content/catalogo-automatico.js → catalogo-manual.js → modo.js →
curso-etapas-loader.js → trilha.js → router.js → scrollable-controls.js →
pagina-curso.js → pagina-dashboard.js → carrossel.js → pagina-perfil.js →
pagina-configuracoes.js → app.js  (← core do framework, carrega por ÚLTIMO)
```

**`index.html`:** confirmado por leitura direta (ver STATUS.md §3) —
`firebase SDKs → firebase-init.js → auth.js` + um `<script>` inline
próprio no fim do `<body>` (não usa `router.js`/`app.js`).

**`ide.html`:** também tem boot inline próprio (não usa `router.js`/`app.js`);
carrega `ide.js` e, se a tradução de diagnósticos estiver ativa, o
`dicionario-typescript-pt-br.js` **antes** dele.

**Por que isso importa pro mapa:** se a tarefa envolve adicionar algo que
`ide.html` ou `index.html` deveriam usar mas hoje só existe em `app.js`
(ex.: um novo tipo de toast, um novo helper de `CL.dom`), a mudança
provavelmente precisa ser replicada nos dois boots inline também — cole os
três lugares (`app.js`, e o `<script>` inline de `index.html`/`ide.html`),
não só um.

---

## 4. Quando a tarefa não bate com nenhuma linha da tabela

1. Suba só o núcleo (seção 1) + `STATUS.md` (já devem estar carregados).
2. Descreva a tarefa normalmente — geralmente dá pra apontar, só com o
   núcleo, qual arquivo específico (não incluído por padrão) precisa ser
   colado em seguida.
3. Se a tarefa for realmente nova/transversal (não existe ainda no projeto),
   não tem arquivo pra subir — é discussão de design antes de código.

---

## 5. Nota de confiabilidade deste mapa

Os caminhos de `dashboard.html`/`index.html` (`assets/js/...`,
`assets/css/...`, `assets/content/...`) foram confirmados lendo o HTML
real — inclusive `index.html`, lido diretamente numa sessão de deploy/
debug de login (ver STATUS.md §3 e §11). Os caminhos relativos a
`ide.html` (`ide.js`, `ide.css`, `dicionario-typescript-pt-br.js`) foram
confirmados por leitura direta em sessão anterior. `dashboard.html` e
`admin.html` continuam não confirmados linha a linha — vale conferir na
primeira vez que uma tarefa exigir mexer na ordem de scripts deles.

Os arquivos de deploy/infra (`firebase.json` raiz, `.firebaserc`,
`firestore.indexes.json`, `scripts/deploy-firebase.ps1`) foram
confirmados e corrigidos numa sessão de deploy — ver STATUS.md §11.1.
O `deploy-firebase.ps1` foi criado nessa sessão (não existia antes) e
ainda não foi testado rodando um deploy real de ponta a ponta.
