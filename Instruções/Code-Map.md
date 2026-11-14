# 🗺️ Code Map & Guia de Arquitetura — Coding Loop

Este documento serve como mapa de código permanente, referência arquitetural e base de orientação para implementação de novas funcionalidades, correções, melhorias e manutenção no projeto **Coding Loop** (`Edition-Coding-Loop`).

---

## 1. Visão Geral e Filosofia Arquitetural

O **Coding Loop** é uma plataforma interativa de ensino de programação web (HTML, CSS, JavaScript, Lógica de Programação), estruturada como uma Single-Page / Multi-Entry Application estática, sem backend Node próprio, orientada a cliente (*Client-Side Rendering*).

### Pilares da Arquitetura:
1. **Hospedagem Estática (GitHub Pages)**:
   - O site em produção é gerado a partir da pasta `public/` e publicado via GitHub Actions (`.github/workflows/pages.yml`).
   - O repositório opera em subdiretório (ex.: `https://coding-loop.github.io/web.app/`), exigindo caminhos relativos em todos os assets e links.
2. **Arquitetura Local-First**:
   - O progresso do aluno (etapas concluídas, código salvo, pontuações, preferências de tema e posição atual na IDE) é salvo prioritariamente no **`localStorage`** do navegador (`study-index_<uid>`).
   - Não há dependência direta de banco de dados remoto para que o aluno estude. A portabilidade entre dispositivos ocorre via arquivos de exportação/backup (`private-backups/` ou integração com Drive/OneDrive).
3. **Serviços Firebase**:
   - **Firebase Authentication**: Login por e-mail/senha e provedores OAuth (Google, GitHub, etc.).
   - **Cloud Firestore**: Utilizado de forma restrita e segura:
     - Leitura pública de avisos/comunicados (`announcements`), gerenciados pelo painel `admin.html` (restrito a usuários com Custom Claim `admin: true`).
     - Regras estritas (`firestore.rules`) protegendo dados de usuários contra escritas não autorizadas.
4. **Namespace Global Único (`window.CL`)**:
   - Todo o estado e os subsistemas da plataforma se comunicam pelo objeto global `window.CL`:
     - `CL.config`: Configurações globais e imutáveis (`Object.freeze`).
     - `CL.state`: Fonte única da verdade (*Single Source of Truth*) para rotas, usuário, modais, tema.
     - `CL.auth`: Módulo de autenticação e escuta de sessão.
     - `CL.api`: Camada de abstração de dados (localStorage e Firestore).
     - `CL.router`: Hash router SPA do Dashboard.
     - `CL.curso`: Catálogo de cursos, módulos, etapas e helpers de cálculo de progresso.
     - `CL.trilha`: Motor gráfico para desenhar as fases no padrão geométrico 7H:3V e curva de Hilbert.
     - `CL.ui` / `CL.components`: Renderizadores visuais, modais, toasts e alertas.

```mermaid
graph TD
    User([Usuário / Aluno]) --> Pages[Páginas HTML: index, dashboard, ide]
    Pages --> Namespace[Global window.CL]

    subgraph "Core Client (window.CL)"
        Namespace --> Auth[CL.auth: Sessão e Provedores]
        Namespace --> API[CL.api: LocalStorage + Firestore]
        Namespace --> State[CL.state: Single Source of Truth]
        Namespace --> Router[CL.router: Hash Navigation]
        Namespace --> Trilha[CL.trilha: Motor SVG 7H:3V]
        Namespace --> Curso[CL.curso: Cursos, Módulos, Etapas]
    end

    subgraph "Camada de Conteúdo (public/assets/content/)"
        Loader[curso-etapas-loader.js] --> Modo[modo.js: auto / manual]
        Modo --> Manifest[catalogo-automatico.js / catalogo-manual.js]
        Manifest --> Courses[Pastas: html/, css/, js/, logprog/, cyber-security/]
        Courses --> Curso
    end

    subgraph "Serviços Externos"
        Auth --> FBAuth[(Firebase Auth)]
        API --> LocalStore[(LocalStorage: study-index)]
        API --> Firestore[(Cloud Firestore: announcements)]
    end
```

---

