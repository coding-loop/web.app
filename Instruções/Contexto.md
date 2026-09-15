# STATUS — Coding Loop (v5)

> Panorama contextual detalhado do projeto. Este arquivo é a **coluna
> vertebral fixa** da base de conhecimento — fica sempre presente,
> independente de qual tarefa está em desenvolvimento no momento. Os
> demais arquivos (código-fonte específico) entram e saem da base
> conforme a tarefa ativa (ver §0).
>
> **v5** — sessão de deploy do Firebase, publicação no GitHub Pages e
> ambiente de desenvolvimento local. Corrigiu configuração de deploy
> que tinha voltado ao estado padrão de `firebase init` (§11.1),
> identificou e corrigiu a causa raiz do GitHub Pages servindo uma
> branch `gh-pages` órfã em vez do pipeline via GitHub Actions já
> existente (§11.2), documentou o pré-requisito de Java para os
> emuladores (§11.3), corrigiu um mismatch `localhost`/`127.0.0.1`
> entre o app e os emuladores em `firebase-init.js` (§11.4), e mapeou
> (mas não fechou sozinho — ver nota de proveniência) o bug do botão
> de login "travado" localmente (§11.5). Corrige também um falso
> positivo herdado de v3/v4 sobre a mensagem de `?reason=account-deleted`
> (§6.1).

---

## 0. Como este projeto está sendo desenvolvido (processo)

Fluxo de trabalho combinado: para cada tarefa, definimos o escopo →
Claude indica quais arquivos (além deste panorama) precisam estar na
base para aquela tarefa específica → desenvolvemos → ao concluir,
removemos os arquivos daquela tarefa e definimos a próxima. Este
arquivo nunca sai da base; o resto gira.

Antes de propor uma correção de código, confirmar contra o arquivo-fonte
real sempre que possível — várias "correções prioritárias" de versões
anteriores (§6.1) eram conclusões de auditoria externa que não se
confirmaram no código.

**Nota de proveniência (v5):** a correção de `auth.js` relatada em
§11.5 foi originalmente aplicada por uma sessão de agente separada
(Playwright, direto no `Edition-Coding-Loop`) e reportada só em
resumo. Nesta base, o arquivo pós-mudança foi colado e revisado como
diff real — ver §6.3 #7. Confirmado também por teste ao vivo do
usuário (login funcionando em produção e local, redirect direto pro
dashboard). Modelo a seguir: tratar relatos de outras sessões como
auditoria externa até o arquivo real ser colado e comparado aqui.

---

## 1. Visão geral

Plataforma web de ensino de programação (HTML, CSS, JS, lógica de
programação): dashboard do aluno, trilha de módulos/etapas em estilo
gamificado, um IDE integrado (editor Monaco + preview ao vivo) e um
painel administrativo de avisos. Sem framework/bundler — tudo vanilla
JS pendurado em `window.CL`, em português (código e comentários).

**4 páginas HTML, cada uma com um boot diferente:**

| Página | Papel | Carrega `app.js`/`router.js`? |
|---|---|---|
| `index.html` | Landing + login/cadastro | Não — boot inline próprio, **confirmado por leitura direta nesta sessão** (ver §3 e §8) |
| `dashboard.html` | App principal (dashboard, trilha, config) | Sim (ordem exata do `<script>` não confirmada no HTML real — ver §3) |
| `ide.html` | Editor de código isolado | **Não, confirmado.** Boot inline próprio e deliberado — ver §3 |
| `admin.html` | CRUD de avisos, gated por custom claim `admin` | Não — só carrega `admin.js` |

**Publicação (confirmado nesta sessão):** o site estático é publicado
via **GitHub Pages usando GitHub Actions** (workflow
`.github/workflows/pages.yml`, lido diretamente no repositório público
`coding-loop/web.app`), não via Firebase Hosting. O Firebase é usado só
para Authentication e Firestore (comunicados + limpeza de conta). Ver
§11.2 para o histórico do bug de publicação corrigido nesta sessão.

---

## 2. Arquitetura por camada

**JS (18 arquivos em `assets/js/`, ~12.300 linhas no total):**

| Arquivo | Papel |
|---|---|
| `firebase-init.js` | Init do SDK Firebase + providers OAuth. **Ajustado nesta sessão** — ver §11.4 |
| `auth.js` | `CL.storage` (localStorage) + `CL.auth` (sessão/login/guard). **Ajustado nesta sessão** (mensagens de erro) — ver §11.5, nota de proveniência em §0 |
| `api.js` | Persistência local-first (progresso/perfil/exercícios) — ver §4/§6.2 sobre validação de shape/tamanho no salvamento de exercício |
| `router.js` | Hash router + `CL.pages` |
| `app.js` (1.816 linhas, 69K) | Framework interno: config/state/dom/ui/components/events/services/boot |
| `curso-data.js` (1.880 linhas, 104K) | Dados dos 3 cursos fixos (HTML/CSS/JS) + helpers de progresso |
| `curso-etapas-loader.js` | Carrega assíncrono `assets/content/*.js` (catálogo dinâmico) |
| `trilha.js` (946 linhas) | Motor de renderização da trilha gamificada |
| `dicionario-typescript-pt-br.js` (336K) | Dado estático: ~2.000 diagnósticos TS traduzidos |
| `integracao-traducao-diagnosticos.js` | Não é runtime — nota de migração já aplicada em `ide.js` |
| `ide.js` (4.373 linhas, 232K — cresceu nesta sessão com a extração de `obterCodigoFonteAgregado`, ver §6.2) | IDE completo — ver §6 |
| `admin.js` (~40 linhas) | CRUD de avisos no Firestore |
| `pagina-dashboard.js`, `pagina-curso.js`, `pagina-perfil.js`, `pagina-configuracoes.js` | Uma por rota |
| `carrossel.js`, `scrollable-controls.js` | Componentes de UI genéricos |

