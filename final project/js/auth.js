
// Simple client-side auth (demo only)
const USERS_KEY = "cv_users";
const SESSION_KEY = "cv_session";

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch { return {}; }
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function setSession(sess) { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); }
function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

async function sha256(txt) {
  const enc = new TextEncoder().encode(txt);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function doRegister() {
  const name = document.getElementById("rname").value.trim();
  const email = document.getElementById("remail").value.trim().toLowerCase();
  const pass = document.getElementById("rpass").value;
  const pass2 = document.getElementById("rpass2").value;
  if (!name || !email || !pass) return alert("Fill all fields.");
  if (pass !== pass2) return alert("Passwords do not match.");
  const users = loadUsers();
  if (users[email]) return alert("Email already registered.");
  const hash = await sha256(pass);
  users[email] = { name, email, pass: hash, wallet: null, createdAt: Date.now() };
  saveUsers(users);
  setSession({ email, name });
  alert("✅ Account created!");
  window.location.href = "index.html";
}

async function doLogin() {
  const email = document.getElementById("lemail").value.trim().toLowerCase();
  const pass = document.getElementById("lpass").value;
  const users = loadUsers();
  const u = users[email];
  if (!u) return alert("Account not found.");
  const hash = await sha256(pass);
  if (hash !== u.pass) return alert("Incorrect password.");
  setSession({ email, name: u.name });
  alert("✅ Logged in!");
  window.location.href = "index.html";
}

function doLogout() {
  clearSession();
  window.location.reload();
}

function renderNavbarAuth() {
  const sess = getSession();
  const loginLink = document.getElementById("loginLink");
  const registerLink = document.getElementById("registerLink");
  const userArea = document.getElementById("userArea");
  const logoutBtn = document.getElementById("logoutBtn");
  if (sess && sess.email) {
    if (loginLink) loginLink.style.display = "none";
    if (registerLink) registerLink.style.display = "none";
    if (userArea) { userArea.textContent = "Hi, " + sess.name; userArea.style.display = "inline"; }
    if (logoutBtn) { logoutBtn.style.display = "inline-block"; logoutBtn.addEventListener("click", doLogout); }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderNavbarAuth();
  const rb = document.getElementById("registerBtn"); if (rb) rb.addEventListener("click", doRegister);
  const lb = document.getElementById("loginBtn"); if (lb) lb.addEventListener("click", doLogin);
});