## 2. Inventário Completo de Arquivos do Projeto (226 Arquivos)

Abaixo está o mapeamento de todos os arquivos organizados por função e módulo:

### 2.1 Raiz do Projeto (Configuração, Deploy e Regras)
| Arquivo | Descrição / Função |
| :--- | :--- |
| `.firebaserc` | Mapeamento do projeto Firebase padrão (`coding-loop`). |
| `.gitignore` | Lista de exclusões do Git (backups privados, logs, etc.). |
| `firebase.json` | Configuração principal do Firebase (regras do Firestore, índices e emuladores). |
| `firestore.indexes.json` | Definição de índices compostos do Firestore para ordenação de avisos. |
| `firestore-debug.log` | Log local de operações do Firestore Emulator. |
| `deploy-firebase.ps1` | Script raiz PowerShell para acionar o deploy de regras e índices. |
| `Para-Git-Push.txt` | Notas e orientações sobre publicação via Git. |

### 2.2 GitHub Workflows e IDE (`.github/`, `.vscode/`)
| Arquivo | Descrição / Função |
| :--- | :--- |
| `.github/workflows/pages.yml` | Pipeline de CI/CD do GitHub Actions: valida projeto, gera pacote e publica no GitHub Pages. |
| `.vscode/settings.json` | Preferências do editor de código do projeto. |

### 2.3 Instruções e Especificações (`Instruções/`)
| Arquivo | Descrição / Função |
| :--- | :--- |
| `Instruções/README.md` | Documentação técnica principal com guia de deploy, segurança e estrutura. |
| `Instruções/Code-Map.md` | Mapa completo de arquitetura e inventário do projeto. |
| `Instruções/CodeMapa.md` | Guia prático de seleção e roteamento de arquivos por tarefa. |
| `Instruções/Contexto.md` | Memória operacional, histórico e estado vivo do projeto (STATUS v5). |
| `Instruções/AGENTS.md` / `GEMINI.md` | Diretrizes de arquitetura para agentes e LLMs. |
| `Instruções/Carrossel da Área Coding Loop.md` | Manual de inclusão, remoção e customização de slides no carrossel do Dashboard. |
| `Instruções/Dados Firebase.md` | Dicionário de dados, coleções e matriz de permissões/operações do Firebase. |
| `Instruções/Especificacao-Trilha-Modulos-7H3V.md` | Especificação geométrica e matemática do traçado das trilhas SVG (Padrão 7H:3V). |

### 2.4 Backups Privados e Temporários (`private-backups/`, `tmp/`)
| Arquivo | Descrição / Função |
| :--- | :--- |
| `private-backups/coding-loop-progresso-2026-08-15-2329.json` | Snapshot de backup local do progresso de estudo (ignorado no deploy). |
| `tmp/pdfs/especificacao-trilha-v5-1.png` a `v5-4.png` | Imagens de diagramação e rascunhos visuais da especificação geométrica. |

### 2.5 Relatórios e Auditorias de Segurança (`reports/security/`)
| Arquivo | Descrição / Função |
| :--- | :--- |
| `reports/security/RELATORIO-CIBERSEGURANCA-2026-09-08.md` | Relatório detalhado da auditoria de segurança da informação e Firestore. |
| `reports/security/CORRECOES-2026-09-08.md` | Registro de correções efetuadas para blindagem de dados e regras. |
| `reports/security/verify-security.cjs` | Script executável Node.js para conferência automática das diretivas de segurança. |

### 2.6 Scripts de Automação e Empacotamento (`scripts/`)
| Arquivo | Descrição / Função |
| :--- | :--- |
| `scripts/build-pages.cjs` | Script de empacotamento: filtra arquivos sensíveis/desnecessários de `public/` para o deploy. |
| `scripts/deploy-firebase.ps1` | Executa validações e aciona o Firebase CLI com escopo seguro de regras e índices. |
| `scripts/extrair-svgs-embutidos.js` | Utilitário para extrair ícones inline do HTML/CSS para arquivos SVG dedicados. |
| `scripts/gerar-manifest-conteudo.ps1` | Varre a pasta `content/` e gera automaticamente o arquivo `catalogo-automatico.js`. |
| `scripts/verify-deploy.cjs` | Script de validação executado no CI/CD antes do deploy do GitHub Pages. |

