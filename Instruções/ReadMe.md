# Coding Loop

Plataforma de cursos práticos de programação. O site é estático (HTML, CSS e JavaScript) e usa Firebase para autenticação e comunicados. Perfil, progresso e exercícios ficam no navegador; a transferência entre dispositivos depende dos backups.

## Publicar o site no GitHub Pages

No repositório `coding-loop/web.app`, abra Settings → Pages → Build and deployment → Source e selecione **GitHub Actions**. Envie as alterações para a branch padrão. O workflow `.github/workflows/pages.yml` verifica o projeto, prepara somente os arquivos públicos e publica a versão completa. Também pode ser iniciado em Actions → Publicar GitHub Pages → Run workflow na branch padrão.

Sem domínio personalizado, o endereço esperado é `https://coding-loop.github.io/web.app/`. O nome do repositório `web.app` é um subdiretório desse endereço, não um domínio personalizado. Os caminhos relativos permitem carregar dashboard e IDE nesse subdiretório. A cada publicação o pacote ativo é substituído; o histórico Git e os dados do Firebase não são apagados.

No Firebase Console → Authentication → Settings → Authorized domains, adicione `coding-loop.github.io` (sem protocolo nem caminho). Mantenha `authDomain` como `coding-loop.firebaseapp.com`: ele é o domínio do serviço de autenticação. Se usar domínio personalizado, autorize-o também. Habilite os provedores de login que deseja usar. Backups Google Drive/OneDrive têm configurações OAuth próprias e precisam autorizar a origem e os redirects correspondentes quando essas integrações forem ativadas.

O workflow não precisa de chave administrativa nem de credencial Firebase. O pacote exclui backups pessoais, configurações, regras e documentação. Os cabeçalhos que estavam na configuração de Firebase Hosting não se aplicam ao GitHub Pages; o servidor do Pages gerencia os cabeçalhos HTTP.

## Publicar regras e índices no Firebase

Execute na raiz `Edition-Coding-Loop` (fora de `public`):

```powershell
firebase login
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-firebase.ps1
```

O projeto já está configurado; não execute `firebase init` novamente. O script verifica os arquivos e publica apenas as regras e o índice dos comunicados no projeto `coding-loop`. O Firebase continua responsável pela autenticação e pelo Firestore. A hospedagem é feita no GitHub Pages.

O arquivo `firebase.json` da raiz configura regras, índices e emuladores. `public/firebase.json` serve à configuração local anterior e não é enviado ao GitHub Pages. Regras publicadas substituem as do Console; o deploy dos índices pode pedir confirmação caso existam índices remotos ausentes da configuração local. Não confirme sua exclusão sem verificar uso por outros clientes.

Validação local sem publicar: `node scripts/verify-deploy.cjs`. A aceitação das regras pelo servidor, as permissões da conta e o login real só podem ser confirmados com acesso ao Firebase. O índice novo pode levar tempo para ficar disponível após o deploy. Este deploy não exige Java.

## Executar localmente com emuladores

Na pasta `public`, execute `firebase emulators:start --project demo-coding-loop --only auth,firestore` (requer Firebase CLI e Java compatível). Depois abra a pasta `public` com Live Server/Live Preview em `http://localhost`. O localhost usa somente o projeto demo e os emuladores; eles precisam estar ativos. Não abra os arquivos por duplo clique (`file://`), pois o Firebase Auth exige HTTP(S).

## Painel de avisos para administradores

Abra `admin.html` depois do deploy para publicar, editar ou remover avisos que aparecerão no dashboard dos alunos. Por segurança, o acesso depende da *custom claim* `admin: true` no Firebase Authentication; não basta conhecer a URL. A claim deve ser atribuída uma vez pelo proprietário usando o Firebase Admin SDK/Cloud Functions e o aluno precisa sair e entrar novamente para renovar o token. Publique também as regras com `firebase deploy --only firestore:rules`.

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

Nunca mude o `id` de um curso ou módulo depois de publicar. O progresso salvo localmente usa a chave `<moduloId>:<numeroDaEtapa>`. É seguro corrigir textos, missões, código inicial e regras de validação; para reorganizações grandes, crie um novo módulo em vez de renomear o antigo.

## Conteúdo existente

O catálogo anterior foi mantido em `public/assets/js/curso-data.js` para preservar os cursos atuais. As novas etapas de HTML do módulo 1 já foram extraídas para `public/assets/content/html/modulo-01/` como referência real de implementação. Os próximos conteúdos devem ser adicionados na nova estrutura, não no catálogo legado.

## Segurança

Backups pessoais ficam em `private-backups/`, fora de `public/` e ignorados pelo Git. Publique somente `public/`; nunca a raiz do repositório. Execute `node reports/security/verify-security.cjs` antes da publicação. O histórico Git pode conter o backup removido: revisar exposição e cópias publicadas separadamente.

As regras atuais negam novas escritas de estudo no Firestore, mantendo leitura e exclusão dos dados legados pelo próprio usuário. Antes de publicar as regras, confira a compatibilidade de clientes antigos. As regras de comunicados exigem schema estrito e metadados; documentos antigos com campos extras precisam ser migrados por um administrador.

Em produção, confira cabeçalhos HTTP, MFA administrativo, restrições de API keys, quotas, logs e regras efetivamente publicadas. Não há deploy automático nesta correção. Consulte o relatório de correções em `reports/security/CORRECOES-2026-09-08.md`.
