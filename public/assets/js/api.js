/* =====================================================
   API.JS
   Camada de dados do aluno: progresso na trilha, código
   salvo na IDE e perfil do usuário.

   ARQUITETURA ATUAL (local-first): tudo isso vive no
   localStorage do navegador, sob a chave "study-index" por
   usuário (uid). O Firestore hoje só é usado para:
     - ler os comunicados públicos (listAnnouncements);
     - apagar o documento/subcoleções do usuário em
       deleteAllUserData (limpeza defensiva; hoje em geral
       não há nada lá pra apagar).
   Ou seja: não há sincronização entre dispositivos. Backup
   entre dispositivos é feito manualmente pelo aluno (ver
   fazerBackup/sincronizarNuvemAutomaticamente em ide.js).

   Os helpers _draft()/_saveDraft() abaixo NÃO são a fonte de
   dados atual — existem só para migrar, uma única vez, quem
   ainda tinha o formato de armazenamento anterior a este.

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
            return snapshot.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); });
        } catch (error) {
            /* Um aviso indisponível não pode impedir o aluno de estudar. */
            if (CL.config && CL.config.debug) console.warn("[CL.api] announcements:", error);
            return [];
        }
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
        if (typeof value !== "string" || !value.trim() || value.length > 200 || value.indexOf("/") !== -1 || ["__proto__", "constructor", "prototype"].includes(value)) {
            throw new Error(`CL.api: ${label || "id"} inválido.`);
        }
        return value;
    };

    /* ===================================================== */
    /* MIGRAÇÃO — formato antigo (rascunho pensado pra sync   */
    /* em lote com o Firestore, nunca ativado em produção).   */
    /* Usado só dentro de _studyIndex(), uma única vez, pra    */
    /* não perder dado de quem já tinha isso salvo no browser. */
    /* Não escreva código novo usando _draft()/_saveDraft().   */
    /* ===================================================== */

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

    /* ===================================================== */
    /* ARMAZENAMENTO LOCAL POR ETAPA — fonte de verdade atual */
    /* ===================================================== */
    /* O índice não contém código: ele é pequeno e basta para abrir a
       IDE rapidamente. Cada editor fica em uma chave independente e só
       é lido quando a respectiva etapa é acessada. */
    CL.api._studyKey = function () {
        return `${CL.config.storagePrefix}:study-index:${CL.api._uid()}`;
    };

    CL.api._exerciseKey = function (exerciseId, generation) {
        if (generation === undefined) {
            const index = JSON.parse(localStorage.getItem(CL.api._studyKey()) || "{}");
            generation = index.generation || "";
        }
        const base = `${CL.config.storagePrefix}:study-exercise:${CL.api._uid()}:`;
        return base + (generation ? "generation:" + generation + ":" : "") + encodeURIComponent(exerciseId);
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

    /* ===================================================== */
    /* PERFIL */
    /* ===================================================== */

    CL.api.getProfile = async function () {
        return CL.api._studyIndex().profile || {};
    };

    CL.api.saveProfile = async function (data) {
        const index = CL.api._studyIndex();
        index.profile = Object.assign({}, index.profile, data || {});
        CL.api._saveStudyIndex(index);
        return true;
    };

    /* ===================================================== */
    /* PROGRESSO — trilha de cursos/aulas */
    /* ===================================================== */

    /* progressId costuma ser algo como "html-basico:aula-01" */
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

    /* Lista todo o progresso do usuário logado, indexado por id,
       pronto pra CL.pages.dashboard/courses pintarem os cards. */
    CL.api.listProgress = async function () {
        return CL.api._studyIndex().progress || {};
    };

    /* Apaga o progresso de uma etapa (usado pelo IDE quando o aluno
       pede pra "refazer" uma etapa). */
    CL.api.deleteProgress = async function (progressId) {
        progressId = CL.api._documentId(progressId, "progressId");
        const index = CL.api._studyIndex();
        delete index.progress[progressId];
        CL.api._saveStudyIndex(index);
        return true;
    };

    /* Não há mais listener em tempo real (isso dependia do Firestore).
       Hoje é só uma leitura única do progresso atual — mantido só pra
       quem já espera essa assinatura; nenhum arquivo do projeto chama
       isso hoje. Se não for usar, considere remover. */
    CL.api.onProgressChange = function (callback) {
        try {
            if (typeof callback !== "function") {
                throw new Error("CL.api: callback de progresso inválido.");
            }
            callback(CL.api._studyIndex().progress);
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

    /* Apaga o código salvo de uma etapa (usado pelo IDE quando o aluno
       pede pra "refazer" uma etapa — volta a mostrar o codigoInicial). */
    CL.api.deleteExercise = async function (exerciseId) {
        exerciseId = CL.api._documentId(exerciseId, "exerciseId");
        localStorage.removeItem(CL.api._exerciseKey(exerciseId));
        const index = CL.api._studyIndex();
        delete index.savedExercises[exerciseId];
        CL.api._saveStudyIndex(index);
        return true;
    };

    /* ===================================================== */
    /* EXPORTAR / IMPORTAR / VALIDAR (usado pelo backup)      */
    /* ===================================================== */

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
        const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
        const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
        const string = (value, max) => typeof value === "string" && value.length <= max;
        const id = value => typeof value === "string" && value.trim().length > 0 && value.length <= 200 && !/[\/\u0000-\u001f]/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
        const date = value => value === undefined || (string(value, 40) && Number.isFinite(Date.parse(value)));
        try {
            if (!keys(data, ["format", "version", "exportedAt", "index", "exercises"]) || data.format !== "coding-loop-study" || data.version !== 1 || !date(data.exportedAt)) return false;
            if (new TextEncoder().encode(JSON.stringify(data)).length > CL.api.MAX_BACKUP_BYTES) return false;
            const index = data.index;
            if (!keys(index, ["version", "profile", "progress", "savedExercises", "updatedAt", "generation"]) || index.version !== 1 || !date(index.updatedAt)) return false;
            if (index.generation !== undefined && !string(index.generation, 100)) return false;
            if (!keys(index.profile, ["name", "email", "avatar", "provider", "bio", "profileAvatar", "idePosition"])) return false;
            if (!Object.entries(index.profile).every(([key, value]) => key === "idePosition"
                ? keys(value, ["moduloId", "etapa"]) && id(value.moduloId) && Number.isInteger(value.etapa) && value.etapa >= 0 && value.etapa <= 10000
                : string(value, ["avatar", "profileAvatar"].includes(key) ? 1024 * 1024 : 10000))) return false;
            if (!object(index.progress) || Object.keys(index.progress).length > 10000 || !Object.entries(index.progress).every(([key, value]) => id(key) && keys(value, ["concluida", "percentual"]) && typeof value.concluida === "boolean" && (value.percentual === undefined || value.percentual === null || (typeof value.percentual === "number" && Number.isFinite(value.percentual) && value.percentual >= 0 && value.percentual <= 100)))) return false;
            if (!object(index.savedExercises) || Object.keys(index.savedExercises).length > 1000 || !Object.entries(index.savedExercises).every(([key, value]) => id(key) && value === true)) return false;
            return object(data.exercises) && Object.keys(data.exercises).length <= 1000 && Object.entries(data.exercises).every(([key, code]) => id(key) && keys(code, ["html", "css", "js", "files"]) &&
                ["html", "css", "js"].every(part => code[part] === undefined || string(code[part], 1024 * 1024)) &&
                (code.files === undefined || (Array.isArray(code.files) && code.files.length <= 100 && code.files.every(file => keys(file, ["nome", "linguagem", "conteudo"]) && string(file.nome, 200) && string(file.linguagem, 80) && string(file.conteudo, 1024 * 1024)))));
        } catch (error) { return false; }
    };

    CL.api.MAX_BACKUP_BYTES = 8 * 1024 * 1024;

    CL.api.parseStudyBackup = function (text) {
        if (typeof text !== "string" || text.length > CL.api.MAX_BACKUP_BYTES || new TextEncoder().encode(text).length > CL.api.MAX_BACKUP_BYTES) throw new Error("Backup excede o limite de 8 MB.");
        const data = JSON.parse(text);
        if (!CL.api.validateStudyData(data)) throw new Error("Arquivo de progresso inválido.");
        return data;
    };

    CL.api.readStudyBackupResponse = async function (response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0, text = "";
        try {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                bytes += chunk.value.byteLength;
                if (bytes > CL.api.MAX_BACKUP_BYTES) throw new Error("Backup excede o limite de 8 MB.");
                text += decoder.decode(chunk.value, { stream: true });
            }
            return CL.api.parseStudyBackup(text + decoder.decode());
        } finally { await reader.cancel(); reader.releaseLock(); }
    };

    CL.api.importStudyData = function (data) {
        if (!CL.api.validateStudyData(data)) {
            throw new Error("Arquivo de progresso inválido.");
        }
        const current = CL.api._studyIndex();
        // Nova geração: a única troca visível é a escrita atômica do índice.
        // Falta de quota nunca exige apagar a única cópia para liberar espaço.
        const imported = JSON.parse(JSON.stringify(data.index));
        imported.generation = window.crypto.randomUUID();
        imported.savedExercises = {};
        const staged = [];
        try {
            Object.keys(data.exercises).forEach(function (id) {
                const code = data.exercises[id];
                const key = CL.api._exerciseKey(id, imported.generation);
                localStorage.setItem(key, JSON.stringify({ html: code.html || "", css: code.css || "", js: code.js || "", files: code.files || [] }));
                staged.push(key);
                imported.savedExercises[id] = true;
            });
            CL.api._saveStudyIndex(imported);
        } catch (error) {
            staged.forEach(function (key) { localStorage.removeItem(key); });
            throw new Error("Não foi possível restaurar. Seus dados anteriores foram preservados. Verifique o espaço disponível.");
        }
        Object.keys(current.savedExercises || {}).forEach(function (id) {
            try { localStorage.removeItem(CL.api._exerciseKey(id, current.generation || "")); } catch (error) { /* limpeza posterior não invalida o commit */ }
        });
        return true;
    };

    /* ===================================================== */
    /* BACKUP (computador / local / Google Drive / OneDrive)  */
    /* Configurações e backup local ficam aqui; o envio para  */
    /* nuvem (interativo/automático) está em ide.js.          */
    /* ===================================================== */

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
            settings.destinations = settings.destinations.filter(function (value) { return ["computer", "local", "device", "drive", "onedrive"].includes(value); });
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

    /* ===================================================== */
    /* CONTA */
    /* ===================================================== */

    /* Exclusão definitiva dos dados que o Coding Loop controla. O browser
       não tem permissão para apagar arquivos já baixados pelo usuário nem
       arquivos em provedores de nuvem externos sem uma autorização própria.
       A limpeza no Firestore (progress/exercises/documento do usuário) é
       defensiva: no modelo atual (local-first) normalmente não há nada
       para apagar lá, mas mantemos a limpeza caso já tenha existido. */
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

        CL.api.clearLocalUserData(uid);
        return true;
    };

    CL.api.clearLocalUserData = function (uid) {
        const kinds = ["firebase-draft", "study-index", "study-exercise", "study-backup-settings", "study-backup", "study-backup-versions"];
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && kinds.some(function (kind) {
                const base = CL.config.storagePrefix + ":" + kind + ":" + uid;
                return key === base || (kind === "study-exercise" && key.startsWith(base + ":"));
            })) keys.push(key);
        }
        keys.forEach(function (key) { localStorage.removeItem(key); });
        return true;
    };

    /* Chamado por auth.js antes do logout. Não existe mais sincronização
       remota nesta fase (localStorage é a fonte de verdade) — a função
       fica como um "gancho" estável pra não quebrar o fluxo de logout
       caso uma sincronização remota volte a existir no futuro. */
    CL.api.syncLocalData = async function () {
        return true;
    };

})();