---

### 2.7 Frontend Público (`public/`)

#### 2.7.1 Páginas HTML Principais
| Arquivo | Descrição / Função |
| :--- | :--- |
| `public/index.html` | Landing page pública, portal de boas-vindas e tela de login/cadastro e recuperação de senha. |
| `public/dashboard.html` | Painel do aluno protegido: carrossel de novidades, lista de cursos, estatísticas e menu de trilha. |
| `public/ide.html` | Ambiente de desenvolvimento interativo: Monaco Editor, divisão em painéis, testes, visualizador e guia de etapas. |
| `public/admin.html` | Painel de controle para administradores (criação e moderação de avisos globais no Firestore). |
| `public/politica-de-privacidade.html` | Página informativa de privacidade e uso de dados locais. |
| `public/404.html` | Página de erro amigável para rotas inexistentes no GitHub Pages. |
| `public/firebase.json` | Configuração residual da pasta pública. |
| `public/firestore.rules` | Cópia local de regras de segurança para testes. |
| `public/firestore-debug.log` | Registro de log do ambiente local. |

#### 2.7.2 Folhas de Estilo (`public/assets/css/`)
| Arquivo | Descrição / Função |
| :--- | :--- |
| `public/assets/css/global.css` | Design System: Variáveis CSS (Cores, Solarized Dark/Light), tipografia, botões, modais, toasts e resets. |
| `public/assets/css/dashboard.css` | Layout da dashboard: grid de cursos, cabeçalho retrátil, carrossel de destaques e painel de progresso. |
| `public/assets/css/trilha.css` | Estilos dos nós, caminhos SVG, círculos de progresso, estados bloqueados/concluídos da trilha de aprendizagem. |
| `public/assets/css/ide.css` | Layout do editor de código: split view (Monaco / Pré-visualização / Instruções), abas de arquivos e terminal/console. |
| `public/assets/css/admin.css` | Estilos da interface administrativa de avisos. |

#### 2.7.3 Scripts Core da Aplicação (`public/assets/js/`)
| Arquivo | Descrição / Responsabilidade |
| :--- | :--- |
| `public/assets/js/firebase-init.js` | Inicializa os SDKs do Firebase (Auth e Firestore) usando a configuração do projeto. |
| `public/assets/js/auth.js` | Gerenciador de autenticação: login, cadastro, logout, recuperação de senha, observador de sessão e guards. |
| `public/assets/js/api.js` | Camada de dados do aluno: lê/grava progresso e exercícios no `localStorage`, e consome avisos do Firestore. |
| `public/assets/js/app.js` | Orquestrador principal: inicializa `CL.config`, `CL.state`, manipuladores DOM, eventos globais e boot da UI. |
| `public/assets/js/router.js` | Roteador SPA baseado em hash (`#dashboard`, `#course/<id>`, `#profile`, `#settings`). |
| `public/assets/js/pagina-dashboard.js` | Controlador da tela de Dashboard: agrega progresso do aluno, renderiza cards de cursos e avisos. |
| `public/assets/js/pagina-curso.js` | Controlador da visão detalhada do curso: desenha a trilha de módulos e gerencia navegação. |
| `public/assets/js/pagina-perfil.js` | Controlador da página de perfil do aluno (estatísticas, badges e exportação de progresso). |
| `public/assets/js/pagina-configuracoes.js` | Controlador de preferências do sistema (temas claro/escuro, backup, limpeza de cache). |
| `public/assets/js/trilha.js` | Motor de traçado SVG: calcula curvas ortogonais, geometria de Hilbert e renderiza bolhas e nós clicáveis. |
| `public/assets/js/ide.js` | Motor da IDE integrada: inicializa Monaco Editor, abas (HTML/CSS/JS), iframe de preview, execução de testes e salvamento de código. |
| `public/assets/js/curso-data.js` | Repositório legado de cursos (HTML, CSS, JS) e métodos utilitários (`encontrarModulo`, `moduloConcluido`, etc.). |
| `public/assets/js/curso-etapas-loader.js` | Carregador assíncrono dos arquivos modulares de cursos com suporte a Promise (`CL.curso.conteudoPronto`). |
| `public/assets/js/carrossel.js` | Lógica interativa do carrossel no topo do Dashboard (troca automática, setas, indicadores e acessibilidade). |
| `public/assets/js/scrollable-controls.js` | Controles de scroll e navegação suave em listas horizontais e contêineres móveis. |
| `public/assets/js/admin.js` | Lógica do painel de administração para publicar, editar e apagar comunicados no Firestore. |
| `public/assets/js/dicionario-typescript-pt-br.js` | Dicionário com centenas de traduções de códigos de erro de TypeScript/JavaScript para Português. |
| `public/assets/js/integracao-traducao-diagnosticos.js` | Intercepta diagnósticos e tooltips do Monaco Editor e exibe as mensagens traduzidas para o aluno. |

