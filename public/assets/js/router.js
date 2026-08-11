/* =====================================================
   ROUTER.JS
   Gerenciamento de troca de telas/aulas dentro do painel
   (hash router) e registro das páginas (CL.pages/CL.router).
   Carrega depois de app.js (usa CL.config/CL.state/CL.ui/
   CL.dom/CL.components definidos lá) e antes do <script>
   de boot de cada página.
   ===================================================== */
(function () {
    "use strict";

    window.CL = window.CL || {};
    const CL = window.CL;

                    CL.router = {};

                    CL.router.routes = {};

                    /* ROUTER > REGISTER */
                    CL.router.register = function (name, config) {

                        if (!name || typeof config !== "object") {
                            return false;
                        }

                        CL.router.routes[name] = config;

                        return true;

                    };

                    /* ROUTER > HAS */
                    CL.router.has = function (name) {
                        return Object.prototype.hasOwnProperty.call(CL.router.routes, name);
                    };

                    /* ROUTER > GET ROUTE */
                    CL.router.getRoute = function (name) {
                        return CL.router.routes[name] || null;
                    };

                    /* ROUTER > GET CURRENT */
                    CL.router.getCurrent = function () {
                        return CL.state.currentRoute;
                    };

                    /* ROUTER > NAVIGATE */
                    CL.router.navigate = function (route) {

                        if (!CL.router.has(route)) {
                            route = CL.config.routeDefault;
                        }

                        if (CL.state.currentRoute === route) {
                            return true;
                        }

                        window.location.hash = `#${route}`;

                        return true;

                    };

                    /* ROUTER > RESOLVE
                    Aceita hash simples (#courses) OU hash com parâmetro
                    (#course/modulo-1-introducao-html) — usado pela trilha
                    do curso pra já chegar mirando um módulo específico.
                    O parâmetro (se houver) fica em CL.state.routeParam,
                    disponível pra página ler no seu init/afterEnter. */
                    CL.router.resolve = function () {

                        let hash = window.location.hash.slice(1);
                        let route = hash;
                        let param = null;

                        const barra = hash.indexOf("/");
                        if (barra !== -1) {
                            route = hash.slice(0, barra);
                            param = decodeURIComponent(hash.slice(barra + 1));
                        }

                        if (!route) {
                            route = CL.config.routeDefault;
                        } else if (!CL.router.has(route)) {
                            /* hash não vazio, mas rota desconhecida -> página 404,
                            não o dashboard silenciosamente. */
                            route = "notFound";
                            param = null;
                        }

                        CL.state.previousRoute = CL.state.currentRoute;
                        CL.state.currentRoute = route;
                        CL.state.routeParam = param;

                        return CL.router.getRoute(route);

                    };

                    /* ROUTER > BEFORE LEAVE */
                    CL.router.beforeLeave = function () {

                        const route = CL.router.getRoute(CL.state.previousRoute);

                        if (!route) {
                            return;
                        }

                        if (typeof route.destroy === "function") {
                            route.destroy();
                        }

                    };

                    /* ROUTER > BEFORE ENTER */
                    CL.router.beforeEnter = function () {

                        const route = CL.router.getRoute(CL.state.currentRoute);

                        if (!route) {
                            return true;
                        }

                        if (typeof route.beforeEnter === "function") {
                            return route.beforeEnter();
                        }

                        return true;

                    };

                    /* ROUTER > AFTER ENTER */
                    CL.router.afterEnter = function () {

                        const route = CL.router.getRoute(CL.state.currentRoute);

                        if (!route) {
                            return;
                        }

                        if (typeof route.afterEnter === "function") {
                            route.afterEnter();
                        }

                    };

                    /* ROUTER > RENDER */
                    CL.router.render = function () {

                        const route = CL.router.resolve();

                        if (!route) {
                            return false;
                        }

                        CL.router.beforeLeave();

                        if (CL.router.beforeEnter() === false) {
                            return false;
                        }

                        if (typeof route.render === "function") {
                            route.render();
                        }

                        if (typeof route.init === "function") {
                            route.init();
                        }

                        CL.router.afterEnter();

                        return true;

                    };

                    /* ROUTER > START */
                    CL.router.start = function () {

                        window.addEventListener("hashchange", CL.router.render);

                        if (!window.location.hash) {
                            CL.router.navigate(CL.config.routeDefault);
                        } else {
                            CL.router.render();
                        }

                    };

                    /* ===================================================== */
                    /* UI — depende de CL.auth já ter resolvido o estado do usuário */
                    /* ===================================================== */

                    CL.pages = {};

                    CL.pages.registry = {};

                    /* PAGES > REGISTER */
                    CL.pages.register = function (name, page) {

                        if (!name || typeof page !== "object") {
                            return false;
                        }

                        CL.pages.registry[name] = page;

                        CL.router.register(name, page);

                        return true;

                    };

                    /* PAGES > GET */
                    CL.pages.get = function (name) {
                        return CL.pages.registry[name] || null;
                    };

                    /* PAGES > EXISTS */
                    CL.pages.exists = function (name) {
                        return Object.prototype.hasOwnProperty.call(CL.pages.registry, name);
                    };

                    /* PAGES > REMOVE */
                    CL.pages.remove = function (name) {

                        if (!CL.pages.exists(name)) {
                            return false;
                        }

                        delete CL.pages.registry[name];

                        return true;

                    };

                    /* PAGES > INIT */
                    CL.pages.init = function (name) {

                        const page = CL.pages.get(name);

                        if (!page) {
                            return false;
                        }

                        if (typeof page.init === "function") {
                            page.init();
                        }

                        return true;

                    };

                    /* PAGES > DESTROY */
                    CL.pages.destroy = function (name) {

                        const page = CL.pages.get(name);

                        if (!page) {
                            return false;
                        }

                        if (typeof page.destroy === "function") {
                            page.destroy();
                        }

                        return true;

                    };

                    /* PAGES > CREATE (fábrica de página com render genérico)
                    O HTML real do template usa:
                        <section class="cl-page" data-page="NAME" id="cl-page-NAME">
                    e a visibilidade é controlada pela classe "cl-is-active"
                    (ver CSS: .cl-page { display:none } / .cl-page.cl-is-active { display:block }),
                    não pelo atributo "hidden". O render genérico abaixo:
                        1. remove "cl-is-active" de todas as .cl-page
                        2. adiciona "cl-is-active" na seção da página atual (#cl-page-NAME)
                        3. sincroniza os links de menu [data-page] (classe cl-is-active)
                        4. atualiza #cl-app[data-page] e o <title> do documento           */
                    CL.pages.create = function (name, options = {}) {

                        const page = {

                            name,

                            title: options.title || name,

                            render() {

                                CL.dom.$$(".cl-page").forEach(section => {
                                    CL.dom.removeClass(section, "cl-is-active");
                                });

                                const section = CL.dom.$(`#cl-page-${name}`);

                                if (section) {
                                    CL.dom.addClass(section, "cl-is-active");
                                } else if (CL.config.debug) {
                                    console.warn(`CL.pages: seção "#cl-page-${name}" não existe no HTML.`);
                                }

                                CL.dom.$$("[data-page]").forEach(link => {
                                    CL.dom.toggleClass(link, "cl-is-active", CL.dom.data(link, "page") === name);
                                });

                                const appRoot = CL.dom.$("#cl-app");

                                if (appRoot) {
                                    CL.dom.attr(appRoot, "data-page", name);
                                }

                                document.title = `${page.title} — ${CL.config.appName}`;

                            },

                            init() {},

                            destroy() {}

                        };

                        CL.pages.register(name, page);

                        return page;

                    };

                    /* ===================================================== */
                    /* DASHBOARD */
                    /* ===================================================== */

                    CL.pages.dashboard = CL.pages.create("dashboard", { title: "Dashboard" });

                    CL.pages.dashboard.init = function () {
                        console.log("Dashboard iniciada.");
                    };

                    CL.pages.dashboard.destroy = function () {
                        console.log("Dashboard destruída.");
                    };

                    /* ===================================================== */
                    /* Páginas que JÁ EXISTEM no HTML do template             */
                    /* (#cl-page-courses, #cl-page-playground, etc.)          */
                    /* ===================================================== */

                    CL.pages.courses = CL.pages.create("courses", { title: "Cursos" });
                    CL.pages.playground = CL.pages.create("playground", { title: "Playground" });
                    CL.pages.exercises = CL.pages.create("exercises", { title: "Exercícios" });
                    CL.pages.tools = CL.pages.create("tools", { title: "Ferramentas" });
                    CL.pages.profile = CL.pages.create("profile", { title: "Perfil" });
                    CL.pages.settings = CL.pages.create("settings", { title: "Configurações" });

                    /* ===================================================== */
                    /* Páginas que AINDA NÃO existem no HTML — use o esqueleto */
                    /* .cl-page fornecido junto com este arquivo para criá-las */
                    /* (#cl-page-course, #cl-page-lesson, #cl-page-notFound)   */
                    /* Login/registro não são mais páginas daqui — acontecem   */
                    /* inteiramente no arquivo da Landing.                     */
                    /* ===================================================== */

                    CL.pages.course = CL.pages.create("course", { title: "Curso" });
                    CL.pages.lesson = CL.pages.create("lesson", { title: "Aula" });
                    CL.pages.notFound = CL.pages.create("notFound", { title: "Página não encontrada" });

                    /* ===================================================== */
                    /* COMPONENTS */
                    /*
                        Responsabilidades: Modal, Toast, Loading, Alert, Confirm
                    */
                    /* ===================================================== */


})();