**CSS (5 arquivos, prefixo `cl-`, paleta Solarized dark/light via `[data-theme]`):**
`global.css` (2.469 linhas, núcleo/tokens) → `dashboard.css`, `ide.css`
(3.840 linhas, o maior), `trilha.css`, `admin.css` (satélites de
página, dependem dos tokens do núcleo).

**Firestore:** só `announcements` (leitura pública se `published`) e
limpeza defensiva de conta — progresso/exercícios vivem 100% em
`localStorage`, com validação de shape e tamanho por campo feita em
`api.js` (ver §4).

**Deploy/infra (mapeado nesta sessão, ver §11.1):**
`firebase.json` (raiz) + `.firebaserc` (alias `coding-loop`) +
`firestore.rules` (em `public/`) + `firestore.indexes.json` cobrem
regras e índices do Firestore. `public/firebase.json` é uma cópia
local de mesma referência de regras, usada só pelos emuladores. O
script `scripts/deploy-firebase.ps1` (criado nesta sessão — não
existia antes) publica regras+índices no projeto `coding-loop`.

---

## 3. Mapa de carregamento por página

### `ide.html` — **confirmado por leitura direta do arquivo**

Não carrega `app.js`. Antes de qualquer script externo, um bloco
inline define uma versão mínima de `CL.config`/`CL.state`/
`CL.ui.showToast` (o motivo, documentado no próprio HTML: `auth.js` e
`api.js` esperam `CL.config`/`CL.state` já existindo, e o IDE não quer
depender de elementos de UI que só existem no Dashboard, tipo
`#cl-app`/`#cl-sidebar`).