---

### 2.8 Camada de Conteúdo Modular (`public/assets/content/`)

A pasta `content/` é o coração do conteúdo didático. Cada curso, módulo e etapa é isolado em seu próprio script:

#### Controle do Catálogo
- `modo.js`: Define o modo de carregamento ativo (`window.CL_CONTEUDO_MODO = 'automatico'`).
- `modo-automatico.js` & `modo-manual.js`: Arquivos para alternância de modo.
- `catalogo-automatico.js`: Manifest gerado pelo script PowerShell contendo todos os scripts de conteúdo encontrados.
- `catalogo-manual.js`: Lista editável manualmente de arquivos de cursos ativos.

#### Modelos e Templates (`templates/`)
- `templates/Para-Novos-Cursos.md`: **guia oficial** de criação de curso, módulo e etapa na convenção final (leia-o antes de criar qualquer coisa).
- `templates/curso.js`, `templates/modulo.js`, `templates/etapa.js`, `templates/posicoes-trilha.js`: modelos do formato antigo, com `texto`/`missao` escritos dentro do `.js`. Esse formato ainda é aceito por `registrarEtapa()`, mas **só vale para cursos que não estão em `PASTAS_DE_CONTEUDO` (`ide.js`)**. Os cinco cursos publicados usam arquivos separados por aba; para eles, o modelo é uma etapa existente (por exemplo `css/css-modulo-01/css-etapa-01/`).
- `templates/curso.js` não é necessário: os cursos são cadastrados em `assets/js/curso-data.js`, e `registrarCurso()` não faz nada para um curso que já existe.

#### Convenção de pastas e nomes (estado final)
```text
content/<pasta>/
├── <prefixo>-modulos-planejamento.js        (módulos futuros; não cria módulos vazios antes dos reais)
├── <prefixo>-posicoes-trilha.js             (opcional: só onde há geometria personalizada)
└── <prefixo>-modulo-NN/
    ├── <prefixo>-00-modulo-NN.js            (registra o módulo)
    └── <prefixo>-etapa-NN/
        ├── <prefixo>-modulo-NN-etapa-NN.js            (registro: titulo, codigoInicial, verificar)
        └── <prefixo>-modulo-NN-etapa-NN-<aba>.{html,css,js}   (aba = conteudo | exercicio | questoes | desafio)
```
- Toda etapa tem **13 arquivos**: o registro `.js` e 4 abas × 3 extensões. O `scripts/verify-deploy.cjs` exige todos.
- Os arquivos de aba (`-conteudo.*`, `-exercicio.*`, `-questoes.*`, `-desafio.*`) **não entram nos catálogos**: o `ide.js` os carrega sob demanda quando a aba é aberta (HTML → CSS → JS), e só uma vez por aba.
- `-questoes.js` publica as questões em `CL.curso.questoesPorEtapa["<moduloId>:<n>"]`.
- Metadados do curso e ordem global ficam **somente** em `assets/js/curso-data.js` (`CL.curso.CURSOS` e `CL.curso.ORDEM_CURSOS`). Não existe mais `*-curso.js` por curso.

