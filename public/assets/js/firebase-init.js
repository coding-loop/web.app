/* =====================================================
   FIREBASE-INIT.JS
   Conexão e inicialização do SDK do Firebase.
   Carrega DEPOIS dos scripts compat do Firebase (app, auth,
   firestore) e ANTES de qualquer outro módulo do CL (auth.js,
   api.js, router.js, app.js).

   ===================================================== 
   ⚙️  CHECKLIST — RODAR NO VS CODE (PREVIEW) x DEPLOY NO FIREBASE
   =====================================================

   1) COMO ABRIR O PREVIEW NO VS CODE (obrigatório):
      - Use a extensão "Live Server" (ou "Live Preview") e clique em
        "Go Live" a partir do index.html. NUNCA abra o arquivo com
        duplo-clique (protocolo file://) — o Firebase Auth (popup do
        Google) e o Firestore não funcionam nesse protocolo, só em
        http(s)://.

   2) DOMÍNIO DO PREVIEW — use "localhost", NÃO "127.0.0.1":
      - O Firebase já autoriza "localhost" automaticamente pra login
        (Authentication > Settings > Authorized domains), mas
        "127.0.0.1" NÃO vem autorizado por padrão. Se o Live Server
        abrir em 127.0.0.1 e o login com Google der erro
        "auth/unauthorized-domain", troque a porta padrão do Live
        Server pra abrir em "http://localhost:5500" (Configurações da
        extensão Live Server > "Live Server > Settings: Host" = 
        "localhost"), OU adicione "127.0.0.1" na lista de domínios
        autorizados no Console do Firebase.

   3) EMULADORES DO FIRESTORE/AUTH — DESLIGADOS por padrão aqui embaixo:
      - Este projeto detectava "localhost/127.0.0.1" e tentava se
        conectar sozinho aos Emuladores do Firebase (portas 9099 e
        8080). Só que o firebase.json deste projeto NÃO tem a seção
        "emulators" configurada e, rodando pelo Live Server, nenhum
        emulador está de pé — então toda chamada de login/leitura/
        escrita falhava (ERR_CONNECTION_REFUSED).
      - Por isso esse bloco está COMENTADO abaixo: assim, mesmo
        rodando localmente no VS Code, o app fala direto com o
        Firebase de verdade (projeto "coding-loop"), exatamente como
        vai falar em produção — sem precisar instalar/rodar nada além
        do Live Server.
      - Se um dia você quiser usar os emuladores locais de verdade,
        precisa: (a) rodar `firebase emulators:start`, (b) ter a seção
        "emulators" no firebase.json, e só então (c) descomentar o
        bloco "EMULADORES" logo abaixo.

   4) PARA O DEPLOY FINAL (`firebase deploy`):
      - Nenhuma mudança é necessária aqui — a apiKey/config do
        firebaseConfig abaixo já é a mesma tanto pra preview local
        quanto pra produção (não precisa remover/trocar nada).
      - Basta garantir que o domínio real (ex.: coding-loop.web.app)
        já está na lista de "Authorized domains" — normalmente já vem
        sozinho quando o projeto é hospedado no Firebase Hosting.
   ===================================================== */
(function (global) {
    "use strict";

    window.CL = window.CL || {};
    const CL = window.CL;

    /* Configuração do projeto Firebase "coding-loop".
       apiKey do Firebase NÃO é segredo — ele só identifica o
       projeto no Google, a segurança de verdade fica nas
       firestore.rules (veja o arquivo firestore.rules). */
    const firebaseConfig = {
        apiKey: "AIzaSyCrr-dwZvA6I68dwM_P_Sqh_7dAIgsBuG8",
        authDomain: "coding-loop.firebaseapp.com",
        projectId: "coding-loop",
        storageBucket: "coding-loop.firebasestorage.app",
        messagingSenderId: "344147171863",
        appId: "1:344147171863:web:e084815f63deea91361a52",
        measurementId: "G-G2BV5MSZW8"
    };

    if (typeof firebase === "undefined") {
        console.error(
            "[CL.firebase] SDK do Firebase não encontrado. " +
            "Confirme que os scripts firebase-app-compat.js, " +
            "firebase-auth-compat.js e firebase-firestore-compat.js " +
            "foram incluídos ANTES de firebase-init.js no HTML."
        );
        return;
    }

    /* Evita reinicializar se o script for incluído mais de uma vez
       (ex.: navegação entre páginas que compartilham o mesmo app). */
    const app = firebase.apps && firebase.apps.length
        ? firebase.app()
        : firebase.initializeApp(firebaseConfig);

    /* Analytics é opcional — só ativa se o SDK compat correspondente
       tiver sido incluído no HTML. Nunca deve travar o boot do app. */
    if (typeof firebase.analytics === "function") {
        try {
            firebase.analytics();
        } catch (error) {
            /* silencioso: analytics não é crítico para o funcionamento */
        }
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    /* EMULADORES — DESATIVADO por padrão (ver checklist no topo do
       arquivo, item 3). Descomente o bloco abaixo SOMENTE se você for
       rodar `firebase emulators:start` de propósito e tiver a seção
       "emulators" configurada no firebase.json. Enquanto estiver
       comentado, o app (tanto no preview do VS Code quanto em
       produção) fala direto com o Firebase de verdade.

    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

    if (isLocalhost) {
        auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
        db.useEmulator("127.0.0.1", 8080);
        console.info("[CL.firebase] conectado aos emuladores locais (Auth :9099, Firestore :8080).");
    }
    */

    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });

    const facebookProvider = new firebase.auth.FacebookAuthProvider();

    const githubProvider = new firebase.auth.GithubAuthProvider();

    /* Microsoft usa o provider OAuth genérico (não tem classe própria
       no compat SDK, ao contrário de Google/Facebook/GitHub).
       "common" aceita conta pessoal E corporativa/escolar; troque por
       "organizations" ou o tenant id se quiser restringir. */
    const microsoftProvider = new firebase.auth.OAuthProvider("microsoft.com");
    microsoftProvider.setCustomParameters({ tenant: "common" });

    /* Registro central dos provedores OAuth por chave — usado pelo
       CL.auth.loginWithProvider("google" | "facebook" | "github" | "microsoft")
       pra não precisar de uma função de login separada pra cada um. */
    const providers = {
        google: googleProvider,
        facebook: facebookProvider,
        github: githubProvider,
        microsoft: microsoftProvider
    };

    /* Mantém sessão entre aberturas do navegador (equivalente ao que
       o CL.storage antigo fazia manualmente com localStorage). */
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function (error) {
        if (CL.config && CL.config.debug) {
            console.error("[CL.firebase] falha ao configurar persistência:", error);
        }
    });

    CL.firebase = {
        app: app,
        auth: auth,
        db: db,
        googleProvider: googleProvider,
        providers: providers,
        FieldValue: firebase.firestore.FieldValue,
        Timestamp: firebase.firestore.Timestamp
    };

})(window);
