const SUPABASE_URL = "https://sftpdnvyehwlcjojyurb.supabase.co";
const SUPABASE_KEY = "sb_publishable_TZ533bZFVI2Ak3eGq7GKfA_EF7Pg_l3";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let corrections = [];
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const pct = (i) => (i.gesamt ? Math.min(100, Math.round((i.korrigiert / i.gesamt) * 100)) : 0);

async function load() {
  const { data, error } = await db.from("korrekturen").select("*")
    .order("position", { ascending: true }).order("id", { ascending: true });
  if (error) {
    console.error(error);
    const el = $("studentContent");
    if (el) el.innerHTML = `<div class="card empty">Daten konnten nicht geladen werden.</div>`;
    return;
  }
  corrections = data || [];
  renderStudent();
  renderAdmin();
}

function formatTime(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return `heute, ${time} Uhr`;
  if (days === 1) return `gestern, ${time} Uhr`;
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}., ${time} Uhr`;
}

/* ---------- Schülerseite ---------- */
function renderStudent() {
  const el = $("studentContent");
  if (!el) return;
  if (!corrections.length) {
    el.innerHTML = `<div class="card empty">Zurzeit liegen keine Korrekturen an. 🎉</div>`;
    return;
  }
  const fertig = corrections.filter((i) => i.korrigiert >= i.gesamt).length;
  const overall = Math.round(corrections.reduce((sum, i) => sum + pct(i), 0) / corrections.length);
  const current = corrections.find((i) => i.korrigiert < i.gesamt);
  const latest = corrections.map((i) => i.aktualisiert).filter(Boolean).sort().pop();

  el.innerHTML = `
    <section class="hero">
      <p class="eyebrow">Gesamtfortschritt</p>
      <div class="big">${fertig} <span>von ${corrections.length} Stapeln fertig</span></div>
      <div class="bar"><div style="width:${overall}%"></div></div>
      <p class="muted">${overall} % insgesamt · Zuletzt aktualisiert: ${formatTime(latest)}</p>
    </section>
    <div class="grid">
      ${corrections.map((i) => {
        const finished = i.korrigiert >= i.gesamt;
        const isCur = current && current.id === i.id;
        const label = finished ? "Fertig ✓" : isCur ? "Gerade in Arbeit" : "Wartet";
        return `
        <article class="card stack ${finished ? "finished" : ""} ${isCur ? "current" : ""}">
          <span class="tag">${label}</span>
          <h3>${esc(i.name)}</h3>
          <p class="muted">Klasse ${esc(i.klasse)}</p>
          <div class="bar"><div style="width:${pct(i)}%"></div></div>
          <p class="count"><strong>${i.korrigiert}</strong> von ${i.gesamt} ${i.modus === "aufgaben" ? "Aufgaben" : "Arbeiten"} · ${pct(i)} %</p>
          <p class="mode">${i.modus === "aufgaben" ? "Wird aufgabenweise korrigiert" : "Wird Arbeit für Arbeit korrigiert"}</p>
        </article>`;
      }).join("")}
    </div>`;
}

/* ---------- Verwaltung ---------- */
async function updateAdminVisibility() {
  if (!$("loginBox")) return;
  const { data } = await db.auth.getSession();
  const loggedIn = !!data.session;
  $("loginBox").classList.toggle("hidden", loggedIn);
  $("adminContent").classList.toggle("hidden", !loggedIn);
}

function setupAdmin() {
  if (!$("loginForm")) return;

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginMessage").textContent = "Anmeldung läuft …";
    const { error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value,
    });
    $("loginMessage").textContent = error ? "Anmeldung fehlgeschlagen." : "";
    await updateAdminVisibility();
    await load();
  });

  document.querySelectorAll('input[name="modus"]').forEach((r) =>
    r.addEventListener("change", () => {
      $("gesamtLabel").textContent = r.value === "aufgaben" ? "Anzahl Aufgaben" : "Anzahl Arbeiten";
    }));

  $("logoutButton").addEventListener("click", async () => {
    await db.auth.signOut();
    updateAdminVisibility();
  });

  $("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nextPosition = corrections.length ? Math.max(...corrections.map((i) => i.position)) + 1 : 1;
    const { error } = await db.from("korrekturen").insert({
      name: $("name").value.trim(),
      klasse: $("klasse").value.trim(),
      gesamt: Number($("gesamt").value),
      modus: document.querySelector('input[name="modus"]:checked').value,
      korrigiert: 0,
      position: nextPosition,
    });
    $("adminMessage").textContent = error ? "Fehler beim Speichern." : "Hinzugefügt.";
    if (!error) $("addForm").reset();
    await load();
  });
}

async function changeProgress(id, amount) {
  const item = corrections.find((x) => x.id === id);
  if (!item) return;
  const neu = Math.max(0, Math.min(item.gesamt, item.korrigiert + amount));
  await db.from("korrekturen").update({ korrigiert: neu }).eq("id", id);
  await load();
}

async function deleteCorrection(id) {
  if (!confirm("Diesen Stapel wirklich löschen?")) return;
  await db.from("korrekturen").delete().eq("id", id);
  await load();
}

async function moveCorrection(id, dir) {
  const i = corrections.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= corrections.length) return;
  const a = corrections[i], b = corrections[j];
  await db.from("korrekturen").update({ position: b.position }).eq("id", a.id);
  await db.from("korrekturen").update({ position: a.position }).eq("id", b.id);
  await load();
}

function renderAdmin() {
  const el = $("adminList");
  if (!el) return;
  if (!corrections.length) {
    el.innerHTML = `<p class="muted">Noch keine Stapel angelegt.</p>`;
    return;
  }
  el.innerHTML = corrections.map((i, n) => `
    <div class="admin-row">
      <div class="admin-info">
        <strong>${n + 1}. ${esc(i.name)}</strong>
        <span class="muted">Klasse ${esc(i.klasse)} · ${i.korrigiert}/${i.gesamt} ${i.modus === "aufgaben" ? "Aufgaben" : "Arbeiten"}</span>
        <div class="bar small"><div style="width:${pct(i)}%"></div></div>
      </div>
      <div class="admin-actions">
        <button class="secondary small" onclick="moveCorrection(${i.id}, -1)" ${n === 0 ? "disabled" : ""}>↑</button>
        <button class="secondary small" onclick="moveCorrection(${i.id}, 1)" ${n === corrections.length - 1 ? "disabled" : ""}>↓</button>
        <button class="secondary small" onclick="changeProgress(${i.id}, -1)">−1</button>
        <button class="primary small" onclick="changeProgress(${i.id}, 1)">+1</button>
        <button class="primary small" onclick="changeProgress(${i.id}, 5)">+5</button>
        <button class="secondary small danger" onclick="deleteCorrection(${i.id})">Löschen</button>
      </div>
    </div>`).join("");
}

/* ---------- Start ---------- */
setupAdmin();
updateAdminVisibility();
load();

db.channel("korrektur-counter")
  .on("postgres_changes", { event: "*", schema: "public", table: "korrekturen" }, () => load())
  .subscribe();