#### Conteúdos atuais (5 cursos × 2 módulos × 5 etapas = 50 etapas)
| Curso | Pasta / prefixo | ID interno | Temas |
|---|---|---|---|
| HTML | `html/` · `html-` | `html` | M1 estrutura, parágrafos, títulos, links e cartão · M2 imagens, semântica, tabelas, formulários e página completa |
| CSS | `css/` · `css-` | `css` | M1 estilos, classes, cores, tipografia e modelo de caixa · M2 Flexbox, Grid, responsividade, estados e perfil |
| JavaScript | `js/` · `js-` | `js` | M1 comandos, variáveis, tipos, operações e decisões · M2 funções, arrays, repetição, DOM e eventos |
| Lógica de Programação | `logprog/` · `logprog-` | **`programming-logic`** (não renomear: preserva o progresso salvo) | M1 algoritmos, variáveis, operadores e decisões · M2 repetição, funções, coleções, percursos e validação de entrada |
| Cyber Security | `cyber-security/` · `cyber-security-` | `cyber-security` | M1 fundamentos, senhas, MFA, phishing e atualizações · M2 Wi-Fi, privacidade, navegação, backups e resposta a incidentes |

- Pasta, prefixo e ID interno podem diferir (caso do LogProg). A ligação entre eles está em `PASTAS_DE_CONTEUDO`, no `ide.js`.
- IDs de módulo: `<idDoCurso>-modulo-NN` com dois dígitos. Exceção histórica: o módulo 1 do HTML é `html-modulo-1`, definido em `curso-data.js`. **Não normalize esse ID**: o progresso salvo usa a chave `<moduloId>:<etapa>`.
- Arquivos de posição da trilha existem em `css`, `html`, `js` e `cyber-security`; o LogProg usa o padrão de `CICLOS_TRILHA`.

#### Isolamento entre cursos
- CSS de etapa fica restrito à raiz da etapa: Cyber Security usa `.cs-*` e variáveis `--cs-*` definidas em `.cs-etapa`; LogProg usa `@scope (.logprog-etapa)` e variáveis em `.logprog-etapa`. Nada de seletor global (`.logo`, `.card`, `:root`).
- JS de etapa registra listeners no `.theory-pane` e ignora eventos fora da raiz da própria etapa (`closest('.cs-etapa')`, `closest('.logprog-etapa')`). Não exponha funções em `window` e não use `onclick` inline.
- Imagens e links dentro dos fragmentos usam caminho **relativo** (`assets/images/...`). Caminho absoluto (`/public/...`) quebra no GitHub Pages.

### 2.9 Imagens e Recursos Visuais (`public/assets/images/`)

#### Imagens Principais e Logos
- Logos da plataforma: `Logo-120.png`, `basic-logo.png`, `blue-transparent-logo-coding-loop.png`, `white-logo-black-background-coding-loop.png`, `silver-transparent-logo-coding-loop.png`.
- Banners e texturas: `developer-text-img.png`, `front-end-developer-text-img.png`, `landing-page-img.png`.
- Backgrounds de trilhas: `trilha-bg-html.png`, `trilha-bg-css.png`, `trilha-bg-js.png`, `trilha-bg-logprog.png`, e suas variantes `stage` e `titulo`.
- Gráficos de código: `html-code-path.webp`, `css-code-path.webp`, `js-code-path.webp`, `royal-blue-escuro-code-path-html.webp`.

#### Ícones SVG (`public/assets/images/icons.svg/`)
- Contém mais de 45 ícones vetoriais de navegação, temas, IDE, botões e linguagens:
  - Linguagens: `logo-html.svg`, `logo-css.svg`, `logo-javascript.svg`, `logprog.svg`, `logica-de-programacao.svg`.
  - Controles de UI: `seta-avancar.svg`, `seta-retornar.svg`, `menu.svg`, `Tela-Cheia.svg`, `maximizar.svg`, `theme.svg`, `settings.svg`, `lixeira.svg`.
  - Backup & Nuvem: `google-drive.svg`, `logo-onedrive.svg`, `migrar-progresso.svg`, `export-progress-dark.svg`.
  - Manifest: `embedded-icons-manifest.json`.

#### Vetores de Posição da Trilha (`public/assets/images/track-modules-position/`)
- SVGs que representam os módulos e blocos da trilha nas posições geométricas:
  - `html.svg`, `css.svg`, `js.svg`, `logprog.svg`, `ts.svg`, `json.svg`, `xml.svg`, `scss.svg`, `markdown.svg`, `jsx-react.svg`.
  - Blocos de faixas: `Img11-3000-3300.svg` a `Img19-5400-5700.svg`.

