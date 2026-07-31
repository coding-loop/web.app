/* =====================================================
   API.JS
   Comunicação com o Firestore: salvar/ler progresso do
   aluno, código salvo na IDE e perfil do usuário.
   Substitui o antigo CL.api (wrapper de REST genérico, que
   nunca chegou a ser usado por não haver backend).

   Modelo de dados:
     users/{uid}                        -> perfil (nome, email, avatar...)
     users/{uid}/progress/{lessonId}     -> progresso de uma aula/exercício
     users/{uid}/exercises/{exerciseId}  -> código salvo na IDE (html/css/js)

   Depende de: firebase-init.js, auth.js
   ===================================================== */
(function () {
    "use strict";

    window.CL = window.CL || {};
    const CL = window.CL;

    CL.api = {};

    /* Sobe um erro amigável (toast, se existir) e sempre relança,
       pra quem chamou decidir o que fazer (ex.: manter um "salvando..."
       preso ou não). */
    CL.api._handleError = function (context, error) {
        if (CL.config.debug) {
            console.error(`[CL.api] ${context}:`, error);
        }
        if (CL.ui && typeof CL.ui.showToast === "function") {
            CL.ui.showToast("Não foi possível salvar. Verifique sua conexão.", "danger");
        }
        throw error;
    };

    CL.api._uid = function () {
        const user = CL.auth.getUser();
        if (!user) {
            throw new Error("CL.api: nenhum usuário autenticado.");
        }
        return user.id;
    };

    /* ===================================================== */
    /* PERFIL */
    /* ===================================================== */

    CL.api.getProfile = async function (uid) {
        try {
            const snap = await CL.firebase.db.collection("users").doc(uid || CL.api._uid()).get();
            return snap.exists ? snap.data() : null;
        } catch (error) {
            CL.api._handleError("getProfile", error);
        }
    };

    /* ===================================================== */
    /* PROGRESSO — trilha de cursos/aulas */
    /* ===================================================== */

    /* progressId costuma ser algo como "html-basico:aula-01" */
    CL.api.saveProgress = async function (progressId, data) {
        try {
            const ref = CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("progress").doc(progressId);

            await ref.set(Object.assign({}, data, {
                updatedAt: CL.firebase.FieldValue.serverTimestamp()
            }), { merge: true });

            return true;
        } catch (error) {
            CL.api._handleError("saveProgress", error);
        }
    };

    CL.api.getProgress = async function (progressId) {
        try {
            const snap = await CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("progress").doc(progressId).get();

            return snap.exists ? snap.data() : null;
        } catch (error) {
            CL.api._handleError("getProgress", error);
        }
    };

    /* Lista todo o progresso do usuário logado, indexado por id,
       pronto pra CL.pages.dashboard/courses pintarem os cards. */
    CL.api.listProgress = async function () {
        try {
            const snap = await CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("progress").get();

            const result = {};
            snap.forEach(function (doc) {
                result[doc.id] = doc.data();
            });
            return result;
        } catch (error) {
            CL.api._handleError("listProgress", error);
        }
    };

    /* Apaga o progresso de uma etapa (usado pelo IDE quando o aluno
       pede pra "refazer" uma etapa). */
    CL.api.deleteProgress = async function (progressId) {
        try {
            await CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("progress").doc(progressId).delete();

            return true;
        } catch (error) {
            CL.api._handleError("deleteProgress", error);
        }
    };

    /* Escuta mudanças de progresso em tempo real (útil se o aluno
       tiver o dashboard aberto em duas abas/dispositivos). Retorna a
       função de "unsubscribe" — chame quando sair da página/rota. */
    CL.api.onProgressChange = function (callback) {
        try {
            return CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("progress")
                .onSnapshot(function (snap) {
                    const result = {};
                    snap.forEach(function (doc) {
                        result[doc.id] = doc.data();
                    });
                    callback(result);
                }, function (error) {
                    if (CL.config.debug) {
                        console.error("[CL.api] onProgressChange:", error);
                    }
                });
        } catch (error) {
            if (CL.config.debug) {
                console.error("[CL.api] onProgressChange (setup):", error);
            }
            return function () {};
        }
    };

    /* ===================================================== */
    /* EXERCÍCIOS — código salvo pelo aluno na IDE */
    /* ===================================================== */

    CL.api.saveExercise = async function (exerciseId, code) {
        try {
            const ref = CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("exercises").doc(exerciseId);

            await ref.set({
                html: code.html || "",
                css: code.css || "",
                js: code.js || "",
                updatedAt: CL.firebase.FieldValue.serverTimestamp()
            }, { merge: true });

            return true;
        } catch (error) {
            CL.api._handleError("saveExercise", error);
        }
    };

    CL.api.getExercise = async function (exerciseId) {
        try {
            const snap = await CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("exercises").doc(exerciseId).get();

            return snap.exists ? snap.data() : { html: "", css: "", js: "" };
        } catch (error) {
            CL.api._handleError("getExercise", error);
        }
    };

    /* Apaga o código salvo de uma etapa (usado pelo IDE quando o aluno
       pede pra "refazer" uma etapa — volta a mostrar o codigoInicial). */
    CL.api.deleteExercise = async function (exerciseId) {
        try {
            await CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("exercises").doc(exerciseId).delete();

            return true;
        } catch (error) {
            CL.api._handleError("deleteExercise", error);
        }
    };

    CL.api.listExercises = async function () {
        try {
            const snap = await CL.firebase.db
                .collection("users").doc(CL.api._uid())
                .collection("exercises").get();

            const result = {};
            snap.forEach(function (doc) {
                result[doc.id] = doc.data();
            });
            return result;
        } catch (error) {
            CL.api._handleError("listExercises", error);
        }
    };

})();
