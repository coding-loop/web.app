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
    let lastErrorToast = { message: "", at: 0 };

    CL.api = {};

    /* Comunicados são públicos apenas depois de publicados. A escrita é
       reservada às contas com a custom claim `admin` nas regras do Firestore. */
    CL.api.listAnnouncements = async function () {
        try {
            if (!CL.firebase || !CL.firebase.db) return [];
            const snapshot = await CL.firebase.db.collection("announcements")
                .where("status", "==", "published")
                .orderBy("publishedAt", "desc").limit(8).get();
            return snapshot.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });
        } catch (error) {
            /* Um aviso indisponível não pode impedir o aluno de estudar. */
            if (CL.config && CL.config.debug) console.warn("[CL.api] announcements:", error);
            return [];
        }
    };

    /* Rascunho local por usuário. O estudo não gera escrita no Firestore;
       o conteúdo é enviado em lote antes do logout. */
    CL.api._draftKey = function () {
        return `${CL.config.storagePrefix}:firebase-draft:${CL.api._uid()}`;
    };

    CL.api._draft = function () {
        const empty = { profile: {}, progress: {}, exercises: {}, deletedProgress: [], deletedExercises: [] };
        try {
            return Object.assign(empty, JSON.parse(localStorage.getItem(CL.api._draftKey())) || {});
        } catch (error) {
            return empty;
        }
    };

    CL.api._saveDraft = function (draft) {
        localStorage.setItem(CL.api._draftKey(), JSON.stringify(draft));
    };

    /* Sobe um erro amigável (toast, se existir) e sempre relança,
       pra quem chamou decidir o que fazer (ex.: manter um "salvando..."
       preso ou não). */
    CL.api._handleError = function (context, error, operation) {
        if (CL.config.debug) {
            console.error(`[CL.api] ${context}:`, error);
        }
        if (CL.ui && typeof CL.ui.showToast === "function") {
            const message = operation === "read"
                ? "Não foi possível carregar seus dados. Verifique sua conexão."
                : "Não foi possível salvar. Verifique sua conexão.";
            const now = Date.now();
            // O boot da IDE faz três leituras em paralelo. Em uma queda de
            // conexão, uma única mensagem é suficiente para não poluir a UI.
            if (lastErrorToast.message !== message || now - lastErrorToast.at > 3000) {
                CL.ui.showToast(message, "danger");
                lastErrorToast = { message: message, at: now };
            }
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

    /* IDs de documentos não podem ser vazios nem conter "/". As chaves
       atuais usam "moduloId:etapa", que é um ID válido no Firestore. */
    CL.api._documentId = function (value, label) {
        if (typeof value !== "string" || !value.trim() || value.indexOf("/") !== -1) {
            throw new Error(`CL.api: ${label || "id"} inválido.`);
        }
        return value;
    };

    /* ===================================================== */
    /* PERFIL */
    /* ===================================================== */

    CL.api.getProfile = async function (uid) {
        try {
            const currentUid = CL.api._uid();
            if (uid && uid !== currentUid) {
                throw new Error("CL.api: só é permitido ler o próprio perfil.");
            }
            return CL.api._draft().profile || null;
        } catch (error) {
            CL.api._handleError("getProfile", error, "read");
        }
    };

    CL.api.saveProfile = async function (data) {
        const draft = CL.api._draft();
        draft.profile = Object.assign({}, draft.profile, data || {});
        CL.api._saveDraft(draft);
        return true;
    };

    /* ===================================================== */
    /* PROGRESSO — trilha de cursos/aulas */
    /* ===================================================== */

    /* progressId costuma ser algo como "html-basico:aula-01" */
    CL.api.saveProgress = async function (progressId, data) {
        try {
            progressId = CL.api._documentId(progressId, "progressId");
            const draft = CL.api._draft();
            draft.progress[progressId] = Object.assign({}, draft.progress[progressId], data || {});
            draft.deletedProgress = draft.deletedProgress.filter(function (id) { return id !== progressId; });
            CL.api._saveDraft(draft);
            return true;
        } catch (error) {
            CL.api._handleError("saveProgress", error, "write");
        }
    };

    CL.api.getProgress = async function (progressId) {
        try {
            progressId = CL.api._documentId(progressId, "progressId");
            return CL.api._draft().progress[progressId] || null;
        } catch (error) {
            CL.api._handleError("getProgress", error, "read");
        }
    };

    /* Lista todo o progresso do usuário logado, indexado por id,
       pronto pra CL.pages.dashboard/courses pintarem os cards. */
    CL.api.listProgress = async function () {
        try {
            return CL.api._draft().progress;
        } catch (error) {
            CL.api._handleError("listProgress", error, "read");
        }
    };

    /* Apaga o progresso de uma etapa (usado pelo IDE quando o aluno
       pede pra "refazer" uma etapa). */
    CL.api.deleteProgress = async function (progressId) {
        try {
            progressId = CL.api._documentId(progressId, "progressId");
            const draft = CL.api._draft();
            delete draft.progress[progressId];
            if (!draft.deletedProgress.includes(progressId)) draft.deletedProgress.push(progressId);
            CL.api._saveDraft(draft);
            return true;
        } catch (error) {
            CL.api._handleError("deleteProgress", error, "write");
        }
    };

    /* Escuta mudanças de progresso em tempo real (útil se o aluno
       tiver o dashboard aberto em duas abas/dispositivos). Retorna a
       função de "unsubscribe" — chame quando sair da página/rota. */
    CL.api.onProgressChange = function (callback) {
        try {
            if (typeof callback !== "function") {
                throw new Error("CL.api: callback de progresso inválido.");
            }
            callback(CL.api._draft().progress);
            // Sem listener do Firestore: o modo local-first sincroniza ao sair.
            return function () {};
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
            exerciseId = CL.api._documentId(exerciseId, "exerciseId");
            code = code || {};
            const draft = CL.api._draft();
            draft.exercises[exerciseId] = {
                html: code.html || "",
                css: code.css || "",
                js: code.js || "",
                files: Array.isArray(code.files) ? code.files : []
            };
            draft.deletedExercises = draft.deletedExercises.filter(function (id) { return id !== exerciseId; });
            CL.api._saveDraft(draft);
            return true;
        } catch (error) {
            CL.api._handleError("saveExercise", error, "write");
        }
    };

    CL.api.getExercise = async function (exerciseId) {
        try {
            exerciseId = CL.api._documentId(exerciseId, "exerciseId");
            return CL.api._draft().exercises[exerciseId] || { html: "", css: "", js: "" };
        } catch (error) {
            CL.api._handleError("getExercise", error, "read");
        }
    };

    /* Apaga o código salvo de uma etapa (usado pelo IDE quando o aluno
       pede pra "refazer" uma etapa — volta a mostrar o codigoInicial). */
    CL.api.deleteExercise = async function (exerciseId) {
        try {
            exerciseId = CL.api._documentId(exerciseId, "exerciseId");
            const draft = CL.api._draft();
            delete draft.exercises[exerciseId];
            if (!draft.deletedExercises.includes(exerciseId)) draft.deletedExercises.push(exerciseId);
            CL.api._saveDraft(draft);
            return true;
        } catch (error) {
            CL.api._handleError("deleteExercise", error, "write");
        }
    };

    CL.api.listExercises = async function () {
        try {
            return CL.api._draft().exercises;
        } catch (error) {
            CL.api._handleError("listExercises", error, "read");
        }
    };

    /* ===================================================== */
    /* ARMAZENAMENTO LOCAL POR ETAPA                         */
    /* ===================================================== */
    /* O índice não contém código: ele é pequeno e basta para abrir a
       IDE rapidamente. Cada editor fica em uma chave independente e só
       é lido quando a respectiva etapa é acessada. */
    CL.api._studyKey = function () {
        return `${CL.config.storagePrefix}:study-index:${CL.api._uid()}`;
    };

    CL.api._exerciseKey = function (exerciseId) {
        return `${CL.config.storagePrefix}:study-exercise:${CL.api._uid()}:${encodeURIComponent(exerciseId)}`;
    };

    CL.api._studyIndex = function () {
        const empty = { version: 1, profile: {}, progress: {}, savedExercises: {} };
        try {
            const raw = localStorage.getItem(CL.api._studyKey());
            if (raw !== null) return Object.assign(empty, JSON.parse(raw) || {});

            /* Migra uma única vez o rascunho do formato anterior, sem
               perder códigos já existentes no navegador do aluno. */
            const legacy = CL.api._draft();
            empty.profile = legacy.profile || {};
            empty.progress = legacy.progress || {};
            Object.keys(legacy.exercises || {}).forEach(function (id) {
                localStorage.setItem(CL.api._exerciseKey(id), JSON.stringify(legacy.exercises[id]));
                empty.savedExercises[id] = true;
            });
            CL.api._saveStudyIndex(empty);
            return empty;
        } catch (error) {
            return empty;
        }
    };

    CL.api._saveStudyIndex = function (index) {
        index.updatedAt = new Date().toISOString();
        localStorage.setItem(CL.api._studyKey(), JSON.stringify(index));
    };

    CL.api.getExerciseLocal = function (exerciseId) {
        try {
            exerciseId = CL.api._documentId(exerciseId, "exerciseId");
            return JSON.parse(localStorage.getItem(CL.api._exerciseKey(exerciseId))) || null;
        } catch (error) {
            return null;
        }
    };

    CL.api.getProfile = async function () {
        return CL.api._studyIndex().profile || {};
    };

    CL.api.saveProfile = async function (data) {
        const index = CL.api._studyIndex();
        index.profile = Object.assign({}, index.profile, data || {});
        CL.api._saveStudyIndex(index);
        return true;
    };

    CL.api.exportStudyData = function () {
        const index = CL.api._studyIndex();
        const exercises = {};
        Object.keys(index.savedExercises || {}).forEach(function (id) {
            const code = CL.api.getExerciseLocal(id);
            if (code) exercises[id] = code;
        });
        return { format: "coding-loop-study", version: 1, exportedAt: new Date().toISOString(), index: index, exercises: exercises };
    };

    CL.api.validateStudyData = function (data) {
        if (!data || data.format !== "coding-loop-study" || data.version !== 1 || !data.index || typeof data.index !== "object" || !data.exercises || typeof data.exercises !== "object") return false;
        const ids = Object.keys(data.exercises);
        if (ids.length > 1000) return false;
        return ids.every(function (id) {
            const code = data.exercises[id];
            return typeof id === "string" && id.length <= 200 && code && typeof code === "object" &&
                ["html", "css", "js"].every(function (part) { return typeof (code[part] || "") === "string" && (code[part] || "").length <= 1024 * 1024; });
        });
    };

    CL.api.importStudyData = function (data) {
        if (!CL.api.validateStudyData(data)) {
            throw new Error("Arquivo de progresso inválido.");
        }
        const current = CL.api._studyIndex();
        Object.keys(current.savedExercises || {}).forEach(function (id) {
            localStorage.removeItem(CL.api._exerciseKey(id));
        });
        const imported = Object.assign({ version: 1, profile: {}, progress: {}, savedExercises: {} }, data.index);
        imported.savedExercises = {};
        Object.keys(data.exercises || {}).forEach(function (id) {
            const code = data.exercises[id];
            if (!code || typeof code !== "object") return;
            localStorage.setItem(CL.api._exerciseKey(id), JSON.stringify({ html: code.html || "", css: code.css || "", js: code.js || "" }));
            imported.savedExercises[id] = true;
        });
        CL.api._saveStudyIndex(imported);
        return true;
    };

    CL.api._backupSettingsKey = function () { return `${CL.config.storagePrefix}:study-backup-settings:${CL.api._uid()}`; };
    CL.api._backupKey = function () { return `${CL.config.storagePrefix}:study-backup:${CL.api._uid()}`; };
    CL.api._backupVersionsKey = function () { return `${CL.config.storagePrefix}:study-backup-versions:${CL.api._uid()}`; };
    CL.api.getBackupSettings = function () {
        const defaults = { destinations: ["computer", "local", "drive"], googleDriveScopeVersion: 2, schedule: "exit", mode: "incremental", retentionCount: 1, defaultsVersion: 3, configurationCompleted: false, lastBackupAt: null, lastBackupDestinations: [] };
        try {
            const stored = JSON.parse(localStorage.getItem(CL.api._backupSettingsKey())) || {};
            const settings = Object.assign(defaults, stored);
            if (stored.defaultsVersion !== 3) {
                if (!stored.defaultsVersion || stored.defaultsVersion < 2) settings.mode = "incremental";
                settings.retentionCount = 1;
                settings.defaultsVersion = 3;
                localStorage.setItem(CL.api._backupSettingsKey(), JSON.stringify(settings));
            }
            if (!Array.isArray(settings.destinations)) settings.destinations = settings.destination ? [settings.destination] : defaults.destinations.slice();
            if (!settings.destinations.includes("local")) settings.destinations.push("local");
            if (settings.googleDriveScopeVersion !== 2) {
                settings.googleDriveConnected = false;
                settings.googleDriveScopeVersion = 2;
                localStorage.setItem(CL.api._backupSettingsKey(), JSON.stringify(settings));
            }
            if (!["exit", "weekly", "monthly"].includes(settings.schedule)) settings.schedule = "exit";
            return settings;
        } catch (error) { return defaults; }
    };
    CL.api.saveBackupSettings = function (settings) {
        const next = Object.assign(CL.api.getBackupSettings(), settings || {});
        localStorage.setItem(CL.api._backupSettingsKey(), JSON.stringify(next));
        return next;
    };
    CL.api.saveLocalBackup = function () {
        const settings = CL.api.getBackupSettings();
        const next = CL.api.exportStudyData();
        if (settings.mode === "incremental") {
            try {
                const previous = JSON.parse(localStorage.getItem(CL.api._backupKey()));
                if (previous && previous.exercises) {
                    Object.keys(next.exercises).forEach(function (id) {
                        if (JSON.stringify(next.exercises[id]) === JSON.stringify(previous.exercises[id])) next.exercises[id] = previous.exercises[id];
                    });
                }
            } catch (error) {}
        }
        localStorage.setItem(CL.api._backupKey(), JSON.stringify(next));
        try {
            const versions = JSON.parse(localStorage.getItem(CL.api._backupVersionsKey())) || [];
            versions.unshift(next);
            versions.splice(Math.max(1, Number(settings.retentionCount) || 3));
            localStorage.setItem(CL.api._backupVersionsKey(), JSON.stringify(versions));
        } catch (error) {}
        CL.api.saveBackupSettings({ lastBackupAt: next.exportedAt });
        return next;
    };
    CL.api.getLocalBackup = function () {
        try { return JSON.parse(localStorage.getItem(CL.api._backupKey())); } catch (error) { return null; }
    };
    CL.api.getLocalBackupVersions = function () {
        try { return JSON.parse(localStorage.getItem(CL.api._backupVersionsKey())) || []; } catch (error) { return []; }
    };

    /* Exclusão definitiva dos dados que o Coding Loop controla. O browser
       não tem permissão para apagar arquivos já baixados pelo usuário nem
       arquivos em provedores de nuvem externos sem uma autorização própria. */
    CL.api.deleteAllUserData = async function () {
        const uid = CL.api._uid();
        const userRef = CL.firebase.db.collection("users").doc(uid);

        /* Firestore não remove subcoleções ao apagar o documento-pai. */
        for (const collectionName of ["progress", "exercises"]) {
            let snapshot;
            do {
                snapshot = await userRef.collection(collectionName).limit(400).get();
                if (!snapshot.empty) {
                    const batch = CL.firebase.db.batch();
                    snapshot.docs.forEach(function (doc) { batch.delete(doc.ref); });
                    await batch.commit();
                }
            } while (!snapshot.empty);
        }
        await userRef.delete();

        const userKeyPart = ":" + uid;
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && key.indexOf(CL.config.storagePrefix + ":") === 0 && key.indexOf(userKeyPart) !== -1) keys.push(key);
        }
        keys.forEach(function (key) { localStorage.removeItem(key); });
        return true;
    };

    CL.api.saveProgress = async function (progressId, data) {
        progressId = CL.api._documentId(progressId, "progressId");
        const index = CL.api._studyIndex();
        index.progress[progressId] = Object.assign({}, index.progress[progressId], data || {});
        CL.api._saveStudyIndex(index);
        return true;
    };

    CL.api.getProgress = async function (progressId) {
        return CL.api._studyIndex().progress[CL.api._documentId(progressId, "progressId")] || null;
    };

    CL.api.listProgress = async function () {
        return CL.api._studyIndex().progress || {};
    };

    CL.api.deleteProgress = async function (progressId) {
        progressId = CL.api._documentId(progressId, "progressId");
        const index = CL.api._studyIndex();
        delete index.progress[progressId];
        CL.api._saveStudyIndex(index);
        return true;
    };

    CL.api.saveExercise = async function (exerciseId, code) {
        exerciseId = CL.api._documentId(exerciseId, "exerciseId");
        code = code || {};
        localStorage.setItem(CL.api._exerciseKey(exerciseId), JSON.stringify({
            html: code.html || "",
            css: code.css || "",
            js: code.js || "",
            files: Array.isArray(code.files) ? code.files : []
        }));
        const index = CL.api._studyIndex();
        index.savedExercises[exerciseId] = true;
        CL.api._saveStudyIndex(index);
        return true;
    };

    CL.api.getExercise = async function (exerciseId) {
        return CL.api.getExerciseLocal(exerciseId) || { html: "", css: "", js: "" };
    };

    CL.api.listExercises = async function () {
        /* Retorna apenas o índice das etapas com código; nunca todos os textos. */
        return CL.api._studyIndex().savedExercises || {};
    };

    CL.api.deleteExercise = async function (exerciseId) {
        exerciseId = CL.api._documentId(exerciseId, "exerciseId");
        localStorage.removeItem(CL.api._exerciseKey(exerciseId));
        const index = CL.api._studyIndex();
        delete index.savedExercises[exerciseId];
        CL.api._saveStudyIndex(index);
        return true;
    };

    /* Nesta fase o localStorage é a fonte de verdade; manter esta função
       evita quebrar o logout enquanto a sincronização remota fica desativada. */
    CL.api.syncLocalData = async function () {
        return true;
    };

    /* Implementação remota anterior, mantida abaixo temporariamente para
       referência durante a futura sincronização com o Firestore. */
    CL.api._syncFirestoreLegacy = async function () {
        const uid = CL.api._uid();
        const draft = CL.api._draft();
        const userRef = CL.firebase.db.collection("users").doc(uid);
        const operations = [];

        operations.push(function (batch) {
            batch.set(userRef, Object.assign({}, draft.profile, {
                lastSyncedAt: CL.firebase.FieldValue.serverTimestamp()
            }), { merge: true });
        });
        Object.keys(draft.progress).forEach(function (id) {
            operations.push(function (batch) {
                batch.set(userRef.collection("progress").doc(id), Object.assign({}, draft.progress[id], {
                    updatedAt: CL.firebase.FieldValue.serverTimestamp()
                }), { merge: true });
            });
        });
        Object.keys(draft.exercises).forEach(function (id) {
            operations.push(function (batch) {
                batch.set(userRef.collection("exercises").doc(id), Object.assign({}, draft.exercises[id], {
                    updatedAt: CL.firebase.FieldValue.serverTimestamp()
                }), { merge: true });
            });
        });
        draft.deletedProgress.forEach(function (id) {
            operations.push(function (batch) { batch.delete(userRef.collection("progress").doc(id)); });
        });
        draft.deletedExercises.forEach(function (id) {
            operations.push(function (batch) { batch.delete(userRef.collection("exercises").doc(id)); });
        });

        for (let start = 0; start < operations.length; start += 500) {
            const batch = CL.firebase.db.batch();
            operations.slice(start, start + 500).forEach(function (apply) { apply(batch); });
            await batch.commit();
        }
        draft.deletedProgress = [];
        draft.deletedExercises = [];
        CL.api._saveDraft(draft);
        return true;
    };

})();