---

## 3. Fluxos de Dados e Ciclo de Vida da Aplicação

### 3.1 Fluxo de Autenticação e Carregamento de Página
1. O usuário acessa uma página (ex.: `dashboard.html` ou `ide.html`).
2. No `<head>`, a flag inline `window.CL_PROTECTED_PAGE = true;` é configurada.
3. Carregam-se: `firebase-init.js` -> `auth.js` -> `api.js` -> `router.js` -> `app.js`.
4. `CL.auth.init()` ouve a mudança de estado do Firebase Auth (`onAuthStateChanged`):
   - Se a página for protegida e o usuário não estiver logado, redireciona automaticamente para `index.html`.
   - Se logado, popula `CL.state.user` e emite os eventos de prontidão da UI.

### 3.2 Fluxo de Conteúdo Dinâmico
1. A página inclui `modo.js`, `catalogo-automatico.js` (ou manual) e `curso-etapas-loader.js`.
2. O `curso-etapas-loader.js` carrega em série todos os scripts do catálogo (cursos já cadastrados em `curso-data.js`; módulos em `*-00-modulo-NN.js`; registros de etapa `*-modulo-NN-etapa-NN.js`).
3. Cada script chama `CL.curso.registrarModulo()` ou `CL.curso.registrarEtapa()`. `registrarCurso()` só age para um curso que ainda não existe.
4. O loader aguarda as Promises de `CL.curso.recursosDeEtapas` (recursos auxiliares HTML/CSS que algum script tenha registrado) e só então aplica `CL.curso.aplicarEtapasPorArquivo()`; em seguida resolve `CL.curso.conteudoPronto`.
5. Os controladores (`pagina-dashboard.js`, `pagina-curso.js`, `ide.js`) aguardam `CL.curso.conteudoPronto` antes de montar a interface.
6. Já na IDE, o conteúdo de cada aba (`-conteudo`, `-exercicio`, `-desafio`, `-questoes`) é buscado sob demanda por `carregarConteudoDaAba()` e fica em cache. A Learn Platform sempre abre no índice do módulo atual; a etapa só aparece quando o aluno a escolhe.

### 3.3 Fluxo da IDE e Validação de Código
1. O aluno abre `ide.html?modulo=<id>&etapa=<num>`.
2. A IDE instancia o editor Monaco com suporte a HTML, CSS e JavaScript.
3. Ao digitar, o código é renderizado em um `iframe` seguro (sandbox).
4. O aluno clica em **Executar / Verificar**:
   - A função `verificar(codigo)` da respectiva etapa é executada.
   - Retorna um valor de `0` a `100`.
   - O percentual e o status de conclusão são salvos no `localStorage` via `CL.api.saveProgress()`.
   - Mensagens de erro de TypeScript/JavaScript passam por `integracao-traducao-diagnosticos.js` e são traduzidas em tempo real pelo dicionário pt-BR.

---

## 4. Guia de Orientação para Futuros Desenvolvimentos

### 4.1 Como Adicionar uma Nova Etapa / Aula a um Módulo Existente
1. Vá à pasta do módulo: `public/assets/content/<pasta>/<prefixo>-modulo-NN/`.
2. Copie uma etapa existente do mesmo curso (por exemplo `<prefixo>-etapa-05/`) para `<prefixo>-etapa-06/` e renomeie **todos os 13 arquivos** para `<prefixo>-modulo-NN-etapa-06*`.
3. No registro `<prefixo>-modulo-NN-etapa-06.js`, ajuste o número da etapa (2º argumento) e o ID do módulo:
```javascript
(function () {
  'use strict';
  window.CL.curso.registrarEtapa('html-modulo-02', 6, {
    titulo: 'Título da Aula',
    codigoInicial: { html: '<h1>Meu Título</h1>', css: '', js: '' },
    verificar: function (codigo) {
      // Retorna de 0 a 100 com base no código do aluno
      return /<h1>.*<\/h1>/i.test(codigo.html || '') ? 100 : 0;
    }
  });
})();
```
4. Escreva o conteúdo nos arquivos de aba: teoria em `-conteudo.html`, missão em `-exercicio.html`, enunciado em `-desafio.html` e questões em `-questoes.js`. O segundo argumento de `registrarEtapa` e o número no nome do arquivo devem coincidir (o sistema não valida isso).
5. Atualize o catálogo (modo automático): `powershell -ExecutionPolicy Bypass -File .\scripts\gerar-manifest-conteudo.ps1`. No modo manual, acrescente **apenas o registro** (`.../<prefixo>-modulo-NN-etapa-06.js`) em `catalogo-manual.js`: os arquivos de aba não entram no catálogo.
6. Rode `node scripts/verify-deploy.cjs`.

