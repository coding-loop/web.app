/* =====================================================
   APP.JS
   Arquivo principal: config, state, utils, dom, ui,
   components, events, services e o boot que amarra tudo.
   Carrega por último, depois de firebase-init.js, auth.js,
   api.js e router.js.
   ===================================================== */
(function () {
    "use strict";

    window.CL = window.CL || {};
    const CL = window.CL;

/* =====================================================
   CONFIG
   ===================================================== */

CL.config = Object.freeze({
    appName: "Coding Loop",
    version: "2.0.0",
    debug: false,
    defaultTheme: "solarized-dark",
    defaultLanguage: "pt-BR",
    languages: ["pt-BR", "en-US", "es-ES"],
    storagePrefix: "cl",
    routeDefault: "dashboard",
    animationDuration: 300,
    toastDuration: 3000,

    /* Tempo (ms) que o header fica visível antes de sumir sozinho
       automaticamente (ver CL.boot.scheduleAutoHideNav). O aside
       (#cl-sidebar) não é afetado — permanece sempre visível,
       independente deste timer. */
    navAutoHideDelay: 5000,

    /* URL da Landing (página pública, sem login). auth.js redireciona
       pra cá quando não há sessão válida ou após logout.
       Path RELATIVO (sem "/" no início) de propósito: assim funciona
       tanto se o site for servido na raiz do GitHub Pages
       (usuario.github.io) quanto em sub-path (usuario.github.io/repo),
       já que index.html/dashboard.html/ide.html sempre ficam juntos,
       na mesma pasta. */
    landingUrl: "index.html",

    /* true nas páginas que exigem sessão (dashboard, IDE). Definido
       ANTES de carregar app.js, num <script> inline de cada página
       (ver index.html / dashboard.html / ide.html). */
    protectedPage: (typeof window.CL_PROTECTED_PAGE !== "undefined") ? window.CL_PROTECTED_PAGE : false
});

/* =====================================================
   STATE — Fonte única de verdade (Single Source of Truth)

   Regras de posse do estado

   CL.router      -> currentRoute, previousRoute
   CL.auth        -> authenticated, user
   CL.ui          -> navHidden, theme, toasts
   CL.components  -> loading, modalOpen, activeModal
   CL.boot        -> initialized

   Nenhum outro módulo deve alterar CL.state diretamente.
   Toda alteração deve ocorrer exclusivamente pelo módulo responsável.
   ===================================================== */

CL.state = {
    initialized: false,
    user: null,
    authenticated: false,
    currentRoute: null,
    previousRoute: null,
    theme: CL.config.defaultTheme,
    language: CL.config.defaultLanguage,
    loading: false,
    navHidden: false,
    modalOpen: false,
    activeModal: null,
    toasts: [],
    cache: {}
};

                    CL.utils = {};

                    /* UTILS > UUID */
                    CL.utils.uuid = function () {

                        if (window.crypto && window.crypto.randomUUID) {
                            return `cl-${crypto.randomUUID()}`;
                        }

                        return "cl-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                            const r = Math.random() * 16 | 0;
                            const v = c === "x" ? r : (r & 0x3 | 0x8);
                            return v.toString(16);
                        });

                    };

                    /* UTILS > DEBOUNCE */
                    CL.utils.debounce = function (callback, delay = 300) {

                        let timer = null;

                        return function (...args) {
                            clearTimeout(timer);
                            timer = setTimeout(() => {
                                callback.apply(this, args);
                            }, delay);
                        };

                    };

                    /* UTILS > FORMAT DATE */
                    CL.utils.formatDate = function (date = new Date(), locale = CL.state.language) {

                        if (!(date instanceof Date)) {
                            date = new Date(date);
                        }

                        if (isNaN(date.getTime())) {
                            return "";
                        }

                        return new Intl.DateTimeFormat(locale, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric"
                        }).format(date);

                    };

                    /* UTILS > COPY */
                    CL.utils.copy = async function (text) {

                        try {

                            await navigator.clipboard.writeText(String(text));
                            return true;

                        } catch {

                            const textarea = document.createElement("textarea");

                            textarea.value = String(text);
                            textarea.style.position = "fixed";
                            textarea.style.opacity = "0";

                            document.body.appendChild(textarea);
                            textarea.focus();
                            textarea.select();

                            let success = false;

                            try {
                                success = document.execCommand("copy");
                            } finally {
                                document.body.removeChild(textarea);
                            }

                            return success;

                        }

                    };

                    /* UTILS > RANDOM */
                    CL.utils.random = function (min = 0, max = 1, decimals = 0) {

                        min = Number(min);
                        max = Number(max);
                        decimals = Number(decimals);

                        if (!Number.isFinite(min) || !Number.isFinite(max)) {
                            return 0;
                        }

                        if (min > max) {
                            [min, max] = [max, min];
                        }

                        const value = Math.random() * (max - min) + min;

                        return Number(value.toFixed(Math.max(0, decimals)));

                    };

                    /* ===================================================== */
                    /* DOM — módulo genérico de manipulação do DOM.           */
                    /* Nenhum outro módulo deve chamar document.* diretamente. */
                    /* ===================================================== */

                    CL.dom = {};

                    /* DOM > QUERY SELECTOR */
                    CL.dom.$ = function (selector, context = document) {
                        return context.querySelector(selector);
                    };

                    /* DOM > QUERY SELECTOR ALL */
                    CL.dom.$$ = function (selector, context = document) {
                        return [...context.querySelectorAll(selector)];
                    };

                    /* DOM > CREATE */
                    CL.dom.create = function (tag, options = {}) {

                        const element = document.createElement(tag);

                        const {
                            id,
                            className,
                            text,
                            html,
                            attrs,
                            dataset,
                            style
                        } = options;

                        if (id) {
                            element.id = id;
                        }

                        if (className) {
                            element.className = className;
                        }

                        if (text !== undefined) {
                            element.textContent = text;
                        }

                        if (html !== undefined) {
                            element.innerHTML = html;
                        }

                        if (attrs) {
                            Object.entries(attrs).forEach(([key, value]) => {
                                element.setAttribute(key, value);
                            });
                        }

                        if (dataset) {
                            Object.entries(dataset).forEach(([key, value]) => {
                                element.dataset[key] = value;
                            });
                        }

                        if (style) {
                            Object.assign(element.style, style);
                        }

                        return element;

                    };

                    /* DOM > ON */
                    CL.dom.on = function (target, event, handler, options = false) {

                        if (!target || typeof handler !== "function") {
                            return;
                        }

                        target.addEventListener(event, handler, options);

                    };

                    /* DOM > OFF */
                    CL.dom.off = function (target, event, handler, options = false) {

                        if (!target || typeof handler !== "function") {
                            return;
                        }

                        target.removeEventListener(event, handler, options);

                    };

                    /* DOM > ONCE */
                    CL.dom.once = function (target, event, handler, options = {}) {

                        if (!target || typeof handler !== "function") {
                            return;
                        }

                        target.addEventListener(event, handler, {
                            ...options,
                            once: true
                        });

                    };

                    /* DOM > REMOVE */
                    CL.dom.remove = function (target) {

                        if (!target) {
                            return;
                        }

                        if (Array.isArray(target)) {
                            target.forEach(element => element && element.remove());
                            return;
                        }

                        if (target instanceof NodeList) {
                            target.forEach(element => element.remove());
                            return;
                        }

                        target.remove();

                    };

                    /* DOM > EMPTY */
                    CL.dom.empty = function (target) {

                        if (!target) {
                            return;
                        }

                        while (target.firstChild) {
                            target.removeChild(target.firstChild);
                        }

                    };

                    /* DOM > SHOW */
                    CL.dom.show = function (target, display = "") {

                        if (!target) {
                            return;
                        }

                        target.hidden = false;
                        target.style.display = display;

                    };

                    /* DOM > HIDE */
                    CL.dom.hide = function (target) {

                        if (!target) {
                            return;
                        }

                        target.hidden = true;
                        target.style.display = "none";

                    };

                    /* DOM > TOGGLE */
                    CL.dom.toggle = function (target, display = "") {

                        if (!target) {
                            return;
                        }

                        if (target.hidden || target.style.display === "none") {
                            CL.dom.show(target, display);
                        } else {
                            CL.dom.hide(target);
                        }

                    };

                    /* DOM > ADD CLASS */
                    CL.dom.addClass = function (target, ...classes) {

                        if (!target || !classes.length) {
                            return;
                        }

                        target.classList.add(...classes);

                    };

                    /* DOM > REMOVE CLASS */
                    CL.dom.removeClass = function (target, ...classes) {

                        if (!target || !classes.length) {
                            return;
                        }

                        target.classList.remove(...classes);

                    };

                    /* DOM > TOGGLE CLASS */
                    CL.dom.toggleClass = function (target, className, force) {

                        if (!target || !className) {
                            return false;
                        }

                        return target.classList.toggle(className, force);

                    };

                    /* DOM > HAS CLASS */
                    CL.dom.hasClass = function (target, className) {

                        if (!target || !className) {
                            return false;
                        }

                        return target.classList.contains(className);

                    };

                    /* DOM > ATTR */
                    CL.dom.attr = function (target, name, value) {

                        if (!target || !name) {
                            return null;
                        }

                        if (value === undefined) {
                            return target.getAttribute(name);
                        }

                        target.setAttribute(name, value);

                        return target;

                    };

                    /* DOM > DATA */
                    CL.dom.data = function (target, key, value) {

                        if (!target || !key) {
                            return null;
                        }

                        if (value === undefined) {
                            return target.dataset[key];
                        }

                        target.dataset[key] = value;

                        return target;

                    };

                    /* DOM > HTML */
                    CL.dom.html = function (target, value) {

                        if (!target) {
                            return null;
                        }

                        if (value === undefined) {
                            return target.innerHTML;
                        }

                        target.innerHTML = value;

                        return target;

                    };

                    /* DOM > TEXT */
                    CL.dom.text = function (target, value) {

                        if (!target) {
                            return null;
                        }

                        if (value === undefined) {
                            return target.textContent;
                        }

                        target.textContent = value;

                        return target;

                    };

                    /* DOM > VALUE */
                    CL.dom.value = function (target, value) {

                        if (!target) {
                            return null;
                        }

                        if (value === undefined) {
                            return target.value;
                        }

                        target.value = value;

                        return target;

                    };

                    /* ===================================================== */
                    /* STORAGE — Persistência da aplicação                    */
                    /*
                        Responsabilidades
                        - Encapsular localStorage e sessionStorage.
                        - Não depende de nenhum outro módulo (exceto CL.config).
                        - Não modifica CL.state.
                        - Não manipula a interface (CL.ui).
                        - Não conhece rotas (CL.router) nem autenticação (CL.auth).
                    */
                    /* ===================================================== */

                    CL.ui = {};

                    /* UI > SHOW TOAST
                    Container real do template: #cl-toast-root (ver HTML).
                    O CSS já define .cl-toast, .cl-toast-icon, .cl-toast-content,
                    .cl-toast-title, .cl-toast-message e .cl-toast-close — então o
                    toast é montado com essa estrutura para herdar o estilo existente. */
                    CL.ui.showToast = function (message, type = "info", duration = CL.config.toastDuration) {

                        const container = CL.dom.$("#cl-toast-root");

                        if (!container) {
                            return;
                        }

                        const icons = {
                            info: "ℹ️",
                            success: "✅",
                            warning: "⚠️",
                            error: "⛔"
                        };

                        const id = CL.utils.uuid();

                        const toast = CL.dom.create("div", {
                            className: `cl-toast cl-toast--${type}`,
                            attrs: { "data-toast-id": id, role: "status" }
                        });

                        toast.innerHTML = `
                            <span class="cl-toast-icon">${icons[type] || icons.info}</span>
                            <div class="cl-toast-content">
                                <span class="cl-toast-title">${CL.services.markdown.escape(String(message))}</span>
                            </div>
                            <button class="cl-toast-close" type="button" data-toast-close="${id}">&#10006;</button>
                        `;

                        container.appendChild(toast);

                        CL.state.toasts.push(id);

                        setTimeout(() => {
                            CL.ui.removeToast(id);
                        }, duration);

                        return id;

                    };

                    /* UI > REMOVE TOAST */
                    CL.ui.removeToast = function (id) {

                        const toast = CL.dom.$(`[data-toast-id="${id}"]`);

                        if (!toast) {
                            return;
                        }

                        CL.dom.remove(toast);

                        CL.state.toasts = CL.state.toasts.filter(item => item !== id);

                    };

                    /* UI > CLEAR TOASTS */
                    CL.ui.clearToasts = function () {
                        [...CL.state.toasts].forEach(id => {
                            CL.ui.removeToast(id);
                        });
                    };

                    /* UI > OPEN MODAL
                    Utilitário genérico para abrir um modal ESTÁTICO já existente no HTML
                    (por id). O template atual não tem nenhum — os diálogos reais do app
                    (modal, alert, confirm) são montados dinamicamente por
                    CL.components.modal em #cl-modal-root. Este método fica disponível
                    caso algum dia você adicione um modal fixo direto no HTML. */
                    CL.ui.openModal = function (id) {

                        const modal = CL.dom.$(`#${id}`);

                        if (!modal) {
                            return false;
                        }

                        CL.dom.show(modal);

                        CL.state.modalOpen = true;
                        CL.state.activeModal = id;

                        return true;

                    };

                    /* UI > CLOSE MODAL */
                    CL.ui.closeModal = function () {

                        if (!CL.state.activeModal) {
                            return false;
                        }

                        const modal = CL.dom.$(`#${CL.state.activeModal}`);

                        if (modal) {
                            CL.dom.hide(modal);
                        }

                        CL.state.modalOpen = false;
                        CL.state.activeModal = null;

                        return true;

                    };

                    /* UI > TOGGLE MODAL */
                    CL.ui.toggleModal = function (id) {

                        if (CL.state.modalOpen && CL.state.activeModal === id) {
                            return CL.ui.closeModal();
                        }

                        if (CL.state.modalOpen) {
                            CL.ui.closeModal();
                        }

                        return CL.ui.openModal(id);

                    };

                    /* UI > SHOW FATAL ERROR
                    Painel fixo de erro (#cl-errors), pensado para falhas que impedem o
                    app de continuar (ex: boot quebrou). Diferente de um toast — fica
                    visível até o usuário fechar. */
                    CL.ui.showFatalError = function (title = "Erro", message = "") {

                        const panel = CL.dom.$("#cl-errors");

                        if (!panel) {
                            return false;
                        }

                        const titleEl = CL.dom.$("#cl-error-title");
                        const messageEl = CL.dom.$("#cl-error-message");

                        if (titleEl) {
                            CL.dom.text(titleEl, title);
                        }

                        if (messageEl) {
                            CL.dom.text(messageEl, message);
                        }

                        panel.hidden = false;

                        return true;

                    };

                    /* UI > HIDE FATAL ERROR */
                    CL.ui.hideFatalError = function () {

                        const panel = CL.dom.$("#cl-errors");

                        if (!panel) {
                            return false;
                        }

                        panel.hidden = true;

                        return true;

                    };

                    /* UI > SET THEME
                    Ícones espelham a Landing: 🌙 (tema escuro ativo) / ☀ (tema
                    claro ativo) — ver #cl-theme-icon no header.
                    FIX: antes os dois ramos do ternário retornavam o mesmo emoji
                    (☀), então o botão nunca trocava de ícone ao alternar tema. */
                    CL.ui.setTheme = function (theme) {

                        if (!theme) {
                            return false;
                        }

                        document.documentElement.setAttribute("data-theme", theme);

                        CL.state.theme = theme;

                        CL.storage.set("theme", theme);

                        const icon = CL.dom.$("#cl-theme-icon");

                        if (icon) {
                            CL.dom.html(icon, theme === "solarized-dark" ? "🌙" : "☀");
                        }

                        return true;
                      

                    };

                    /* UI > GET THEME */
                    CL.ui.getTheme = function () {
                        return CL.state.theme;
                    };

                    /* UI > TOGGLE THEME */
                    CL.ui.toggleTheme = function () {

                        const theme = CL.state.theme === "solarized-dark" ? "solarized-light" : "solarized-dark";

                        return CL.ui.setTheme(theme);

                    };

                    /* UI > SET LANGUAGE
                    Já troca CL.state.language de verdade e persiste — a tradução dos
                    textos em si é um passo futuro (fica marcado no data-language do
                    #cl-app pra CSS/JS ligarem nisso depois). Também atualiza o rótulo
                    visível no(s) seletor(es) de idioma do header, se existirem. */
                    CL.ui.setLanguage = function (language) {

                        if (!language || CL.config.languages.indexOf(language) === -1) {
                            return false;
                        }

                        CL.state.language = language;

                        CL.storage.set("language", language);

                        document.documentElement.setAttribute("lang", language);

                        const app = CL.dom.$("#cl-app");

                        if (app) {
                            CL.dom.attr(app, "data-language", language);
                        }

                        const shortLabel = language.split("-")[0].toUpperCase();

                        CL.dom.$$("[data-lang-current]").forEach(el => {
                            CL.dom.text(el, shortLabel);
                        });

                        CL.dom.$$("[data-lang]").forEach(el => {
                            CL.dom.toggleClass(el, "cl-is-active", CL.dom.data(el, "lang") === language);
                        });

                        return true;

                    };

                    /* UI > GET LANGUAGE */
                    CL.ui.getLanguage = function () {
                        return CL.state.language;
                    };

                    /* ===================================================== */
                    /* UI > NAV (apenas o header sobe/some agora — o aside      */
                    /* #cl-sidebar permanece sempre visível, com posicionamento */
                    /* fixo próprio no CSS). Acionado pelo botão #cl-nav-toggle */
                    /* OU automaticamente após CL.config.navAutoHideDelay (ver  */
                    /* CL.boot.scheduleAutoHideNav).                            */
                    /* ===================================================== */

                    /* UI > HIDE NAV */
                    CL.ui.hideNav = function () {

                        const app = CL.dom.$("#cl-app");

                        if (!app) {
                            return false;
                        }

                        CL.dom.addClass(app, "cl-nav-hidden");

                        CL.state.navHidden = true;

                        CL.ui.updateNavToggleIcon();

                        return true;

                    };

                    /* UI > SHOW NAV */
                    CL.ui.showNav = function () {

                        const app = CL.dom.$("#cl-app");

                        if (!app) {
                            return false;
                        }

                        CL.dom.removeClass(app, "cl-nav-hidden");

                        CL.state.navHidden = false;

                        CL.ui.updateNavToggleIcon();

                        return true;

                    };

                    /* UI > TOGGLE NAV */
                    CL.ui.toggleNav = function () {
                        return CL.state.navHidden ? CL.ui.showNav() : CL.ui.hideNav();
                    };

                    /* UI > UPDATE NAV TOGGLE ICON
                    ▾ quando escondida (convida a "puxar pra baixo"), ▴ quando visível
                    (convida a "recolher"). */
                    CL.ui.updateNavToggleIcon = function () {

                        const icon = CL.dom.$("#cl-nav-toggle-icon");

                        if (!icon) {
                            return;
                        }

                        CL.dom.html(icon, CL.state.navHidden ? "&#9662;" : "&#9652;");

                    };
                    /* ===================================================== */
                    /* PAGES */
                    /*
                        Responsabilidades
                        - Registrar, recuperar, verificar, remover, inicializar e destruir páginas
                        - O Router acessa as páginas somente através deste módulo.
                    */
                    /* ===================================================== */

                    CL.components = {};

                    CL.components.registry = {};

                    /* COMPONENTS > REGISTER */
                    CL.components.register = function (name, component) {

                        if (!name || typeof component !== "object") {
                            return false;
                        }

                        CL.components.registry[name] = component;

                        return true;

                    };

                    /* COMPONENTS > GET */
                    CL.components.get = function (name) {
                        return CL.components.registry[name] || null;
                    };

                    /* COMPONENTS > EXISTS */
                    CL.components.exists = function (name) {
                        return Object.prototype.hasOwnProperty.call(CL.components.registry, name);
                    };

                    /* COMPONENTS > CREATE */
                    CL.components.create = function (name) {

                        const component = {
                            name,
                            init() {},
                            destroy() {}
                        };

                        CL.components.register(name, component);

                        return component;

                    };

                    /* ===================================================== */
                    /* COMPONENT > MODAL
                    Não existe markup estático de modal no template (só o container
                    vazio #cl-modal-root, com CSS pronto para .cl-modal-overlay/.cl-modal/
                    .cl-modal-header/.cl-modal-title/.cl-modal-body/.cl-modal-footer/
                    .cl-modal-close). Este componente monta e desmonta o modal em runtime,
                    um de cada vez, e é a base usada por CL.components.alert e
                    CL.components.confirm abaixo.                                       */
                    /* ===================================================== */

                    CL.components.modal = CL.components.create("modal");

                    CL.components.modal.activeId = null;

                    /* COMPONENT > MODAL > OPEN
                    options: { title, body, footer, closable }
                    - body/footer aceitam HTML (montados internamente pelo próprio CL,
                        por isso não passam por escape aqui — quem chama com texto de
                        usuário deve usar CL.services.markdown.escape antes). */
                    CL.components.modal.open = function (options = {}) {

                        const root = CL.dom.$("#cl-modal-root");

                        if (!root) {
                            return false;
                        }

                        /* garante que só existe um modal ativo por vez */
                        CL.components.modal.close();

                        const {
                            title = "",
                            body = "",
                            footer = "",
                            closable = true
                        } = options;

                        const id = CL.utils.uuid();

                        const overlay = CL.dom.create("div", {
                            className: "cl-modal-overlay",
                            attrs: { "data-modal-overlay": id },
                            style: { pointerEvents: "auto" }
                        });

                        overlay.innerHTML = `
                            <div aria-labelledby="cl-modal-title-${id}" aria-modal="true" class="cl-modal" role="dialog">
                                <div class="cl-modal-header">
                                    <span class="cl-modal-title" id="cl-modal-title-${id}">${CL.services.markdown.escape(title)}</span>
                                    ${closable ? '<button aria-label="Fechar" class="cl-modal-close" data-modal-close type="button">&#10006;</button>' : ""}
                                </div>
                                <div class="cl-modal-body"></div>
                                <div class="cl-modal-footer"></div>
                            </div>
                        `;

                        overlay.querySelector(".cl-modal-body").innerHTML = body;
                        overlay.querySelector(".cl-modal-footer").innerHTML = footer;

                        root.appendChild(overlay);

                        CL.components.modal.activeId = id;

                        CL.state.modalOpen = true;
                        CL.state.activeModal = id;

                        return id;

                    };

                    /* COMPONENT > MODAL > CLOSE */
                    CL.components.modal.close = function () {

                        const root = CL.dom.$("#cl-modal-root");

                        if (!root || !CL.components.modal.activeId) {
                            return false;
                        }

                        const overlay = root.querySelector(`[data-modal-overlay="${CL.components.modal.activeId}"]`);

                        if (overlay) {
                            CL.dom.remove(overlay);
                        }

                        CL.components.modal.activeId = null;

                        CL.state.modalOpen = false;
                        CL.state.activeModal = null;

                        return true;

                    };

                    /* COMPONENT > MODAL > TOGGLE (fecha se estiver aberto; abrir exige options, use .open()) */
                    CL.components.modal.toggle = function () {
                        return CL.state.modalOpen ? CL.components.modal.close() : false;
                    };

                    CL.components.modal.init = function () {};

                    CL.components.modal.destroy = function () {
                        CL.components.modal.close();
                    };

                    /* ===================================================== */
                    /* COMPONENT > TOAST
                    A implementação real de toast vive em CL.ui.showToast/removeToast
                    (monta o markup dinamicamente em #cl-toast-root — ver CL.ui). Este
                    componente só existe para dar uma API consistente com os demais
                    componentes (registro em CL.components.registry, init/destroy),
                    delegando tudo pra CL.ui — sem duplicar lógica de DOM.             */
                    /* ===================================================== */

                    CL.components.toast = CL.components.create("toast");

                    CL.components.toast.show = function (message, type = "info", duration) {
                        return CL.ui.showToast(message, type, duration);
                    };

                    CL.components.toast.success = function (message, duration) {
                        return CL.ui.showToast(message, "success", duration);
                    };

                    CL.components.toast.error = function (message, duration) {
                        return CL.ui.showToast(message, "error", duration);
                    };

                    CL.components.toast.warning = function (message, duration) {
                        return CL.ui.showToast(message, "warning", duration);
                    };

                    CL.components.toast.info = function (message, duration) {
                        return CL.ui.showToast(message, "info", duration);
                    };

                    CL.components.toast.clear = function () {
                        CL.ui.clearToasts();
                    };

                    CL.components.toast.init = function () {};

                    CL.components.toast.destroy = function () {
                        CL.components.toast.clear();
                    };

                    /* ===================================================== */
                    /* COMPONENT > LOADING */
                    /* ===================================================== */

                    CL.components.loading = CL.components.create("loading");

                    CL.components.loading.show = function () {

                        const loading = CL.dom.$("#cl-loading");

                        if (!loading) {
                            return false;
                        }

                        loading.hidden = false;
                        CL.state.loading = true;

                        return true;

                    };

                    CL.components.loading.hide = function () {

                        const loading = CL.dom.$("#cl-loading");

                        if (!loading) {
                            return false;
                        }

                        loading.hidden = true;
                        CL.state.loading = false;

                        return true;

                    };

                    CL.components.loading.toggle = function () {

                        const loading = CL.dom.$("#cl-loading");

                        if (!loading) {
                            return false;
                        }

                        loading.hidden = !loading.hidden;
                        CL.state.loading = !loading.hidden;

                        return true;

                    };

                    CL.components.loading.isVisible = function () {

                        const loading = CL.dom.$("#cl-loading");

                        if (!loading) {
                            return false;
                        }

                        return !loading.hidden;

                    };

                    CL.components.loading.init = function () {
                        CL.components.loading.hide();
                    };

                    CL.components.loading.destroy = function () {
                        CL.components.loading.hide();
                    };

                    /* ===================================================== */
                    /* COMPONENT > ALERT
                    Não existe markup/CSS de alerta no template (#cl-errors é outra
                    coisa: um painel de erro fixo, sem classes .cl-alert). Por isso o
                    alerta é implementado como um CL.components.modal com um botão OK. */
                    /* ===================================================== */

                    CL.components.alert = CL.components.create("alert");

                    CL.components.alert.show = function (title = "Aviso", message = "") {

                        return CL.components.modal.open({
                            title,
                            body: `<p>${CL.services.markdown.escape(message)}</p>`,
                            footer: '<button class="cl-btn cl-btn-filled cl-primary" data-modal-close type="button">OK</button>'
                        });

                    };

                    CL.components.alert.hide = function () {
                        return CL.components.modal.close();
                    };

                    CL.components.alert.init = function () {};

                    CL.components.alert.destroy = function () {
                        CL.components.alert.hide();
                    };

                    /* ===================================================== */
                    /* COMPONENT > CONFIRM
                    Mesma ideia do alert: implementado sobre CL.components.modal,
                    com dois botões (data-confirm-yes / data-confirm-no) tratados
                    de forma centralizada em CL.events.click.                     */
                    /* ===================================================== */

                    CL.components.confirm = CL.components.create("confirm");

                    CL.components.confirm.onConfirm = null;
                    CL.components.confirm.onCancel = null;

                    CL.components.confirm.show = function (title = "Confirmação", message = "", onConfirm = null, onCancel = null) {

                        CL.components.confirm.onConfirm = onConfirm;
                        CL.components.confirm.onCancel = onCancel;

                        return CL.components.modal.open({
                            title,
                            body: `<p>${CL.services.markdown.escape(message)}</p>`,
                            footer: `
                                <button class="cl-btn" data-confirm-no type="button">Cancelar</button>
                                <button class="cl-btn cl-btn-filled cl-primary" data-confirm-yes type="button">Confirmar</button>
                            `,
                            closable: false
                        });

                    };

                    CL.components.confirm.hide = function () {
                        return CL.components.modal.close();
                    };

                    CL.components.confirm.init = function () {};

                    CL.components.confirm.destroy = function () {

                        CL.components.confirm.onConfirm = null;
                        CL.components.confirm.onCancel = null;

                        CL.components.confirm.hide();

                    };
                    /* ===================================================== */
                    /* EVENTS */
                    /*
                        Responsabilidades
                        - Registrar eventos globais
                        - Centralizar listeners (evitar addEventListener espalhados pelo código)
                    */
                    /* ===================================================== */

                    CL.events = {};

                    /* EVENTS > CLICK (delegação centralizada) */
                    CL.events.click = function (event) {

                        const target = event.target;

                        /* fecha o painel de erro fatal */
                        if (target.closest("#cl-error-close")) {
                            CL.ui.hideFatalError();
                            return;
                        }

                        /* alterna mostrar/esconder o header — clique manual também
                           cancela o auto-hide agendado, pra não fechar de novo
                           sozinho um segundo depois de o usuário abrir na mão.
                           O aside (#cl-sidebar) não é afetado por este toggle. */
                        if (target.closest("#cl-nav-toggle")) {
                            CL.boot.cancelAutoHideNav();
                            CL.ui.toggleNav();
                            return;
                        }

                        /* seletor de idioma — abre/fecha o dropdown correspondente
                           (não existe na página do dashboard hoje, mas o handler é
                           genérico e inofensivo caso um dia apareça aqui também) */
                        const langToggle = target.closest("[data-lang-toggle]");

                        if (langToggle) {

                            const dropdown = langToggle.parentElement.querySelector(".cl-dropdown");

                            if (dropdown) {
                                const willOpen = dropdown.hidden;
                                CL.events.closeDropdowns();
                                dropdown.hidden = !willOpen;
                                CL.dom.attr(langToggle, "aria-expanded", String(willOpen));
                            }

                            return;
                        }

                        /* seleção de um idioma dentro do dropdown */
                        const langOption = target.closest("[data-lang]");

                        if (langOption) {
                            CL.ui.setLanguage(CL.dom.data(langOption, "lang"));
                            CL.events.closeDropdowns();
                            return;
                        }

                        /* qualquer gatilho genérico de dropdown — usado pelo avatar do
                        header e por todos os itens da aside (Courses/Playground/
                        Exercícios/Ferramentas/Conta). Basta o botão ter
                        data-dropdown-toggle e um ".cl-dropdown" irmão logo depois. */
                        const dropdownToggle = target.closest("[data-dropdown-toggle]");

                        if (dropdownToggle) {

                            const dropdown = dropdownToggle.parentElement.querySelector(".cl-dropdown");

                            if (dropdown) {
                                const willOpen = dropdown.hidden;
                                CL.events.closeDropdowns();
                                dropdown.hidden = !willOpen;
                                CL.dom.attr(dropdownToggle, "aria-expanded", String(willOpen));
                            }

                            return;
                        }

                        /* itens de dropdown com ação (Conta > Perfil/Configurações,
                        avatar do header > Sair) */
                        const actionItem = target.closest("[data-action]");

                        if (actionItem) {

                            const action = CL.dom.data(actionItem, "action");

                            CL.events.closeDropdowns();

                            if (action === "logout") {
                                CL.auth.logout();
                                return;
                            }

                            if (CL.pages.exists(action)) {
                                CL.router.navigate(action);
                            }

                            return;
                        }

                        if (target.closest("[data-theme-toggle]")) {
                            CL.ui.toggleTheme();
                            return;
                        }

                        /* específicos do confirm — precisam vir antes do fechamento genérico
                        de modal, pois disparam onConfirm/onCancel antes de fechar */
                        if (target.closest("[data-confirm-yes]")) {

                            if (typeof CL.components.confirm.onConfirm === "function") {
                                CL.components.confirm.onConfirm();
                            }

                            CL.components.confirm.hide();

                            return;
                        }

                        if (target.closest("[data-confirm-no]")) {

                            if (typeof CL.components.confirm.onCancel === "function") {
                                CL.components.confirm.onCancel();
                            }

                            CL.components.confirm.hide();

                            return;
                        }

                        /* botão de fechar dentro do modal (usado por modal genérico e alert/OK) */
                        if (target.closest("[data-modal-close]")) {
                            CL.components.modal.close();
                            return;
                        }

                        /* clique fora do card, direto no overlay, também fecha o modal
                        (usa match exato, não closest, para não fechar ao clicar no
                        conteúdo interno do .cl-modal) */
                        if (target.matches("[data-modal-overlay]")) {
                            CL.components.modal.close();
                            return;
                        }

                        const toastClose = target.closest("[data-toast-close]");

                        if (toastClose) {
                            CL.ui.removeToast(CL.dom.data(toastClose, "toastClose"));
                            return;
                        }

                        /* clique em qualquer outro lugar da página fecha dropdowns abertos
                        (idioma, usuário, itens da aside) — precisa ser o último caso,
                        senão fecharia o dropdown antes dos handlers acima conseguirem
                        ler o estado dele */
                        CL.events.closeDropdowns();

                    };

                    /* EVENTS > CLOSE DROPDOWNS
                    Fecha todos os .cl-dropdown abertos (idioma, usuário, itens da aside,
                    e quaisquer outros que venham a existir), exceto o informado em "except".
                    FIX: também zera aria-expanded="false" nos toggles correspondentes. */
                    CL.events.closeDropdowns = function (except) {

                        CL.dom.$$(".cl-dropdown").forEach(dropdown => {
                            if (dropdown !== except) {
                                dropdown.hidden = true;
                            }
                        });

                        CL.dom.$$("[data-dropdown-toggle], [data-lang-toggle]").forEach(toggle => {
                            CL.dom.attr(toggle, "aria-expanded", "false");
                        });

                    };

                    /* EVENTS > KEYDOWN */
                    CL.events.keydown = function (event) {

                        if (event.key === "Escape") {

                            if (CL.state.modalOpen) {
                                CL.components.modal.close();
                            }

                        }

                    };

                    /* EVENTS > RESIZE */
                    CL.events.resize = CL.utils.debounce(function () {}, 200);

                    /* EVENTS > SCROLL */
                    CL.events.scroll = function () {};

                    /* EVENTS > INIT */
                    CL.events.init = function () {

                        document.addEventListener("click", CL.events.click);
                        document.addEventListener("keydown", CL.events.keydown);
                        window.addEventListener("resize", CL.events.resize);
                        window.addEventListener("scroll", CL.events.scroll);

                        /* Navegação por hash já é tratada pelo próprio CL.router.start(),
                        que registra seu listener de "hashchange" chamando CL.router.render.
                        Não duplicamos isso aqui. */

                    };

                    /* ===================================================== */
                    /* SERVICES */
                    /*
                        Responsabilidades
                        - Integrações externas / processamento auxiliar / serviços compartilhados
                        - Não depende de CL.state, CL.ui ou CL.router.
                    */
                    /* ===================================================== */

                    CL.services = {};

                    CL.services.registry = {};

                    /* SERVICES > GET */
                    CL.services.get = function (name) {
                        return CL.services.registry[name] || null;
                    };

                    /* SERVICES > REGISTER */
                    CL.services.register = function (name, service) {

                        if (!name || typeof service !== "object") {
                            return false;
                        }

                        CL.services.registry[name] = service;

                        return true;

                    };

                    /* ===================================================== */
                    /* SERVICE > CACHE */
                    /* ===================================================== */

                    CL.services.cache = {};

                    CL.services.cache.memory = {};

                    CL.services.cache.set = function (key, value, ttl) {

                        const now = Date.now();

                        CL.services.cache.memory[key] = {
                            value: value,
                            created: now,
                            expires: ttl ? now + ttl : null
                        };

                    };

                    CL.services.cache.get = function (key) {

                        const item = CL.services.cache.memory[key];

                        if (!item) {
                            return null;
                        }

                        if (item.expires && Date.now() >= item.expires) {
                            delete CL.services.cache.memory[key];
                            return null;
                        }

                        return item.value;

                    };

                    CL.services.cache.has = function (key) {

                        const item = CL.services.cache.memory[key];

                        if (!item) {
                            return false;
                        }

                        if (item.expires && Date.now() >= item.expires) {
                            delete CL.services.cache.memory[key];
                            return false;
                        }

                        return true;

                    };

                    CL.services.cache.remove = function (key) {

                        if (CL.services.cache.memory[key]) {
                            delete CL.services.cache.memory[key];
                        }

                    };

                    CL.services.cache.clear = function () {
                        CL.services.cache.memory = {};
                    };

                    CL.services.cache.expire = function (key) {

                        const item = CL.services.cache.memory[key];

                        if (!item) {
                            return;
                        }

                        item.expires = Date.now();

                    };

                    CL.services.cache.cleanup = function () {

                        const now = Date.now();

                        Object.keys(CL.services.cache.memory).forEach(function (key) {

                            const item = CL.services.cache.memory[key];

                            if (item.expires && now >= item.expires) {
                                delete CL.services.cache.memory[key];
                            }

                        });

                    };

                    CL.services.register("cache", CL.services.cache);

                    /* ===================================================== */
                    /* SERVICE > MARKDOWN
                    FIX: render() agora escapa o HTML de entrada quando
                    options.html === false (padrão), evitando que markdown vindo
                    de conteúdo do usuário (comentários, respostas, etc.) injete
                    tags arbitrárias — antes a flag "html:false" existia mas nunca
                    era realmente respeitada por render(). */
                    /* ===================================================== */

                    CL.services.markdown = {};

                    CL.services.markdown.options = {
                        html: false,
                        breaks: true,
                        linkify: true
                    };

                    CL.services.markdown.render = function (markdown) {

                        if (!markdown) {
                            return "";
                        }

                        const source = CL.services.markdown.options.html
                            ? markdown
                            : CL.services.markdown.escape(markdown);

                        return source
                            .replace(/^# (.*$)/gim, "<h1>$1</h1>")
                            .replace(/^## (.*$)/gim, "<h2>$1</h2>")
                            .replace(/^### (.*$)/gim, "<h3>$1</h3>")
                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                            .replace(/\*(.*?)\*/g, "<em>$1</em>")
                            .replace(/\n/g, "<br>");

                    };

                    CL.services.markdown.escape = function (html) {

                        if (!html) {
                            return "";
                        }

                        return html
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/"/g, "&quot;")
                            .replace(/'/g, "&#039;");

                    };

                    CL.services.markdown.setOptions = function (options) {

                        if (!options) {
                            return;
                        }

                        CL.services.markdown.options = {
                            ...CL.services.markdown.options,
                            ...options
                        };

                    };

                    CL.services.markdown.getOptions = function () {
                        return { ...CL.services.markdown.options };
                    };

                    CL.services.markdown.reset = function () {
                        CL.services.markdown.options = { html: false, breaks: true, linkify: true };
                    };

                    CL.services.markdown.init = function () {
                        CL.services.markdown.reset();
                    };

                    CL.services.markdown.destroy = function () {
                        CL.services.markdown.options = {};
                    };

                    CL.services.register("markdown", CL.services.markdown);

                    /* ===================================================== */
                    /* SERVICE > SEARCH */
                    /* ===================================================== */

                    CL.services.search = {};

                    CL.services.search.index = [];

                    CL.services.search.add = function (item) {

                        if (!item) {
                            return;
                        }

                        CL.services.search.index.push(item);

                    };

                    CL.services.search.remove = function (id) {

                        CL.services.search.index = CL.services.search.index.filter(function (item) {
                            return item.id !== id;
                        });

                    };

                    CL.services.search.find = function (id) {

                        return CL.services.search.index.find(function (item) {
                            return item.id === id;
                        }) || null;

                    };

                    CL.services.search.query = function (text) {

                        if (!text) {
                            return [];
                        }

                        const query = text.toLowerCase().trim();

                        return CL.services.search.index.filter(function (item) {

                            const content = JSON.stringify(item).toLowerCase();

                            return content.includes(query);

                        });

                    };

                    CL.services.search.clear = function () {
                        CL.services.search.index = [];
                    };

                    CL.services.search.count = function () {
                        return CL.services.search.index.length;
                    };

                    CL.services.search.init = function () {
                        CL.services.search.clear();
                    };

                    CL.services.search.destroy = function () {
                        CL.services.search.index = [];
                    };

                    CL.services.register("search", CL.services.search);

                    /* ===================================================== */
                    /* BOOT — ordem: storage -> auth -> ui -> router          */
                    /*
                        Responsabilidades
                        - Único ponto de entrada da aplicação.
                        - Restaura preferências (tema) e sessão a partir do CL.storage.
                        - Inicializa os componentes de UI.
                        - Liga os listeners globais (CL.events).
                        - Inicia o roteador por último, já com auth/ui prontos.
                        - Agenda o auto-hide do header (CL.config.navAutoHideDelay).
                          O aside (#cl-sidebar) não participa deste comportamento.
                    */
                    /* ===================================================== */

                    CL.boot = {};

                    CL.boot.autoHideTimer = null;

                    /* BOOT > SCHEDULE AUTO HIDE NAV
                    Passado CL.config.navAutoHideDelay (padrão: 5s) sem que o usuário
                    tenha escondido o header na mão, ele some sozinho e só o
                    botão #cl-nav-toggle (canto superior direito) fica disponível
                    para trazê-lo de volta. O aside (#cl-sidebar) permanece
                    visível o tempo todo, independente deste timer. */
                    CL.boot.scheduleAutoHideNav = function () {

                        CL.boot.cancelAutoHideNav();

                        CL.boot.autoHideTimer = setTimeout(function () {

                            if (!CL.state.navHidden) {
                                CL.ui.hideNav();
                            }

                            CL.boot.autoHideTimer = null;

                        }, CL.config.navAutoHideDelay);

                    };

                    /* BOOT > CANCEL AUTO HIDE NAV */
                    CL.boot.cancelAutoHideNav = function () {

                        if (CL.boot.autoHideTimer) {
                            clearTimeout(CL.boot.autoHideTimer);
                            CL.boot.autoHideTimer = null;
                        }

                    };

                    /* BOOT > INIT COMPONENTS */
                    CL.boot.initComponents = function () {

                        Object.keys(CL.components.registry).forEach(function (name) {

                            const component = CL.components.registry[name];

                            if (typeof component.init === "function") {
                                component.init();
                            }

                        });

                    };

                    /* BOOT > INIT SERVICES */
                    CL.boot.initServices = function () {

                        Object.keys(CL.services.registry).forEach(function (name) {

                            const service = CL.services.registry[name];

                            if (typeof service.init === "function") {
                                service.init();
                            }

                        });

                    };

                    /* BOOT > INIT
                    Assíncrono porque aguarda CL.auth.ready (primeira resposta do
                    Firebase Auth) antes de decidirmos o que renderizar. */
                    CL.boot.init = async function () {

                        if (CL.state.initialized) {
                            return;
                        }

                        try {

                            /* 1. storage -> restaura preferências persistidas */
                            const theme = CL.storage.get("theme", CL.config.defaultTheme);
                            CL.ui.setTheme(theme);

                            const language = CL.storage.get("language", CL.config.defaultLanguage);
                            CL.ui.setLanguage(language);

                            CL.ui.updateNavToggleIcon();

                            /* 2. auth -> liga o listener do Firebase (onAuthStateChanged) e
                            aguarda a primeira resposta (sessão persistida, se houver)
                            antes de decidir o que fazer. Isso substitui o antigo
                            fluxo manual de retorno do OAuth via hash. */
                            CL.auth.init();

                            /* GUARD -- se nao houver sessao valida, CL.auth.guard() ja
                            redireciona pra Landing sozinho e retorna false. Nesse caso,
                            paramos o boot aqui: nao faz sentido montar rotas, etc. numa
                            pagina que o usuario esta de saida. */
                            if (!(await CL.auth.guard())) {
                                return;
                            }

                            /* 3. ui -> inicializa componentes e serviços */
                            CL.boot.initServices();
                            CL.boot.initComponents();

                            /* liga os listeners globais (delegação centralizada) */
                            CL.events.init();

                            /* 4. router -> inicia navegação por hash (por último, com o hash
                            já limpo de qualquer resquício do OAuth) */
                            CL.router.start();

                            /* 5. nav -> agenda o sumiço automático do header */
                            CL.boot.scheduleAutoHideNav();

                            CL.state.initialized = true;

                        } catch (error) {

                            if (CL.config.debug) {
                                console.error("[CL.boot] falha no boot:", error);
                            }

                            CL.ui.showFatalError(
                                "Erro ao iniciar",
                                "Não foi possível carregar a aplicação. Recarregue a página."
                            );

                        } finally {

                            /* segurança extra: CL.components.loading.init() já esconde o
                            loading no fluxo normal (chamado por initComponents acima), mas
                            se o boot quebrar ANTES de chegar lá, esse finally garante que
                            o usuário nunca fique preso na tela de carregando. */
                            CL.components.loading.hide();

                        }

                    };

                    /* Dispara o boot assim que o DOM estiver pronto. */
                    document.addEventListener("DOMContentLoaded", function () {
                        CL.boot.init();
                    }); 

})();
