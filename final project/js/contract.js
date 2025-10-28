
const CONTRACT_ADDRESS = window.CERTI.ADDR;
const CONTRACT_ABI = window.CERTI.ABI;

let provider, signer, contract;

function cleanError(e) {
  return e?.shortMessage || e?.reason || (e?.error && e?.error.message) || e?.message || "Action failed";
}

async function connectWallet() {
  if (!window.ethereum) return alert("MetaMask not found. Please install it.");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  provider = new window.ethers.BrowserProvider(window.ethereum);
  signer   = await provider.getSigner();
  contract = new window.ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  const addr = await signer.getAddress();
  const btn = document.getElementById("connectWallet");
  if (btn) { btn.textContent = "Connected: " + addr.slice(0,6) + "..." + addr.slice(-4); btn.disabled = true; }
  const w = document.getElementById("walletAddr"); if (w) w.textContent = addr;
}

async function issueCertificateUI() {
  try {
    if (!contract) await connectWallet();
    const hash = document.getElementById("hash").value.trim();
    const studentId = document.getElementById("studentId").value.trim();
    const program = document.getElementById("program").value.trim();
    const uri = document.getElementById("uri").value.trim();
    if (!hash || !studentId || !program) return alert("Fill required fields.");
    const tx = await contract.issue(hash, studentId, program, uri || "");
    const el = document.getElementById("tx"); if (el) el.textContent = "⏳ Pending: " + tx.hash;
    await tx.wait();
    if (el) el.textContent = "✅ Issued: " + tx.hash;
  } catch (e) { alert(cleanError(e)); console.error(e); }
}

async function verifyUI() {
  try {
    if (!contract) await connectWallet();
    const h = document.getElementById("vhash").value.trim();
    if (!h) return alert("Enter hash.");
    const r = await contract.verify(h);
    const out = document.getElementById("vres");
    if (r.found && r.valid) out.innerHTML = "<div class='badge ok'>Valid</div> <div class='small'>Student: "+r.studentId+" • Program: "+r.program+" • Issuer: "+r.issuer+"</div>";
    else if (r.found && !r.valid) out.innerHTML = "<div class='badge warn'>Revoked</div>";
    else out.innerHTML = "<div class='badge neutral'>Not Found</div>";
  } catch (e) { alert(cleanError(e)); console.error(e); }
}

async function loadIssuedEvents() {
  try {
    if (!provider) await connectWallet();
    const from = document.getElementById("fromBlock").value.trim();
    const to = document.getElementById("toBlock").value.trim();
    const iface = new window.ethers.Interface(CONTRACT_ABI);
    const topic = iface.getEvent("Issued").topicHash;
    const filter = { address: CONTRACT_ADDRESS, topics: [topic], fromBlock: from === "" ? 0 : (from === "latest" ? "latest" : Number(from)), toBlock: to === "" ? "latest" : (to === "latest" ? "latest" : Number(to)) };
    const logs = await provider.getLogs(filter);
    const tbody = document.querySelector("#eventsTable tbody");
    tbody.innerHTML = "";
    logs.forEach((lg, i) => {
      const ev = iface.decodeEventLog("Issued", lg.data, lg.topics);
      const hash = ev.hash;
      const issuer = ev.issuer;
      const studentId = ev.studentId;
      const program = ev.program;
      const uri = ev.uri;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><code>${hash}</code></td>
        <td>${studentId}</td>
        <td>${program}</td>
        <td>${uri ? `<a class='link' href='${uri}' target='_blank'>open</a>` : '-'}</td>
        <td><span class="small">${issuer}</span></td>
        <td>
          <button class="btn" data-hash="${hash}" onclick="revokeCert('${hash}')">Revoke</button>
          <a class="link" style="margin-left:8px" href="certificate.html?hash=${hash}">View</a>
        </td>`;
      tbody.appendChild(tr);
    });
    document.getElementById("count").textContent = logs.length + " record(s)";
  } catch (e) { alert(cleanError(e)); console.error(e); }
}

async function revokeCert(h) {
  try {
    if (!contract) await connectWallet();
    if (!confirm("Revoke this certificate?")) return;
    const tx = await contract.revoke(h);
    await tx.wait();
    alert("✅ Revoked!");
    loadIssuedEvents();
  } catch (e) { alert(cleanError(e)); console.error(e); }
}

async function loadCertificatePage() {
  try {
    if (!contract) await connectWallet();
    const params = new URLSearchParams(window.location.search);
    const h = params.get("hash");
    const meta = document.getElementById("meta");
    if (!h) { meta.textContent = "No hash provided (?hash=0x...)"; return; }
    const r = await contract.verify(h);
    if (!r.found) { meta.innerHTML = "<div class='badge neutral'>Not Found</div>"; return; }
    if (r.valid) meta.innerHTML = "<div class='badge ok'>Valid</div>"; else meta.innerHTML = "<div class='badge warn'>Revoked</div>";
    meta.innerHTML += `<div class='small'>Student: ${r.studentId} • Program: ${r.program} • Issuer: ${r.issuer} • IssuedAt: ${r.issuedAt}</div>`;
    if (r.uri && r.uri.startsWith("http")) {
      const iframe = document.createElement("iframe");
      iframe.src = r.uri;
      iframe.style.width = "100%"; iframe.style.height = "700px"; iframe.style.border = "1px solid #e5e7eb"; iframe.style.borderRadius = "12px";
      document.getElementById("embed").appendChild(iframe);
    }
  } catch (e) { alert(cleanError(e)); console.error(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  const c = document.getElementById("connectWallet"); if (c) c.addEventListener("click", connectWallet);
  const i = document.getElementById("issueBtn"); if (i) i.addEventListener("click", issueCertificateUI);
  const v = document.getElementById("verifyBtn"); if (v) v.addEventListener("click", verifyUI);
  const l = document.getElementById("loadEventsBtn"); if (l) l.addEventListener("click", loadIssuedEvents);
  if (window.location.pathname.endsWith("certificate.html")) loadCertificatePage();
});
