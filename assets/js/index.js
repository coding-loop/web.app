// ==========================================================================
// 1. IMPORTAÇÕES DO FIREBASE (App, Analytics e Auth)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCrr-dwZvA6I68dwM_P_Sqh_7dAIgsBuG8",
  authDomain: "coding-loop.firebaseapp.com",
  projectId: "coding-loop",
  storageBucket: "coding-loop.firebasestorage.app",
  messagingSenderId: "344147171863",
  appId: "1:344147171863:web:e084815f63deea91361a52",
  measurementId: "G-G2BV5MSZW8"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// ==========================================================================
// 2. LÓGICA DE ESTADO, LOGIN E DASHBOARD
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const loadingScreen = document.getElementById("cl-loading");
  const loginBtn = document.getElementById("cl-landing-btn-login");

  // Monitora o estado de autenticação do usuário em tempo real
  onAuthStateChanged(auth, (user) => {
    // Esconde o loading assim que o Firebase checar a sessão
    if (loadingScreen) {
      loadingScreen.setAttribute("data-state", "hidden");
    }

    if (user) {
      // Usuário está logado! 
      console.log("Usuário autenticado:", user.email);
      // TODO: Aqui você esconde a landing page e mostra o seu Dashboard
    } else {
      // Usuário NÃO está logado (permanece na landing page)
      console.log("Nenhum usuário logado. Exibindo Landing Page.");
    }
  });

  // Ação do Botão de Login com Google
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(auth, provider);
        console.log("Login realizado com sucesso:", result.user);
      } catch (error) {
        console.error("Erro no login:", error.message);
      }
    });
  }

  // Configuração do Tema Claro/Escuro
  const themeToggleBtn = document.querySelector("[data-theme-toggle]");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
    });
  }
});