> [!IMPORTANT]
> **Nunca altere o ID de cursos ou módulos já publicados.** O progresso do usuário no navegador é indexado pela chave `<moduloId>:<numeroDaEtapa>`. Mudar o ID fará o aluno perder o histórico concluído.

### 4.2 Como Criar um Curso Completamente Novo
Siga `templates/Para-Novos-Cursos.md`. Em resumo, um curso só aparece completo se estiver em **todos** estes pontos:
1. `assets/js/curso-data.js`: chave em `CL.curso.CURSOS` (com `modulos: []`) e o ID em `CL.curso.ORDEM_CURSOS`. **Não crie `curso.js`.**
2. `assets/content/<pasta>/`: módulos e etapas na convenção da seção 2.8.
3. `assets/js/trilha.js`: `CICLOS_TRILHA[<id>]`, `CL.trilha.LOGOS[<id>]` e `imagensTitulo[<id>]`.
4. `assets/css/trilha.css`: as duas regras de fundo `.trilha-container[data-curso="<id>"]`.
5. `assets/js/pagina-curso.js`: `logoCursoSvg()` e `layoutPorCurso`.
6. `assets/js/ide.js`: entrada em `PASTAS_DE_CONTEUDO` (sem ela a IDE não carrega os arquivos de aba).
7. `scripts/verify-deploy.cjs`: entrada em `cursosComEtapas`.
8. Catálogo regenerado com `gerar-manifest-conteudo.ps1`.

### 4.3 Como Adicionar uma Nova Tela ou Seção no Dashboard
1. No arquivo `public/dashboard.html`, adicione a marcação HTML da sua nova seção (geralmente uma `<section id="cl-page-minha-secao" class="cl-page">`).
2. Em `public/assets/js/router.js`, registre a nova rota:
```javascript
CL.router.register('minha-secao', {
    pageId: 'cl-page-minha-secao',
    title: 'Minha Seção',
    onEnter: function () { /* Inicialização da tela */ },
    onLeave: function () { /* Limpeza de listeners */ }
});
```
3. Crie um arquivo controlador correspondente, se necessário (ex.: `public/assets/js/pagina-minha-secao.js`), e o inclua antes de `app.js` no `dashboard.html`.

### 4.4 Como Modificar o Design System ou Temas
- Cores e tokens principais ficam centralizados em `public/assets/css/global.css`.
- As variáveis CSS usam o prefixo `--cl-*` (ex.: `--cl-bg-primary`, `--cl-text-primary`, `--cl-accent`).
- Suporta alternância dinâmica entre tema escuro e claro via classes de tema no elemento raiz `<html>` ou `<body>`.

---

## 5. Checklist de Verificação e Publicação

Antes de enviar qualquer alteração para a branch principal (GitHub) ou publicar no Firebase:

1. **Validação de Conteúdo**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\gerar-manifest-conteudo.ps1
   ```
2. **Auditoria de Segurança Local**:
   ```powershell
   node reports/security/verify-security.cjs
   ```
3. **Verificação de Empacotamento para Deploy**:
   ```powershell
   node scripts/verify-deploy.cjs
   ```
4. **Deploy no Firebase (apenas se alterar regras ou comunicados)**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-firebase.ps1
   ```
5. **Git Push**:
   Envie para o repositório principal. O GitHub Actions rodará automaticamente `.github/workflows/pages.yml` e publicará o site no GitHub Pages.
