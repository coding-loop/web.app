/* =====================================================
   FIREBASE-INIT.JS
   Conexão e inicialização do SDK do Firebase.
   Carrega DEPOIS dos scripts compat do Firebase (app, auth,
   firestore) e ANTES de qualquer outro módulo do CL (auth.js,
   api.js, router.js, app.js).
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

    /* EMULADORES — conecta automaticamente quando o app está rodando
       localmente (via `firebase emulators:start`, servido em localhost
       ou 127.0.0.1). Em produção (domínio real) isso é ignorado e o
       app fala normalmente com o Firebase de verdade.
       Precisa ser chamado ANTES de qualquer uso de auth/db (login,
       leitura, escrita) — por isso fica logo aqui na inicialização. */
    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

    if (isLocalhost) {
        auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
        db.useEmulator("127.0.0.1", 8080);
        console.info("[CL.firebase] conectado aos emuladores locais (Auth :9099, Firestore :8080).");
    }

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
