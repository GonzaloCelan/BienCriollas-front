// ========= CONFIGURACIÓN =========
const USER = "admin";
const PASS = "Bc2026"; // cambiálo si querés

// ========= LOGIN =========
document.getElementById("btn-login").addEventListener("click", () => {
  const user = document.getElementById("login-user").value.trim();
  const pass = document.getElementById("login-pass").value.trim();

  if (user === USER && pass === PASS) {
    localStorage.setItem("bc_logueado", "SI");
    window.location.href = "index.html"; // tu panel principal
  } else {
    document.getElementById("login-error").classList.remove("hidden");
  }
});