Ordem real dos `<script defer>`:
```
firebase-init.js → auth.js → api.js → curso-data.js →
catalogo-automatico.js → catalogo-manual.js → modo.js →
curso-etapas-loader.js → trilha.js → dicionario-typescript-pt-br.js →
scrollable-controls.js → ide.js
```
`CL.config` inline do IDE já inclui `googleDriveClientId` e
`microsoftOneDriveClientId` (ver §6.1 — isso resolve o que a v2 listava
como bug #8).

Esse isolamento deliberado (`ide.html` nunca carrega `app.js`) também
explica por que `ide.js` reimplementa `escaparHtml` em vez de reusar
`CL.services.markdown.escape` de `app.js` — não é duplicação evitável,
é consequência do boot independente (ver §6.4).

### `index.html` — **confirmado por leitura direta nesta sessão (v5)**

Também não carrega `app.js`/`router.js` — tem um boot inline próprio,
mais enxuto que o do Dashboard (só tema, toast e o fluxo de login; sem
router/pages/components).

Ordem real dos `<script defer>`:
```
firebase-init.js → auth.js → <script inline de boot>
```

O `<script>` inline:
- Define `CL.config`/`CL.state` mínimos (inclui `dashboardUrl`,
  `landingUrl`, `protectedPage: false`).
- Define `CL.ui.setTheme/toggleTheme/showToast/showFatalError`.
- Cablagem do modal de login: abrir/fechar, Esc pra fechar, um
  `addEventListener("click")` por botão `[data-provider]` que chama
  `CL.auth.loginWithProvider(providerKey)`, e o `submit` do formulário
  de email/senha chamando `CL.auth.loginWithEmail`/`registerWithEmail`.
- `boot()`: seta tema, chama `CL.auth.init()` e aguarda `CL.auth.ready`;
  se já autenticado, redireciona direto pro dashboard sem mostrar a
  landing; senão, mostra o motivo do redirecionamento via `?reason=`
  (ver correção do falso positivo em §6.1) e revela a página.

**Comparado byte a byte nesta sessão** entre a cópia local do usuário
e o `main` do repositório público `coding-loop/web.app`: conteúdo
idêntico (só diferença de indentação — 2 vs 4 espaços). Ou seja, os
bugs de login investigados nesta sessão não vêm de uma divergência
entre local e publicado; são específicos da combinação
Live Server + Emulador (ver §11.5).

### `dashboard.html`, `admin.html` — **não confirmados, só inferidos por comentários cruzados**

Os próprios arquivos JS têm comentários de topo que descrevem ordem de
carregamento esperada, mas eles **divergem entre si**: `router.js`
afirma carregar depois de `app.js`; `pagina-curso.js` (não lido ainda)
supostamente menciona depender só de `router.js`. Sem o HTML real
dessas 2 páginas, não dá pra confirmar a ordem verdadeira — só vale a
pena investigar isso quando uma tarefa específica exigir mexer na
ordem de scripts dessas páginas.

---

## 4. O que está funcionando (confirmado)

- Login multi-provider (Google/Facebook/GitHub/Microsoft + email/senha), com fallback popup→redirect.
- `firestore.rules`: deny-by-default, isolamento por uid, `isAdmin()` checado **no servidor** — padrão correto. Schema fechado (`hasAll`+`hasOnly`) em `announcements`, com `updatedAt` sempre forçado a `request.time` (create e update).
- Exclusão de conta exige reautenticação + digitação exata de confirmação, com timeout de 30s. A mensagem pós-exclusão (`?reason=account-deleted`) **está presente** em `index.html` — ver correção do falso positivo em §6.1.
- Escopos OAuth de Drive (`drive.appdata`) e OneDrive (`Files.ReadWrite.AppFolder`) mínimos e corretos.
- Preview do IDE em `iframe` sandboxed, com captura de erros via `postMessage`.
- Foto de perfil não usa Firebase Storage — vira base64 (dataURL) direto no perfil local.
- Diagnósticos do TypeScript traduzidos pra pt-BR via dicionário dedicado.
- Toast: normalização `danger → error` **presente e funcional** tanto em `app.js` quanto no boot inline de `ide.html` (ver §6.1).
- `CL.config` do `ide.html` já contém os client IDs de OAuth de Drive/OneDrive necessários pro `ide.js` (ver §6.1).
- Sincronização de backup em nuvem (`sincronizarNuvemAutomaticamente`, `ide.js`) roda Drive e OneDrive **em paralelo** via `Promise.allSettled` — falha num destino não cancela o outro (confirmado nesta sessão, ver §6.1).
- `validarConfiguracaoBackup()` é chamada no `submit` do formulário de configuração de backup e bloqueia salvar config incompleta sem avisar (confirmado nesta sessão, ver §6.1).
- `api.js` (`saveExercise`/`validateStudyData`) valida shape e tamanho (limite de 1MB por campo `html`/`css`/`js`, até 100 arquivos em `files`) antes de persistir ou restaurar exercício — client-side, mas presente e correto.
- `ide.js` tem uma fonte única e completa de "código-fonte atual" (`obterCodigoFonteAgregado`, nova nesta sessão — ver §6.2), usada por `verificar()` de exercício, salvamento e todos os botões de exportação. Antes disso, esses 7 pontos liam um espelho que só refletia o primeiro arquivo de cada linguagem.
- **(v5)** Publicação do site via GitHub Pages/GitHub Actions, ponta a ponta, confirmada funcionando após a correção de §11.2.
- **(v5)** `firebase-init.js` detecta corretamente `localhost`/`127.0.0.1`/`[::1]` como ambiente local e troca para o projeto `demo-coding-loop` + emuladores; a partir desta sessão, ambos os `useEmulator` (Auth e Firestore) usam `localhost` de forma consistente com a origem da página (ver §11.4).
- **(v5)** `reports/security/verify-security.cjs` existe e passou (8 testes) numa reprodução feita nesta sessão por uma sessão de agente separada — corrige a suposição anterior de que esse script não existia; ver nota de proveniência em §0.

---

## 5. Estado do conteúdo pedagógico (achado crítico — `curso-data.js`)

Grade curricular 100% definida (3 cursos × 10 módulos × 5 etapas = 150
etapas, nomes reais), mas:

| Métrica | Valor |
|---|---:|
| Etapas com título genérico "Etapa N" (não customizado) | 147 de ~150 |
| Ocorrências do marcador `[Placeholder]` | 298 (reconfirmado por leitura direta nesta sessão) |
| Etapas com `verificar()` (auto-correção) ativa | **3 de 150** (corrigido nesta sessão; leitura direta encontrou 3 implementações reais de `verificar: function`; a 4ª ocorrência que a auditoria anterior contava é um trecho de exemplo/comentário no próprio arquivo, não uma etapa real) |

Só a etapa 1 de cada módulo-1 (HTML/CSS/JS) tem conteúdo e código
inicial reais. Sem `verificar()`, "concluir" uma etapa hoje só exige
clicar em "Próxima etapa" — não valida nada sobre o código escrito.
Maior gap entre "estrutura pronta" e "produto lançável".

---

## 6. Pendências / bugs conhecidos

### 6.1 Falsos positivos corrigidos (achados de auditoria que não se confirmaram no código real)

| Item | Conclusão original (errada) | Realidade confirmada |
|---|---|---|
| Toast "danger" cai no ícone de "info" (v2) | Bug funcional, prioridade média | **Falso.** `app.js:514` e o boot inline de `ide.html:349` já normalizam `if (type === "danger") type = "error"` antes do lookup do ícone. O que existe de fato é só divergência **cosmética** de glifos entre os dois toasts (`app.js`: ℹ️✅⚠️⛔ / `ide.html`: ℹ✔⚠✖) — baixíssima prioridade, não afeta funcionamento. |
| `CL.config` sem `googleDriveClientId`/`microsoftOneDriveClientId` (v2) | Bug funcional, **prioridade alta** (backup em nuvem quebrado) | **Falso.** `ide.html` nunca carrega `app.js` — define seu próprio `CL.config` inline, que já inclui os dois client IDs. `app.js` não precisa desses campos porque `dashboard.html` não tem funcionalidade de IDE/backup. |
| Backup em nuvem roda "em sequência sem try/catch — um destino falhar cancela os seguintes" (v3, catalogado como `ide.js:776`/`fazerBackup`) | Bug funcional | **Falso.** Não existe função `fazerBackup` no arquivo real. O fluxo real (`sincronizarNuvemAutomaticamente`) já usa `Promise.allSettled` para rodar Drive e OneDrive em paralelo, com falha isolada por destino — é o padrão correto. |
| `validarConfiguracaoBackup` "existe mas nunca é chamada" (v3, `ide.js:1112`) | Bug funcional — dava pra salvar config de backup incompleta sem aviso | **Falso.** É chamada no `submit` do `backupSettingsForm` e bloqueia o salvamento se faltar destino/frequência/conexão pendente. |
| Aspa sobrando em `data-scroll-viewport"` (v3, `ide.html:208`) | Bug de seletor — quebrava o scroll de abas | **Não reproduz** na versão lida nesta sessão — atributo limpo nos dois pontos onde aparece (toolbar estático e cards de etapa gerados por JS). |
| `index.html` (`messages`) — `?reason=account-deleted` não tem mensagem (v3/v4, §6.3 #2) | Bug funcional — exclusão de conta não confirmava nada pro usuário | **Falso (corrigido na v5).** Leitura direta de `index.html` mostra a mensagem `"account-deleted": "Sua conta e os dados associados foram excluídos."` já presente no objeto `messages` do boot inline, com toast tipo `success`. |

*Lição prática: auditorias externas erram sistematicamente de duas formas neste projeto — (1) quando um arquivo tem boot independente não considerado (como `ide.html`/`index.html`, cada um com seu próprio `CL.config`), e (2) quando alegam ausência de chamada/tratamento sem grepar o arquivo inteiro (como os itens de backup e o de `account-deleted`). Confirmar contra o fonte real antes de agir evitou "corrigir" coisas que já funcionavam, de novo nesta sessão.*

### 6.2 Bugs reais corrigidos em sessão anterior (código já alterado)

| # | Onde | Era o quê | Correção aplicada |
|---|---|---|---|
| 1 | `ide.html:191` (`#tabs-scroll-wrapper`) | Wrapper do toolbar sem o atributo `data-scrollable-controls` — só tinha a classe `cl-scrollable-controls`. Os cards de etapa (`renderEtapas`, gerados por JS) têm os dois juntos; o toolbar estático só tinha um. Setas de scroll do toolbar não funcionavam. | Atributo `data-scrollable-controls` adicionado ao wrapper, igual ao padrão já usado nos cards de etapa. |
| 2 | `ide.js` — `obterCodigoAtualDoEditor`, `salvarCodigoAgora`, `exportarCodigoHtml`, `exportarCodigoCss`, `exportarCodigoJs`, `exportarCodigosSeparados`, `exportarCodigoSvg` | `htmlEditor`/`cssEditor`/`jsEditor` são editores Monaco ocultos mantidos como "espelho" pra compatibilidade com exercícios antigos. `sincronizarArquivosPrincipais()` os sincroniza usando `.find()` — só o **primeiro** arquivo de cada linguagem em `arquivosExtras`, nunca concatena. Sete pontos do código liam esse espelho diretamente como se fosse "o código atual completo". | Extraída função única `obterCodigoFonteAgregado()` (mesma regra de agregação que `montarCodigoPreview` já usa). Os 7 pontos de consumo foram trocados pra usar essa função. |

### 6.3 Novos bugs corrigidos nesta sessão (v5)

Ver §11 para o relato completo. Resumo:

| # | Onde | Era o quê | Correção |
|---|---|---|---|
| 1 | `firebase.json` (raiz) | Voltou ao estado padrão de `firebase init` (ganhou blocos `hosting`/`auth`/`database`/`location` indevidos), quebrando a separação documentada (Hosting é GitHub Pages, não Firebase). | Restaurado para só `firestore` + `emulators`. `deploy-firebase.ps1` agora barra o deploy se detectar `hosting`/`auth` no arquivo (ver §11.1). |
| 2 | `firestore.indexes.json` | Voltou ao template vazio padrão (`"indexes": []` + comentários de exemplo), o que faria o deploy tentar **excluir** o índice real de `announcements`. | Índice de `announcements` (`status` + `publishedAt`) restaurado. |
| 3 | Configuração do GitHub Pages (Settings → Pages) | Source configurado como "Deploy from a branch: `gh-pages`" — uma branch órfã que o workflow atual (baseado em `actions/deploy-pages`) nunca atualiza. O site servido ficava congelado num snapshot antigo. | Source trocado para "GitHub Actions", batendo com o que o `README.md` e o `pages.yml` real já esperavam. Confirmado funcionando pelo usuário. Branch `gh-pages` antiga ainda não foi apagada (pendência, ver §7). |
| 4 | Ambiente local | Java (JRE) não estava instalado — o emulador de Firestore depende dele e falhava ao subir. | Instalado (Eclipse Temurin JRE). Emuladores confirmados subindo com sucesso (`All emulators ready!`, Auth 9099 / Firestore 8080 / UI 4000). |
| 5 | `firebase-init.js` | `auth.useEmulator("http://127.0.0.1:9099")` e `db.useEmulator("127.0.0.1", 8080)` usavam `127.0.0.1` enquanto a página é servida em `localhost` pelo Live Server — mismatch de origem entre app e emulador, que pode quebrar a sinalização de conclusão do fluxo de popup/redirect do Firebase Auth (categoria de bug documentada publicamente para esse tipo de mistura de host). | Ambos trocados para `localhost`, consistente com a origem real da página. |
| 6 | `index.html` (`<style>`) | Um token `""` solto e inválido dentro do bloco `<style>`, entre duas regras CSS (não quebra o parser do navegador, mas é sujeira). | Removido (aplicado pela sessão de agente separada — ver nota de proveniência em §0). |
| 7 | `auth.js` | Botão de provedor OAuth podia ficar com `disabled = true` permanentemente se `loginWithProvider` falhasse de um jeito que não fosse recapturado no `index.html` (sem `try/finally` em volta do `await`), fazendo o login "parecer travado" sem nenhum feedback visível. | **Confirmado por diff real nesta base**: 5 mensagens traduzidas novas em `_errorMessages` (`operation-not-allowed`, `unauthorized-domain`, `popup-blocked`, `emulator-config-failed`, `internal-error`) e guarda explícita em `CL.auth.init()` para `CL.firebase`/`CL.firebase.auth` ausente. **Testado ao vivo pelo usuário**: login funcionando em produção (GitHub Pages) e local (Live Server + emulador), com redirect direto pro dashboard no primeiro login. Debt residual de baixa prioridade (não é mais bug ativo): `loginWithProvider` ainda acessa `CL.firebase.providers[providerKey]` sem guarda própria, e o `index.html` não tem `try/finally` no `await` — só importaria se `CL.firebase` sumisse depois de um boot já bem-sucedido. `auth/emulator-config-failed` segue sem nenhum código que produza esse erro (mensagem morta). |

### 6.4 Concretos, com localização exata (ainda pendentes)

| # | Onde | Problema |
|---|---|---|
| 1 | `trilha.js:876` | Destaque visual da trilha remove a classe após 1ms; CSS espera 1.6s — animação nunca aparece. *(arquivo não revisado nesta sessão)* |
| 2 | `dashboard.css:518,528,537,606` | 3 tokens CSS usados não existem em `global.css` (`--cl-surface-alt`, `--cl-font-weight-normal`, `--cl-font-size-base`) — sem fallback, regra é ignorada. *(arquivo não revisado nesta sessão)* |
| 3 | `ide.css:8` vs `ide.css:3303` | `body` redefinido com cores hardcoded (`#ffffff`/`#333`) no topo do arquivo; só funciona por um "patch" que reaplica os tokens Solarized certos no final do arquivo — **confirmado real** em sessão anterior. Correção não aplicada ainda: precisa do `global.css` real (não lido nesta base) pra confirmar os valores de `--cl-bg`/`--cl-text` antes de trocar as cores hardcoded por `var()`. |
| 4 | `admin.css` | Não participa do sistema de temas (`0` ocorrências de `[data-theme]`, fixa `color-scheme: dark`) — painel admin é dark-only mesmo se o usuário escolheu tema claro. *(arquivo não revisado nesta sessão)* |

### 6.5 Pendências operacionais / infra (novas na v5)

| # | Onde | Problema |
|---|---|---|
| 1 | Branch `gh-pages` no repositório `web.app` | Órfã desde a correção de §11.2 — nenhum workflow atual escreve nela. Não atrapalha nada estando parada, mas pode confundir alguém no futuro. Apagar depois de confirmar estabilidade do novo pipeline. |
| 2 | `.gitignore` | Não ignora `skills-lock.json` (cache de "agent skills" do Firebase/Gemini, não é do site). Recomendado adicionar a linha `skills-lock.json`. |
| 3 | `scripts/verify-deploy.cjs` | Mencionado no `README.md` ("validação local sem publicar"), mas nunca confirmado como existente nesta base — ao contrário de `reports/security/verify-security.cjs`, que uma sessão separada confirmou existir e passar (§4). Verificar se existe antes de assumir que sim ou que não. |

### 6.6 Estruturais / débito técnico

- Regra "nenhum módulo chama `document.*` direto" (documentada em `app.js`) ignorada sistematicamente fora dele: `ide.js` **124 chamadas diretas** (recontado por leitura direta em sessão anterior; era 94 na auditoria anterior a essa, provavelmente o arquivo cresceu desde então), `pagina-configuracoes.js` 20, `pagina-perfil.js` 12, `pagina-dashboard.js` 10, `auth.js` 4, `pagina-curso.js` 5, `trilha.js` 2, `carrossel.js` 1, `admin.js` 1.
- `escapeHtml`/`escaparHtml` reimplementada em ≥5 arquivos, apesar de `CL.services.markdown.escape` já existir centralizado em `app.js` — em `ide.js` especificamente isso **não é debt real**, é consequência necessária do boot independente de `ide.html`. Continua sendo debt real nos outros arquivos que carregam `app.js`: `admin.js`, `pagina-curso.js`, `pagina-dashboard.js`, `trilha.js`.
- `ide.js` (4.373 linhas) é o maior risco de manutenção — mistura UI, backup em 3 provedores, e um linter customizado de HTML/CSS.
- `ide.css` concentra **93** ocorrências de `!important` das ~119 do projeto; paleta hardcoded própria (estilo GitHub) sem relação com os tokens Solarized.
- `trilha.css` tem 6 algoritmos de posicionamento coexistindo (`--triangular`, `--serpente`, `--etapas`, `--rio`, `--quatro-colunas`, `--vinte-um`) — não dá pra saber qual está em produção só pelo CSS.
- Sem tokens de breakpoint: 10 valores de `max-width` diferentes soltos nas media queries.
- Ordem real de `<script>` em `dashboard.html` não confirmada (ver §3) — comentários de `router.js`/`app.js`/`pagina-curso.js` divergem entre si.
- Nem todas as páginas registradas (`courses`, `playground`, `exercises`, `tools`, `lesson`) têm `.init()` implementado.
- `firebase.json` mínimo demais para produção: falta `hosting`/`storage.rules`/`functions`/`emulators` mais completos — **decisão intencional**, já que Hosting é GitHub Pages (ver §11.1); reavaliar só se algum dia migrar hosting pro Firebase.
- Firestore rules sem validação de schema — limites de 100/1000 caracteres do formulário de avisos são só `maxlength` no HTML (client-side).
- Concessão da claim `admin:true` é processo manual fora do app, não documentado.

---

## 7. Recomendações priorizadas

1. Decidir o plano de preenchimento das ~147 etapas placeholder (§5) — maior gap para lançamento.
2. Corrigir os 3 tokens CSS inexistentes em `dashboard.css` (§6.4 #2).
3. Obter o `global.css` real pra fechar a correção do `body` duplicado em `ide.css` (§6.4 #3) — única pendência de CSS com correção pronta esperando só esse arquivo.
4. Obter e revisar `storage.rules` (se existir) e reforçar `firestore.rules` com validação de schema.
5. Consolidar as duplicações de `escapeHtml` que ainda são debt real (nos arquivos que carregam `app.js` — não em `ide.js`, ver §6.6).
6. Decidir/documentar qual algoritmo de `trilha.css` está ativo e isolar os outros 5 como legado.
7. Confirmar a ordem real de `<script>` em `dashboard.html`/`admin.html` (únicas páginas HTML ainda não lidas diretamente).
8. Se o projeto crescer, quebrar `ide.js` em módulos menores.
9. Avançar a Integração de IA na IDE (§10) — a base técnica já está preparada; falta o painel, o coletor de contexto, e a conexão com Firebase AI Logic.
10. **(v5)** Apagar a branch `gh-pages` órfã depois de confirmar estabilidade do pipeline via GitHub Actions (§6.5 #1).
11. **(v5)** Adicionar `skills-lock.json` ao `.gitignore` (§6.5 #2).
12. **(v5)** Confirmar existência/conteúdo de `scripts/verify-deploy.cjs` (§6.5 #3). Revisão do `auth.js` pós-correção já feita e confirmada por teste ao vivo (§6.3 #7).
13. **(v5)** Rodar `firebase use` antes do próximo deploy pra confirmar que o alias ativo continua `coding-loop` (por causa do `firebase use --add` que foi cancelado no meio numa sessão anterior).

---

## 8. Arquivos já confirmados por leitura direta vs. só por auditoria/inferência

| Confirmado (lido diretamente nesta base, em algum momento) | Só via auditoria externa (não lido bruto) |
|---|---|
| `api.js`, `app.js`, `auth.js`, `router.js`, `firebase-init.js`, `firebase.json` (raiz e `public/`), `firestore.rules`, `firestore.indexes.json`, `.firebaserc`, `curso.js`, `modulo.js`, `etapa.js`, `posicoes-trilha.js`, `Para-Novos-Cursos.md`, `README.md`, `ide.html`, `ide.js`, `ide.css`, `curso-data.js`, **`index.html`** (v5 — local e via GitHub, idênticos), **`.github/workflows/pages.yml`** (v5, lido no repositório público) | `pagina-perfil.js`, `pagina-configuracoes.js`, `pagina-curso.js`, `pagina-dashboard.js` (parcial — lida em sessão anterior), `carrossel.js`, `scrollable-controls.js`, `dicionario-typescript-pt-br.js`, `global.css`, `dashboard.css`, `trilha.css`, `admin.css`, `dashboard.html`, `admin.html`, `scripts/deploy-firebase.ps1` (criado nesta sessão, não uma auditoria — mas também não testado em produção ainda), `scripts/verify-deploy.cjs` (existência não confirmada) |

Isso importa porque achados "só via auditoria" têm menor confiança —
como os itens de §6.1 provaram, de novo nesta sessão (o caso do
`account-deleted`). Ao decidir a próxima tarefa, dar prioridade a
confirmar pontos da coluna direita que sejam relevantes pro que será
desenvolvido — `global.css` é o próximo candidato óbvio, já que destrava
a correção pendente de `ide.css` (§6.4 #3).

---

## 9. Ao editar este projeto

Antes de assumir que uma função "é a atual", confirme que não há uma
segunda definição mais abaixo no mesmo arquivo sobrescrevendo-a.
`grep -n "NomeDaFuncao ="` no arquivo inteiro antes de editar é o
suficiente. E, como reforçado em §6.1: **antes de propor uma correção
baseada em achado de auditoria, confirme contra o arquivo-fonte real
se ele estiver disponível** — auditorias erram quando um arquivo tem
um boot independente (como `ide.html`/`index.html`) que não foi
considerado, ou quando alegam ausência de tratamento sem grepar o
arquivo inteiro. O achado de `obterCodigoFonteAgregado` (§6.2) é o
caso inverso e igualmente instrutivo: um bug real que **não** estava em
nenhuma auditoria anterior só apareceu seguindo o dado até a origem
real do valor que ela devolvia.

**Nova desta sessão:** quando uma correção é reportada por uma sessão
de agente diferente (fora desta conversa/base), tratar o relato como
**auditoria externa**, não como fato confirmado — até o arquivo real
pós-mudança ser colado e lido aqui. Ver nota de proveniência em §0 e
pendência em §6.5 #4.

---

## 10. Integração de IA na IDE — status e decisões

Histórico consultado: tarefas "Integração AI e abas Plataforma Learn",
"Implementar painel de IA seguro" e "Integração de IA — Coding Loop".
**Implementação ainda não começou** — a sessão que originou esta seção
foi levantamento e preparação técnica (a auditoria e as correções de
§6.2 nasceram dessa preparação). Decisões já fechadas, registradas
aqui pra não se perderem entre tarefas:

**Objetivo e interface:** painel de IA opcional e recolhível, encaixado
entre a Plataforma Learn e o editor. Abrir/fechar deve reajustar o
espaço das duas áreas — o padrão de toggle já existe no projeto pro
botão "recolher IDE" (ver layout confirmado abaixo) e é o candidato
natural a reaproveitar. Adaptação pra telas pequenas ainda não
desenhada (decisão em aberto: terceira coluna encolhida vs. painel em
overlay).

**Arquitetura escolhida:** Firebase AI Logic + Gemini Developer API,
plano Spark, usando a autenticação Firebase já existente. Sem backend
próprio, sem chave/token de IA fornecido pelo aluno, sem campo de
credencial na UI.

**Contexto permitido à IA (lista explícita — campos reais mapeados em
`curso-data.js`/`ide.js`, não descrição solta):**
- Curso: `CL.curso.CURSOS[cursoAtualId].nome` / `.id`
- Módulo: `getModuloAtual().nome` / `.id`
- Teoria: `etapa.titulo` + `etapa.texto`
- Missão/exercício: `etapa.missao`
- Questões: `etapa.questoes` (array de `{ pergunta, opcoes, correta, explicacao }`)
- Desafio: `etapa.desafio`
- Código ativo: `obterCodigoFonteAgregado()` — fonte única e completa de `html`/`css`/`js`; qualquer coletor de contexto deve chamar essa função, nunca ler `htmlEditor`/`cssEditor`/`jsEditor` diretamente
- Preview e arquivos: ainda não mapeado em detalhe — `arquivosExtras` cobre múltiplos arquivos por linguagem, inclusive Markdown/SVG

**Excluído do contexto (privacidade):** nome, e-mail, UID, perfil,
avatar, progresso individual, credenciais, dados do Firestore,
`localStorage`/`sessionStorage`, backups locais/Drive/OneDrive. A
autenticação serve só pra autorizar o acesso ao serviço — os dados da
conta não devem compor o payload enviado ao modelo.

**Proteções previstas (nenhuma implementada ainda):** acesso só pra
usuário autenticado; Firebase App Check com reCAPTCHA Enterprise
(debug só em desenvolvimento local); limite de requisições e de tokens
por usuário; não registrar prompts/respostas em monitoramento/logs;
Remote Config pra modelo/instruções/ativação/limites (nunca segredos).
**Não há confirmação de que Remote Config já está habilitado** no
projeto Firebase — nenhum arquivo local mostra isso, precisa checar
direto no console do Firebase antes de depender disso no desenho.

**Cotas:** login individual do aluno não transfere a franquia pessoal
do Gemini pro Coding Loop — a cota da API continua compartilhada pelo
projeto, com limites individuais servindo só de controle de consumo
interno, não de cota própria por conta Google.

**Confirmado tecnicamente:**
- O editor é **Monaco**, não Ace. Nenhum resíduo de Ace no código
  (`ide.js`, `ide.html`, `ide.css`).
- **Não existe console visual** na IDE — só captura de erro de execução
  via `postMessage` (`erro-execucao-js`, injetado no `<script>` do
  preview). Não há captura de `console.log`/`console.warn` do código do
  aluno. Se "console" entrar no escopo do contexto de IA, isso é
  feature nova a construir, no mesmo padrão do handler de erro já
  existente.
- **Layout confirmado** em `ide.html`/`ide.css`: `.learning-platform-root`
  (flex row) → `.theory-pane` (Learn, 33.33%/min 300px/max 720px) +
  `.pane-resizer` (divisória arrastável) + `.ide-container-pane`
  (editor + preview, `flex: 1`). Precedente de toggle já existe: o
  botão "recolher IDE" alterna a classe `ide-recolhido` na raiz e
  chama `redimensionarEditores()` via `setTimeout` depois da transição
  CSS. `@media (max-width: 900px)` empilha as duas áreas em coluna e
  vira o resizer pra `row-resize`.
- `DeepSeek-Key`: não tem relação com este projeto, foi removido
  (confirmado pelo responsável do projeto) — não é mais um ponto de
  atenção pra essa integração.

**O que falta:** painel HTML/CSS (terceira coluna colapsável, seguindo
o precedente de toggle acima), o coletor de contexto propriamente dito,
a conexão com Firebase AI Logic, configurar Remote Config e App Check,
e — se "console" entrar no escopo — a captura de `console.*` do iframe
de preview. Modelo específico do Gemini e valores exatos de limite de
requisição/token não ficaram fechados em nenhum resumo consolidado até
agora.

---

## 11. Sessão de deploy Firebase + GitHub Pages + ambiente local (v5)

### 11.1 Configuração de deploy do Firebase

`firebase.json` (raiz) tinha voltado ao estado padrão de `firebase init`
— ganhou blocos `hosting` (apontando `public` como pasta publicável) e
`auth` (config de OAuth brand) que não faziam parte do design original,
além de `database`/`location`. Isso contraria o que o `README.md`
sempre documentou: Hosting é feito por GitHub Pages, não Firebase.
`firestore.indexes.json` também tinha voltado ao template vazio padrão
(`"indexes": []` + comentários de exemplo), o que faria o próximo
deploy tentar excluir o índice real de `announcements`
(`status`+`publishedAt`).

Corrigido: `firebase.json` restaurado a só `firestore`+`emulators`;
índice de `announcements` restaurado em `firestore.indexes.json`.
Criado `scripts/deploy-firebase.ps1` (não existia antes) que: confirma
estar rodando na raiz certa, confere que `public/firestore.rules` e
`firestore.indexes.json` existem, confere Firebase CLI instalado,
confere login ativo, **barra a execução se detectar blocos `hosting`
ou `auth` no `firebase.json`** (proteção contra essa regressão
específica se acontecer de novo), pede confirmação explícita do
projeto alvo, e roda só
`firebase deploy --only firestore:rules,firestore:indexes --project coding-loop`
(sem `--force`, pra qualquer confirmação de exclusão de índice remoto
continuar manual).

Logs de debug de sessões anteriores (`firebase-debug.log`,
`firestore-debug.log`) mostraram: (a) uma falha de `firebase serve` por
token expirado + instabilidade de rede (03/08); (b) um `firebase use --add`
cancelado no meio via Ctrl+C antes de escolher projeto (05/08) — não
deve ter alterado nada, mas recomenda-se rodar `firebase use` (sem
argumento) antes do próximo deploy pra confirmar que o alias ativo
continua `coding-loop`.

### 11.2 GitHub Pages servindo conteúdo desatualizado

Sintoma relatado: `index.html` não carregava corretamente. Investigação
direta no repositório público `coding-loop/web.app` (via API/raw do
GitHub, já que é público) encontrou: o workflow real
(`.github/workflows/pages.yml`, no `main`) usa
`actions/upload-pages-artifact` + `actions/deploy-pages` — publicação
nativa via GitHub Actions, que **não escreve em nenhuma branch**. Mas
o repositório tinha uma branch `gh-pages` órfã, com um `index.html`
antigo de um método de publicação anterior/paralelo. O Source em
Settings → Pages estava configurado como "Deploy from a branch:
gh-pages" — servindo esse snapshot congelado em vez do que o workflow
atual publica a cada push.

Corrigido pelo usuário: Source trocado para "GitHub Actions" em
Settings → Pages, batendo com o que `README.md` sempre pediu.
Confirmado funcionando. **Pendência:** apagar a branch `gh-pages`
órfã depois de mais alguns ciclos de confirmação de estabilidade
(§6.5 #1).

### 11.3 Ambiente local — pré-requisito de Java

`firebase emulators:start --project demo-coding-loop --only auth,firestore`
falhava silenciosamente do lado do usuário porque o Java (JRE) não
estava instalado no Windows — o emulador de Firestore roda sobre Java
e não sobe sem ele. Resolvido com
`winget install EclipseAdoptium.Temurin.21.JRE`. Emuladores confirmados
subindo com sucesso depois: Auth (9099), Firestore (8080), UI (4000).

### 11.4 Mismatch `localhost` vs `127.0.0.1` no `firebase-init.js`

Com os emuladores rodando e a página servida via Live Server em
`http://localhost:5500/`, o login via provedor OAuth ainda não
funcionava. `firebase-init.js` conectava os emuladores usando o IP
literal `127.0.0.1` (`auth.useEmulator("http://127.0.0.1:9099")`,
`db.useEmulator("127.0.0.1", 8080)`), enquanto a página em si estava em
`localhost` — navegadores tratam esses dois nomes como origens
diferentes para fins de armazenamento (sessionStorage/IndexedDB), o
que pode quebrar a sinalização de conclusão que o fluxo de
popup/redirect do Firebase Auth depende. Esse padrão de bug (mistura
de host entre app e emulador/redirect) é documentado publicamente em
discussões sobre o Firebase Auth Emulator.

Corrigido: ambos os `useEmulator` trocados pra usar `localhost`,
consistente com a origem real da página.

### 11.5 Bug do botão de login "travado" — causa raiz e correção (proveniência mista)

Ao longo da investigação nesta conversa, foram descartadas, nesta
ordem, as hipóteses de: domínio não autorizado (`127.0.0.1` vs
`localhost` — descartada quando confirmado que a página já estava em
`localhost`); divergência de código entre local e produção (descartada
— `index.html`/`auth.js` locais são idênticos ao `main` publicado, que
funciona); reload automático do Live Server no meio do login (não
confirmada nem descartada, requer verificar qual pasta está aberta
como workspace); um `""` inválido dentro do `<style>` de `index.html`
(achado real, mas cosmético — CSS inválido não quebra JS).

Uma sessão de agente separada (fora desta conversa, rodando diagnóstico
automatizado com Playwright direto no `Edition-Coding-Loop`)
reproduziu o problema e relatou como causa raiz, na reprodução dela: o
Auth Emulator **não estava rodando** no momento do teste — a requisição
pra `localhost:9099` falhava com `ERR_CONNECTION_REFUSED`, e o app não
tinha tratamento de erro visível pra esse caso, deixando o botão "sem
resposta" em vez de mostrar uma falha clara. Essa sessão relatou ter
adicionado mensagens de erro mais explícitas em `auth.js` para esse
tipo de falha de conexão.

**Atualização:** o `auth.js` pós-correção foi colado e revisado como
diff real nesta base — ver §6.3 #7. O usuário confirmou por teste ao
vivo que o login funciona em produção (GitHub Pages, Auth real) e
local (Live Server + emulador), com redirect direto pro dashboard já
no primeiro login. Investigação encerrada; o único resíduo é o debt de
baixa prioridade registrado em §6.3 #7, não mais um bug ativo.
