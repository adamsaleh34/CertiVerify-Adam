
// Simple client-side demo (no backend).
// Stores certificates in localStorage and allows issuing + verifying by SHA-256.

const DB_KEY = "cvp_certificates_v1";

function loadDB(){
  try{ return JSON.parse(localStorage.getItem(DB_KEY)) || []; }catch(e){ return []; }
}
function saveDB(list){ localStorage.setItem(DB_KEY, JSON.stringify(list)); }

function randomHex(n=64){
  const chars = "abcdef0123456789";
  let s=""; for(let i=0;i<n;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function nowISO(){ return new Date().toISOString().slice(0,10); }

async function sha256HexFromFile(file){
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256HexFromText(text){
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ------- Page helpers -------
function q(s,root=document){ return root.querySelector(s); }
function qa(s,root=document){ return Array.from(root.querySelectorAll(s)); }

function renderTable(tbody, rows){
  tbody.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.studentId || "-"}</td>
      <td>${r.studentName || "-"}</td>
      <td>${r.program || "-"}</td>
      <td>${r.issueDate || "-"}</td>
      <td><span class="badge ${r.status==='Valid'?'success':(r.status==='Revoked'?'danger':'gray')}">${r.status}</span></td>
      <td class="small">${r.hash.slice(0,12)}...</td>
      <td><button class="btn secondary btn-sm" data-h="${r.hash}">Copy Hash</button></td>
    `;
    tbody.appendChild(tr);
  });
  // copy buttons
  qa("button[data-h]").forEach(b=>b.onclick = ()=>{
    navigator.clipboard.writeText(b.dataset.h);
    b.textContent = "Copied";
    setTimeout(()=>b.textContent="Copy Hash",1200);
  });
}

// ------- Issuer Dashboard -------
function initDashboard(){
  const list = loadDB();
  const valid = list.filter(x=>x.status==='Valid').length;
  const revoked = list.filter(x=>x.status==='Revoked').length;
  q("#kpi-valid").textContent = valid;
  q("#kpi-revoked").textContent = revoked;
  renderTable(q("#tb-cert"), list.slice().reverse());
}

// ------- Create Certificate -------
function initCreate(){
  const form = q("#create-form");
  const out = q("#create-result");
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const studentName = fd.get("studentName").trim();
    const studentId   = fd.get("studentId").trim();
    const program     = fd.get("program").trim();
    const issueDate   = fd.get("issueDate").trim() || nowISO();
    const file        = fd.get("pdf");
    if(!studentName || !studentId || !program){ alert("Please fill required fields."); return; }
    let hash = "";
    if(file && file.size>0){
      hash = await sha256HexFromFile(file);
    }else{
      // fallback: hash from concatenated text (for demo)
      hash = await sha256HexFromText(`${studentName}|${studentId}|${program}|${issueDate}`);
    }
    const tx = randomHex(64);
    const record = { studentName, studentId, program, issueDate, hash, tx, status:'Valid' };
    const db = loadDB(); db.push(record); saveDB(db);
    out.innerHTML = `
      <div class="card">
        <h3>Certificate Issued</h3>
        <p class="small">Hash:</p>
        <div class="copy">${hash}</div>
        <p class="small">Tx:</p>
        <div class="copy">${tx}</div>
        <p><a href="issuer-dashboard.html" class="btn">Go to Dashboard</a></p>
      </div>`;
    form.reset();
  });
}

// ------- Verify Page -------
function initVerify(){
  const form = q("#verify-form");
  const result = q("#verify-result");
  const inputHash = q("#hash");
  const fileInput = q("#file");

  async function computeHash(){
    if(fileInput.files.length){
      return await sha256HexFromFile(fileInput.files[0]);
    }
    return (inputHash.value||"").trim().toLowerCase();
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const h = await computeHash();
    if(!h){ alert("Enter hash or choose a file."); return; }
    const list = loadDB();
    const rec = list.find(x=>x.hash===h);
    if(rec){
      result.innerHTML = `
        <div class="card">
          <h3>Verification Result: <span class="badge ${rec.status==='Valid'?'success':'danger'}">${rec.status}</span></h3>
          <p>Student: <b>${rec.studentName}</b> (${rec.studentId})</p>
          <p>Program: <b>${rec.program}</b></p>
          <p>Date Issued: ${rec.issueDate}</p>
          <p class="small">Hash: ${rec.hash}</p>
          <p class="small">Tx: ${rec.tx}</p>
        </div>`;
    }else{
      result.innerHTML = `<div class="card"><h3>Verification Result: <span class="badge gray">Not Found</span></h3>
      <p class="small">Ensure the hash is correct or the file matches an issued certificate in this demo.</p></div>`;
    }
  });
}

// ------- Seed sample data for demo (first run) -------
(function seed(){
  const list = loadDB();
  if(list.length===0){
    const sample = [
      {studentName:"Alice Brown", studentId:"S-1001", program:"Web Dev", issueDate:nowISO(), hash:randomHex(64), tx:randomHex(64), status:"Valid"},
      {studentName:"Bob Smith", studentId:"S-1002", program:"Data Science", issueDate:nowISO(), hash:randomHex(64), tx:randomHex(64), status:"Revoked"}
    ];
    saveDB(sample);
  }
})();

// page init by body data-page attribute
window.addEventListener('DOMContentLoaded', ()=>{
  const page = document.body.dataset.page||"";
  if(page==="dashboard") initDashboard();
  if(page==="create") initCreate();
  if(page==="verify") initVerify();
});


// ---------- Simple Auth (demo) ----------
const AUTH_KEY = "cvp_logged_in";
function isLoggedIn(){ return localStorage.getItem(AUTH_KEY)==="1"; }
function login(){ localStorage.setItem(AUTH_KEY, "1"); }
function logout(){ localStorage.removeItem(AUTH_KEY); }

function toggleNavAuth(){
  const loginLink = document.querySelector('a.login-btn');
  const logoutLink = document.querySelector('a.logout-btn');
  const registerLink = document.querySelector('a.register-link');
  if(!loginLink || !logoutLink) return;
  if(isLoggedIn()){
    loginLink.style.display = "none";
    if(registerLink) registerLink.style.display = "none";
    logoutLink.style.display = "inline-block";
  }else{
    loginLink.style.display = "inline-block";
    if(registerLink) registerLink.style.display = "inline-block";
    logoutLink.style.display = "none";
  }
}
document.addEventListener('DOMContentLoaded', toggleNavAuth);
