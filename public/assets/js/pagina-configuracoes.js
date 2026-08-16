/* Configurações de conta e preferências. */
(function () {
    "use strict";

    window.CL = window.CL || {};
    const CL = window.CL;
    const providerNames = { email: "E-mail e senha", google: "Google", github: "GitHub", facebook: "Facebook", microsoft: "Microsoft" };

    function renderSettings() {
        const user = CL.auth.getUser();
        if (!user) return;
        const provider = user.provider || "email";
        const isEmailAccount = provider === "email";
        document.getElementById("cl-settings-email").textContent = user.email || "Não informado";
        document.getElementById("cl-settings-provider").textContent = providerNames[provider] || provider;
        document.getElementById("cl-settings-password-reset").hidden = !isEmailAccount;
        document.getElementById("cl-settings-password-note").textContent = isEmailAccount
            ? "Receba um link seguro no seu e-mail para alterar a senha."
            : "A senha desta conta é gerenciada pelo " + (providerNames[provider] || "provedor de acesso") + ".";
        document.getElementById("cl-settings-theme").value = CL.ui.getTheme() || "solarized-dark";
    }

    CL.pages.settings.init = renderSettings;

    document.addEventListener("DOMContentLoaded", function () {
        const theme = document.getElementById("cl-settings-theme");
        const reset = document.getElementById("cl-settings-password-reset");
        const deleteButton = document.getElementById("cl-settings-delete-account");
        const deleteDialog = document.getElementById("cl-delete-account-dialog");
        const deleteForm = document.getElementById("cl-delete-account-form");
        const deleteInput = document.getElementById("cl-delete-account-confirmation");
        const deleteCancel = document.getElementById("cl-delete-account-cancel");
        const deleteConfirm = document.getElementById("cl-delete-account-confirm");
        const deleteStatus = document.getElementById("cl-delete-account-status");
        theme.addEventListener("change", function () { CL.ui.setTheme(theme.value); });
        reset.addEventListener("click", async function () {
            const user = CL.auth.getUser();
            if (!user || !user.email) return;
            reset.disabled = true;
            const sent = await CL.auth.sendPasswordReset(user.email);
            reset.disabled = false;
            if (sent) reset.textContent = "E-mail enviado";
        });

        deleteButton.addEventListener("click", function () {
            deleteForm.reset();
            deleteStatus.textContent = "";
            deleteDialog.showModal();
            deleteInput.focus();
        });
        deleteCancel.addEventListener("click", function () { deleteDialog.close(); });
        deleteForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (deleteInput.value.trim() !== "EXCLUIR") {
                deleteStatus.textContent = 'Digite "EXCLUIR" para confirmar.';
                deleteInput.focus();
                return;
            }
            deleteConfirm.disabled = true;
            deleteCancel.disabled = true;
            deleteStatus.textContent = "Excluindo seus dados e conta…";
            const deleted = await CL.auth.deleteAccount();
            if (deleted) {
                window.location.href = CL.config.landingUrl + "?reason=account-deleted";
                return;
            }
            deleteStatus.textContent = "Não foi possível concluir. Entre novamente e tente de novo.";
            deleteConfirm.disabled = false;
            deleteCancel.disabled = false;
        });
    });
})();
