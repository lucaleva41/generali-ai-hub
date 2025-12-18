/**
 * Login “soft” SOLO lato client.
 * - Utile per demo/intranet leggera.
 * - NON è sicurezza reale su GitHub Pages (il codice resta accessibile).
 * Per sicurezza vera: SSO/Backend o Cloudflare Access.
 */
(function () {
  const gate = document.getElementById("loginGate");
  const app = document.getElementById("appRoot");
  const userEl = document.getElementById("loginUser");
  const passEl = document.getElementById("loginPass");
  const btn = document.getElementById("loginBtn");
  const err = document.getElementById("loginError");
  const who = document.getElementById("who");
  const reset = document.getElementById("clearSession");

  const params = new URLSearchParams(location.search);
  const devBypass =
    params.get("dev") === "1" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  // Credenziali demo (da sostituire in futuro con backend + ruoli)
  const DEMO_USERS = {
    commerciale: { password: "Generali2025!", ruolo: "Commerciale" },
    manager: { password: "Manager2025!", ruolo: "Manager" },
    admin: { password: "Admin2025!", ruolo: "Admin" },
  };

  function setAuthed(session) {
    localStorage.setItem("gaihub_session", JSON.stringify(session));
  }
  function getAuthed() {
    try {
      return JSON.parse(localStorage.getItem("gaihub_session") || "null");
    } catch {
      return null;
    }
  }
  function clearAuthed() {
    localStorage.removeItem("gaihub_session");
  }

  function showGate() {
    gate.style.display = "grid";
    app.style.filter = "blur(10px)";
    app.style.pointerEvents = "none";
  }
  function hideGate() {
    gate.style.display = "none";
    app.style.filter = "none";
    app.style.pointerEvents = "auto";
  }

  function refreshWho() {
    const s = getAuthed();
    if (!who) return;
    if (s?.ruolo && s?.utente) who.textContent = `${s.ruolo} • ${s.utente}`;
  }

  // Logout button in sidebar
  const logoutBtn = document.getElementById("logout");
  logoutBtn?.addEventListener("click", () => {
    clearAuthed();
    if (!devBypass) showGate();
    refreshWho();
  });

  reset?.addEventListener("click", () => {
    clearAuthed();
    err.style.display = "none";
    userEl.value = "";
    passEl.value = "";
  });

  function attemptLogin() {
    err.style.display = "none";
    const u = (userEl.value || "").trim().toLowerCase();
    const p = (passEl.value || "").trim();
    const rec = DEMO_USERS[u];
    if (!rec || rec.password !== p) {
      err.style.display = "block";
      return;
    }
    setAuthed({ utente: u, ruolo: rec.ruolo, ts: Date.now() });
    hideGate();
    refreshWho();
  }

  btn?.addEventListener("click", attemptLogin);
  passEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
  });

  // Boot
  if (devBypass) {
    if (!getAuthed())
      setAuthed({ utente: "sviluppo", ruolo: "Sviluppo", ts: Date.now() });
    hideGate();
    refreshWho();
    return;
  }

  const s = getAuthed();
  if (s) hideGate();
  else showGate();
  refreshWho();
})();
