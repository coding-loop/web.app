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
    /* STORAGE — apenas preferências de UI (tema, idioma).
       Dados de usuário/progresso NUNCA ficam mais no
       localStorage: tudo isso agora vive no Firestore
       (ver api.js), sincronizado entre dispositivos. */
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
        "auth/invalid-phone-number": "Número de telefone inválido. Use o formato internacional, ex: +5511912345678.",
        "auth/invalid-verification-code": "Código incorreto. Confira e tente novamente.",
        "auth/code-expired": "O código expirou. Solicite um novo.",
        "auth/missing-verification-code": "Digite o código recebido por SMS.",
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
        return {
            id: fbUser.uid,
            name: fbUser.displayName || "",
            email: fbUser.email || "",
            avatar: fbUser.photoURL || "",
            provider: "google"
        };
    };

    /* Cria/atualiza o documento users/{uid} no Firestore sempre que o
       usuário loga. createdAt só é gravado na primeira vez. */
    CL.auth._syncProfile = async function (user) {
        try {
            const ref = CL.firebase.db.collection("users").doc(user.id);
            const snap = await ref.get();

            const payload = {
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                provider: user.provider,
                lastLoginAt: CL.firebase.FieldValue.serverTimestamp()
            };

            if (!snap.exists) {
                payload.createdAt = CL.firebase.FieldValue.serverTimestamp();
            }

            await ref.set(payload, { merge: true });
        } catch (error) {
            if (CL.config.debug) {
                console.error("[CL.auth] falha ao sincronizar perfil:", error);
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
                await CL.auth._syncProfile(user);
                CL.auth.renderUser();
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

            const popupBlocked = error && (
                error.code === "auth/popup-blocked" ||
                error.code === "auth/cancelled-popup-request"
            );

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

    /* ===================================================== */
    /* AUTH > TELEFONE (SMS)
       Fluxo em 2 passos:
         1. sendPhoneCode(phoneNumber, recaptchaContainerId) -> dispara o SMS
         2. confirmPhoneCode(code) -> confirma o código recebido
       Exige um elemento no HTML (ex.: <div id="cl-recaptcha-container">)
       pra hospedar o reCAPTCHA (pode ser invisible, ver initRecaptcha). */
    /* ===================================================== */

    let recaptchaVerifier = null;
    let phoneConfirmationResult = null;

    /* Cria (uma vez) o RecaptchaVerifier ligado ao container informado.
       size "invisible" não mostra nenhum checkbox — só aparece um
       desafio visual se o Google desconfiar de comportamento de bot. */
    CL.auth.initRecaptcha = function (containerId) {
        if (recaptchaVerifier) {
            return recaptchaVerifier;
        }
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
            size: "invisible"
        });
        return recaptchaVerifier;
    };

    /* phoneNumber precisa estar em formato internacional E.164,
       ex.: "+5511912345678" (sem espaços/traços). */
    CL.auth.sendPhoneCode = async function (phoneNumber, recaptchaContainerId) {
        try {
            const verifier = CL.auth.initRecaptcha(recaptchaContainerId);
            phoneConfirmationResult = await CL.firebase.auth.signInWithPhoneNumber(phoneNumber, verifier);
            return true;
        } catch (error) {
            CL.auth._handleError("sendPhoneCode", error);

            /* reCAPTCHA já "gasto" numa tentativa falha precisa resetar,
               senão a próxima tentativa falha silenciosamente. */
            if (recaptchaVerifier) {
                try {
                    const widgetId = await recaptchaVerifier.render();
                    if (window.grecaptcha) {
                        window.grecaptcha.reset(widgetId);
                    }
                } catch (resetError) {
                    /* silencioso: melhor esforço, não crítico */
                }
            }

            return false;
        }
    };

    CL.auth.confirmPhoneCode = async function (code) {
        if (!phoneConfirmationResult) {
            if (CL.ui && typeof CL.ui.showToast === "function") {
                CL.ui.showToast("Solicite o código por SMS antes de confirmar.", "warning");
            }
            return false;
        }

        try {
            await phoneConfirmationResult.confirm(code);
            phoneConfirmationResult = null;
            return true;
        } catch (error) {
            CL.auth._handleError("confirmPhoneCode", error);
            return false;
        }
    };

    /* AUTH > LOGOUT */
    CL.auth.logout = async function () {
        try {
            await CL.firebase.auth.signOut();
        } catch (error) {
            if (CL.config.debug) {
                console.error("[CL.auth] falha ao sair:", error);
            }
        } finally {
            window.location.href = `${CL.config.landingUrl}?reason=logout`;
        }
    };

    /* AUTH > UPDATE USER — usado pela tela de Perfil/Configurações
       pra editar nome, etc. Grava no Firestore e atualiza o state. */
    CL.auth.updateUser = async function (data) {
        data = data || {};

        if (!CL.auth.isAuthenticated()) {
            return false;
        }

        CL.state.user = Object.assign({}, CL.state.user, data);

        try {
            await CL.firebase.db.collection("users").doc(CL.state.user.id).set(data, { merge: true });
        } catch (error) {
            if (CL.config.debug) {
                console.error("[CL.auth] falha ao atualizar usuário:", error);
            }
            return false;
        }

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
