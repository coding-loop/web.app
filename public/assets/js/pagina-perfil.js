/* Página de perfil do aluno. Depende de auth.js, api.js e router.js. */
(function () {
    "use strict";

    window.CL = window.CL || {};
    const CL = window.CL;
    let uploadedAvatar = "";

    function setProfilePhoto(image, avatar, name) {
        image.onerror = function () {
            image.onerror = null;
            const initial = (name || "CL").trim().charAt(0).toUpperCase() || "CL";
            image.src = "data:image/svg+xml," + encodeURIComponent(
                "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='100%' height='100%' fill='#268bd2'/><text x='50%' y='57%' text-anchor='middle' font-family='sans-serif' font-size='72' fill='white'>" + initial + "</text></svg>"
            );
        };
        image.src = avatar || "";
    }

    async function renderProfile() {
        const user = CL.auth.getUser();
        if (!user) return;
        const saved = await CL.api.getProfile() || {};
        const name = saved.name || user.name || "";
        const photo = document.getElementById("cl-profile-photo");

        document.getElementById("cl-profile-name").value = name;
        document.getElementById("cl-profile-email").value = user.email || "";
        document.getElementById("cl-profile-bio").value = saved.bio || "";
        /* A foto da conta é o padrão. profileAvatar, quando definido,
           pertence somente ao Perfil e não altera o cabeçalho. */
        if (photo) setProfilePhoto(photo, saved.profileAvatar || user.avatar, name);
    }

    CL.pages.profile.init = function () {
        renderProfile().catch(function () {});
    };

    document.addEventListener("DOMContentLoaded", function () {
        const form = document.getElementById("cl-profile-form");
        const photoFile = document.getElementById("cl-profile-photo-file");
        const photo = document.getElementById("cl-profile-photo");
        if (!form) return;

        photoFile.addEventListener("change", function () {
            const file = photoFile.files && photoFile.files[0];
            const status = document.getElementById("cl-profile-status");
            if (!file) return;
            if (file.size > 500 * 1024) {
                status.textContent = "Escolha uma imagem de até 500 KB.";
                photoFile.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = function () {
                uploadedAvatar = reader.result;
                setProfilePhoto(photo, uploadedAvatar, document.getElementById("cl-profile-name").value);
                status.textContent = "Foto pronta. Clique em salvar alterações.";
            };
            reader.onerror = function () {
                status.textContent = "Não foi possível ler a imagem selecionada.";
            };
            reader.readAsDataURL(file);
        });

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const button = form.querySelector("button[type='submit']");
            const status = document.getElementById("cl-profile-status");
            const data = {
                name: document.getElementById("cl-profile-name").value.trim(),
                bio: document.getElementById("cl-profile-bio").value.trim()
            };
            if (uploadedAvatar) data.profileAvatar = uploadedAvatar;
            if (!data.name) return;
            button.disabled = true;
            status.textContent = "Salvando…";
            const saved = await CL.auth.updateUser(data);
            button.disabled = false;
            status.textContent = saved ? "Alterações salvas." : "Não foi possível salvar.";
            if (saved) {
                uploadedAvatar = "";
                renderProfile().catch(function () {});
            }
        });
    });
})();
