/* =====================================================
   AUTH.JS
   Login/Logout via Firebase Authentication (Google) e
   proteção de rotas (CL.auth). Substitui o antigo fluxo
   manual de OAuth implícito + localStorage.

   Depende de: firebase-init.js (CL.firebase)
   ===================================================== */
(function () {
    "use strict";

    window.CL = window.CL || {};
    const CL = window.CL;

    /* ===================================================== */
    /* STORAGE — preferências e dados de estudo locais. Progresso e códigos
       ficam separados por usuário no navegador (ver api.js) e só passam
       para outro dispositivo por meio dos backups configurados pelo aluno. */
    /* ===================================================== */

    CL.storage = {};

    CL.storage.prefix = function (key) {
        return `${CL.config.storagePrefix}:${key}`;
    };

    CL.storage.get = function (key, fallback = null) {
        try {
            const value = localStorage.getItem(CL.storage.prefix(key));
            return value !== null ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
        }
    };

    CL.storage.set = function (key, value) {
        try {
            localStorage.setItem(CL.storage.prefix(key), JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    };

    CL.storage.remove = function (key) {
        try {
            localStorage.removeItem(CL.storage.prefix(key));
            return true;
        } catch (error) {
            return false;
        }
    };

    CL.storage.has = function (key) {
        return localStorage.getItem(CL.storage.prefix(key)) !== null;
    };

    /* ===================================================== */
    /* AUTH */
    /* ===================================================== */

    CL.auth = {};

    /* Promise que resolve assim que sabemos, com certeza, se há ou
       não um usuário logado (primeiro disparo do onAuthStateChanged).
       Todo mundo que precisa checar sessão (guard, boot) deve dar
       "await" nela antes de decidir qualquer coisa. */
    let resolveReady = null;
    CL.auth.ready = new Promise(function (resolve) {
        resolveReady = resolve;
    });

    CL.auth.isAuthenticated = function () {
        return CL.state.authenticated === true;
    };

    /* AUTH > ERROR HANDLER
       Mapeia os códigos de erro mais comuns do Firebase Auth pra
       mensagens em PT-BR e mostra via toast. Usado por todos os
       métodos de login/cadastro (OAuth, email/senha, telefone). */
    CL.auth._errorMessages = {
        "auth/email-already-in-use": "Esse email já está cadastrado. Tente entrar em vez de criar uma conta.",
        "auth/invalid-email": "Email inválido.",
        "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
        "auth/user-not-found": "Email ou senha incorretos.",
        "auth/wrong-password": "Email ou senha incorretos.",
        "auth/invalid-credential": "Email ou senha incorretos.",
        "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.",
        "auth/account-exists-with-different-credential": "Esse email já está cadastrado usando outro método de login (Google, Facebook, etc). Tente entrar por ele.",
        "auth/requires-recent-login": "Por segurança, entre novamente antes de excluir a conta.",
        "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente."
    };

    /* Alguns erros são silenciosos de propósito (usuário cancelou uma
       ação voluntariamente) — não fazem sentido como toast de erro. */
    CL.auth._silentErrorCodes = [
        "auth/popup-closed-by-user",
        "auth/cancelled-popup-request"
    ];

    CL.auth._handleError = function (context, error) {
        if (CL.config.debug) {
            console.error(`[CL.auth] ${context}:`, error);
        }

        const code = error && error.code;

        if (CL.auth._silentErrorCodes.includes(code)) {
            return;
        }

        const message = CL.auth._errorMessages[code] || "Não foi possível concluir a ação. Tente novamente.";

        if (CL.ui && typeof CL.ui.showToast === "function") {
            CL.ui.showToast(message, "danger", 6000);
        } else {
            alert(message);
        }
    };

    CL.auth.getUser = function () {
        return CL.state.user;
    };

    /* Converte o objeto de usuário do Firebase Auth (firebase.User)
       no formato simples que o resto do app (CL.state.user) espera. */
    CL.auth._mapUser = function (fbUser) {
        if (!fbUser) {
            return null;
        }
        const providers = (fbUser.providerData || []).map(function (provider) { return provider.providerId; });
        const providerMap = {
            "password": "email",
            "google.com": "google",
            "github.com": "github",
            "facebook.com": "facebook",
            "microsoft.com": "microsoft"
        };
        return {
            id: fbUser.uid,
            name: fbUser.displayName || "",
            email: fbUser.email || "",
            avatar: fbUser.photoURL || "",
            // Prefere um provider social conhecido ao password quando a conta
            // possui credenciais vinculadas; a posição no array do SDK não é
            // uma garantia de qual provider deve ser exibido.
            provider: providerMap[providers.find(function (providerId) { return providerId !== "password" && providerMap[providerId]; })] ||
                providerMap[providers.find(function (providerId) { return providerMap[providerId]; })] || "email"
        };
    };

    /* Mantém os dados básicos da conta disponíveis para a interface local. */
    CL.auth._syncProfile = async function (user) {
        /* A Landing usa apenas autenticação e não carrega api.js. */
        if (!CL.api || typeof CL.api.saveProfile !== "function") return true;
        try {
            const payload = {
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                provider: user.provider
            };
            await CL.api.saveProfile(payload);
        } catch (error) {
            if (CL.config.debug) {
                console.error("[CL.auth] falha ao salvar perfil local:", error);
            }
            if (CL.ui && typeof CL.ui.showToast === "function") {
                CL.ui.showToast("Não foi possível salvar seu perfil neste navegador.", "warning", 5000);
            }
        }
    };

    /* AUTH > INIT
       Liga o listener do Firebase (onAuthStateChanged). Precisa ser
       chamado uma vez, o quanto antes, em toda página que usa CL.auth
       (landing e dashboard). */
    CL.auth.init = function () {

        CL.firebase.auth.onAuthStateChanged(async function (fbUser) {

            const user = CL.auth._mapUser(fbUser);

            CL.state.user = user;
            CL.state.authenticated = !!user;

            if (user) {
                // renderUser() só usa dados que já vêm do próprio Firebase
                // Auth (nome/email/avatar) — não depende dos dados de estudo, então
                // não precisa esperar _syncProfile pra mostrar isso na tela.
                CL.auth.renderUser();

                // O perfil local é atualizado em segundo plano; autenticar e
                // liberar a página protegida depende apenas do Firebase Auth.
                // _syncProfile trata os próprios erros internamente.
                CL.auth._syncProfile(user);
            }

            if (resolveReady) {
                resolveReady();
                resolveReady = null;
                return;
            }

            /* Mudanças de sessão DEPOIS do primeiro carregamento (ex.:
               logout feito em outra aba) — se estivermos numa página
               protegida e o boot já rodou, manda pra Landing. */
            if (!user && CL.state.initialized && CL.config.protectedPage) {
                window.location.href = CL.config.landingUrl;
            }

        });

    };

    /* AUTH > LOGIN COM PROVEDOR OAUTH (Google, Facebook, GitHub, Microsoft)
       Popup, com fallback pra redirect caso o navegador bloqueie popups
       (comum em mobile). providerKey precisa bater com uma chave de
       CL.firebase.providers (ver firebase-init.js). */
    CL.auth.loginWithProvider = async function (providerKey) {

        const provider = CL.firebase.providers && CL.firebase.providers[providerKey];

        if (!provider) {
            if (CL.config.debug) {
                console.error(`[CL.auth] provedor desconhecido: "${providerKey}"`);
            }
            return false;
        }

        try {
            await CL.firebase.auth.signInWithPopup(provider);
            return true;
        } catch (error) {

            const popupBlocked = error && error.code === "auth/popup-blocked";

            if (popupBlocked) {
                await CL.firebase.auth.signInWithRedirect(provider);
                return true;
            }

            CL.auth._handleError(`loginWithProvider(${providerKey})`, error);
            return false;
        }
    };

    /* Mantido por compatibilidade com código existente que ainda
       chama CL.auth.loginWithGoogle() diretamente. */
    CL.auth.loginWithGoogle = function () {
        return CL.auth.loginWithProvider("google");
    };

    /* ===================================================== */
    /* AUTH > EMAIL/SENHA */
    /* ===================================================== */

    CL.auth.registerWithEmail = async function (email, password) {
        try {
            await CL.firebase.auth.createUserWithEmailAndPassword(email, password);
            return true;
        } catch (error) {
            CL.auth._handleError("registerWithEmail", error);
            return false;
        }
    };

    CL.auth.loginWithEmail = async function (email, password) {
        try {
            await CL.firebase.auth.signInWithEmailAndPassword(email, password);
            return true;
        } catch (error) {
            CL.auth._handleError("loginWithEmail", error);
            return false;
        }
    };

    CL.auth.sendPasswordReset = async function (email) {
        try {
            await CL.firebase.auth.sendPasswordResetEmail(email);
            if (CL.ui && typeof CL.ui.showToast === "function") {
                CL.ui.showToast("Enviamos um link de redefinição de senha para o seu email.", "success", 6000);
            }
            return true;
        } catch (error) {
            CL.auth._handleError("sendPasswordReset", error);
            return false;
        }
    };

    /* AUTH > LOGOUT */
    CL.auth.logout = async function () {
        try {
            if (CL.api && typeof CL.api.syncLocalData === "function") {
                await CL.api.syncLocalData();
            }
            await CL.firebase.auth.signOut();
        } catch (error) {
            if (CL.config.debug) {
                console.error("[CL.auth] falha ao sair:", error);
            }
        } finally {
            window.location.href = `${CL.config.landingUrl}?reason=logout`;
        }
    };

    CL.auth.reauthenticateForSensitiveAction = async function (firebaseUser) {
        const providerIds = (firebaseUser.providerData || []).map(function (provider) { return provider.providerId; });
        const providerKeys = {
            "google.com": "google",
            "facebook.com": "facebook",
            "github.com": "github",
            "microsoft.com": "microsoft"
        };
        const providerId = providerIds.find(function (id) { return providerKeys[id]; });

        if (providerId) {
            const provider = CL.firebase.providers && CL.firebase.providers[providerKeys[providerId]];
            if (!provider) throw new Error("Provedor de reautenticação indisponível.");
            await firebaseUser.reauthenticateWithPopup(provider);
            return true;
        }

        if (providerIds.includes("password")) {
            const password = window.prompt("Por segurança, informe sua senha atual para excluir a conta:");
            if (password === null) {
                const cancelled = new Error("Reautenticação cancelada.");
                cancelled.code = "auth/popup-closed-by-user";
                throw cancelled;
            }
            const credential = firebase.auth.EmailAuthProvider.credential(firebaseUser.email, password);
            await firebaseUser.reauthenticateWithCredential(credential);
            return true;
        }

        const error = new Error("Não foi possível determinar o método de reautenticação.");
        error.code = "auth/requires-recent-login";
        throw error;
    };

    /* A exclusão exige uma reautenticação explícita antes de remover dados.
       Isso reduz a janela de inconsistência do fluxo somente no cliente. */
    CL.auth.deleteAccount = async function () {
        const firebaseUser = CL.firebase.auth.currentUser;
        if (!firebaseUser || !CL.auth.isAuthenticated()) return false;
        try {
            await CL.auth.reauthenticateForSensitiveAction(firebaseUser);
            await CL.api.deleteAllUserData();
            await firebaseUser.delete();
            return true;
        } catch (error) {
            CL.auth._handleError("deleteAccount", error);
            return false;
        }
    };

    /* AUTH > UPDATE USER — atualiza o perfil de estudo local. */
    CL.auth.updateUser = async function (data) {
        data = data || {};

        if (!CL.auth.isAuthenticated()) {
            return false;
        }

        try {
            await CL.api.saveProfile(data);
            const firebaseData = {};
            if (typeof data.name === "string") firebaseData.displayName = data.name;
            if (Object.keys(firebaseData).length && CL.firebase.auth.currentUser) {
                await CL.firebase.auth.currentUser.updateProfile(firebaseData);
            }
        } catch (error) {
            if (CL.config.debug) {
                console.error("[CL.auth] falha ao atualizar usuário:", error);
            }
            return false;
        }

        /* profileAvatar é uma personalização local do Coding Loop; não faz
           parte do Firebase Auth nem altera a foto importada da conta. */
        const stateData = Object.assign({}, data);
        delete stateData.profileAvatar;
        CL.state.user = Object.assign({}, CL.state.user, stateData);
        CL.auth.renderUser();
        return true;
    };

    /* AUTH > GUARD
       Espera a primeira resposta do Firebase (CL.auth.ready) e só
       então decide: sem sessão -> redireciona pra Landing e retorna
       false; com sessão -> retorna true e libera a página. */
    CL.auth.guard = async function () {

        await CL.auth.ready;

        if (!CL.auth.isAuthenticated()) {
            window.location.href = `${CL.config.landingUrl}?reason=unauthenticated`;
            return false;
        }

        CL.auth.renderUser();

        /* #cl-app começa hidden='hidden' no HTML (evita mostrar o dashboard
           por uma fração de segundo antes do guard decidir). Confirmada a
           sessão, é aqui que ele aparece. */
        const app = document.getElementById("cl-app");
        if (app) {
            app.hidden = false;
        }

        return true;
    };

    /* AUTH > RENDER USER — espelha os dados do usuário logado nos
       pontos da UI que existem tanto no header quanto no aside. */
    CL.auth.renderUser = function () {

        const user = CL.state.user;

        if (!user) {
            return;
        }

        const headerAvatar = document.getElementById("cl-user-avatar");
        const asideAvatar = document.getElementById("cl-user-avatar-aside");
        const asideName = document.getElementById("cl-user-name-aside");

        if (headerAvatar) {
            headerAvatar.src = user.avatar || "";
        }

        if (asideAvatar) {
            asideAvatar.src = user.avatar || "";
        }

        if (asideName) {
            asideName.textContent = user.name || "Perfil";
        }

    };

})();
