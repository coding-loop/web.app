/* Carrossel de destaques da dashboard.
   Os slides são definidos somente no HTML por [data-carousel-slide]. */
(function () {
    "use strict";

    function initCarousel(carousel) {
        const track = carousel.querySelector(".cl-carousel-track");
        const slides = Array.from(carousel.querySelectorAll("[data-carousel-slide]"));
        const previous = carousel.querySelector("[data-carousel-prev]");
        const next = carousel.querySelector("[data-carousel-next]");
        const indicators = carousel.querySelector("[data-carousel-indicators]");
        const interval = Number(carousel.dataset.carouselInterval) || 7000;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let current = 0;
        let timer = null;

        if (!track || !slides.length) return;

        slides.forEach(function (slide, index) {
            slide.setAttribute("role", "group");
            slide.setAttribute("aria-roledescription", "slide");
            slide.setAttribute("aria-label", (index + 1) + " de " + slides.length);

            const indicator = document.createElement("button");
            indicator.type = "button";
            indicator.className = "cl-carousel-indicator";
            indicator.setAttribute("aria-label", "Ver destaque " + (index + 1));
            indicator.addEventListener("click", function () { goTo(index, true); });
            indicators.appendChild(indicator);
        });

        const dots = Array.from(indicators.querySelectorAll("button"));

        function render() {
            track.style.transform = "translateX(-" + (current * 100) + "%)";
            slides.forEach(function (slide, index) { slide.setAttribute("aria-hidden", String(index !== current)); });
            dots.forEach(function (dot, index) {
                const active = index === current;
                dot.classList.toggle("is-active", active);
                dot.setAttribute("aria-current", active ? "true" : "false");
            });
        }

        function stop() {
            if (timer) window.clearInterval(timer);
            timer = null;
        }

        function start() {
            stop();
            if (slides.length > 1 && !reduceMotion.matches) {
                timer = window.setInterval(function () { goTo(current + 1); }, interval);
            }
        }

        function goTo(index, restart) {
            current = (index + slides.length) % slides.length;
            render();
            if (restart) start();
        }

        previous.addEventListener("click", function () { goTo(current - 1, true); });
        next.addEventListener("click", function () { goTo(current + 1, true); });
        carousel.addEventListener("mouseenter", stop);
        carousel.addEventListener("mouseleave", start);
        carousel.addEventListener("focusin", stop);
        carousel.addEventListener("focusout", function () { window.setTimeout(start, 0); });
        reduceMotion.addEventListener("change", start);

        if (slides.length < 2) {
            previous.hidden = true;
            next.hidden = true;
            indicators.hidden = true;
        }

        render();
        start();
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("[data-carousel]").forEach(initCarousel);
    });
}());
