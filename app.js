const SUPABASE_URL = "https://sftpdnvyehwlcjojyurb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_TZ533bZFVI2Ak3eGq7GKfA_EF7Pg_l3";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let corrections = [];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadCorrections() {
  const { data, error } = await db
    .from("korrekturen")
    .select("*")
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error(error);

    const target = document.getElementById("studentContent");

    if (target) {
      target.innerHTML = `
        <div class="card">
          <h2>Daten konnten nicht geladen werden.</h2>
          <p class="muted">${escapeHtml(error.message)}</p>
        </div>
      `;
    }

    return;
  }

  corrections = data || [];

  renderStudent();
  renderAdmin();
}

/* =========================
   SCHÜLERSEITE
   ========================= */

function renderStudent() {
  const studentContent = document.getElementById("studentContent");

  if (!studentContent) return;

  if (!corrections.length) {
    studentContent.innerHTML = `
      <div class="card empty">
        <h2>Keine Korrekturen eingetragen</h2>
        <p>Momentan sind keine Korrekturen hinterlegt.</p>
      </div>
    `;
    return;
  }

  const current = corrections[0];

  const progress = Math.min(
    100,
    Math.round((current.korrigiert / current.gesamt) * 100)
  );

  studentContent.innerHTML = `
    <section class="current">
      <p class="eyebrow">Aktuell an der Reihe</p>

      <h2>${escapeHtml(current.name)}</h2>

      <p>Klasse ${escapeHtml(current.klasse)}</p>

      <div class="progress-wrap">

        <div class="progress-meta">
          <span>
            ${current.korrigiert} von ${current.gesamt} korrigiert
          </span>

          <span>${progress}%</span>
        </div>

        <div class="progress">
          <div style="width:${progress}%"></div>
        </div>

      </div>
    </section>

    <div class="card">

      <div class="section-title">
        <h3>Korrektur-Reihenfolge</h3>
      </div>

      <ol class="order-list">

        ${corrections.map((item, index) => {

          const done = item.korrigiert >= item.gesamt;

          return `
            <li class="order-item ${index === 0 ? "current-item" : ""}">

              <div class="number">
                ${index + 1}
              </div>

              <div>
                <div class="item-title">
                  ${escapeHtml(item.name)}
                </div>

                <div class="item-sub">
                  Klasse ${escapeHtml(item.klasse)}
                </div>
              </div>

              <span class="badge ${done ? "done" : ""}">
                ${done
                  ? "fertig"
                  : `${item.korrigiert}/${item.gesamt}`}
              </span>

            </li>
          `;

        }).join("")}

      </ol>

    </div>
  `;
}


/* =========================
   VERWALTUNG
   ========================= */

function setupAdmin() {

  const loginForm = document.getElementById("loginForm");
  const logoutButton = document.getElementById("logoutButton");
  const addForm = document.getElementById("addForm");

  if (!loginForm || !addForm) return;

  loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const loginMessage =
      document.getElementById("loginMessage");

    loginMessage.textContent = "Anmeldung läuft …";

    const email =
      document.getElementById("email").value.trim();

    const password =
      document.getElementById("password").value;

    const { error } =
      await db.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      loginMessage.textContent =
        "Anmeldung fehlgeschlagen.";
      return;
    }

    loginMessage.textContent = "";

    updateAdminVisibility();
    await loadCorrections();
  });


  logoutButton.addEventListener("click", async () => {

    await db.auth.signOut();

    updateAdminVisibility();

  });


  addForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const name =
      document.getElementById("name").value.trim();

    const klasse =
      document.getElementById("klasse").value.trim();

    const gesamt =
      Number(document.getElementById("gesamt").value);

    const nextPosition = corrections.length
      ? Math.max(
          ...corrections.map(item => item.position)
        ) + 1
      : 1;

    const { error } = await db
      .from("korrekturen")
      .insert({
        name,
        klasse,
        gesamt,
        korrigiert: 0,
        position: nextPosition
      });

    const adminMessage =
      document.getElementById("adminMessage");

    if (error) {

      adminMessage.textContent =
        "Fehler beim Speichern.";

      console.error(error);

      return;
    }

    addForm.reset();

    adminMessage.textContent =
      "Korrektur wurde hinzugefügt.";

    await loadCorrections();
  });

}


async function updateAdminVisibility() {

  const loginBox =
    document.getElementById("loginBox");

  const adminContent =
    document.getElementById("adminContent");

  const logoutButton =
    document.getElementById("logoutButton");

  if (!loginBox || !adminContent) return;

  const { data } =
    await db.auth.getSession();

  if (data.session) {

    loginBox.classList.add("hidden");

    adminContent.classList.remove("hidden");

    if (logoutButton) {
      logoutButton.classList.remove("hidden");
    }

  } else {

    loginBox.classList.remove("hidden");

    adminContent.classList.add("hidden");

    if (logoutButton) {
      logoutButton.classList.add("hidden");
    }

  }

}


async function changeProgress(id, amount) {

  const item =
    corrections.find(x => x.id === id);

  if (!item) return;

  const neuerWert = Math.max(
    0,
    Math.min(
      item.gesamt,
      item.korrigiert + amount
    )
  );

  const { error } = await db
    .from("korrekturen")
    .update({
      korrigiert: neuerWert
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  await loadCorrections();
}


async function resetProgress(id) {

  const item =
    corrections.find(x => x.id === id);

  if (!item) return;

  const { error } = await db
    .from("korrekturen")
    .update({
      korrigiert: 0
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  await loadCorrections();
}


async function deleteCorrection(id) {

  if (!confirm("Diesen Eintrag wirklich löschen?")) {
    return;
  }

  const { error } = await db
    .from("korrekturen")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  await loadCorrections();
}


async function moveCorrection(id, direction) {

  const index =
    corrections.findIndex(x => x.id === id);

  const otherIndex =
    index + direction;

  if (
    index < 0 ||
    otherIndex < 0 ||
    otherIndex >= corrections.length
  ) {
    return;
  }

  const current =
    corrections[index];

  const other =
    corrections[otherIndex];

  await db
    .from("korrekturen")
    .update({
      position: other.position
    })
    .eq("id", current.id);

  await db
    .from("korrekturen")
    .update({
      position: current.position
    })
    .eq("id", other.id);

  await loadCorrections();
}


function renderAdmin() {

  const adminList =
    document.getElementById("adminList");

  if (!adminList) return;

  if (!corrections.length) {

    adminList.innerHTML =
      `<div class="empty">
        Noch keine Korrekturen.
      </div>`;

    return;
  }

  adminList.innerHTML =
    corrections.map((item, index) => `

      <div class="admin-row">

        <div>

          <strong>
            ${index + 1}. ${escapeHtml(item.name)}
          </strong>

          <div class="item-sub">
            Klasse ${escapeHtml(item.klasse)}
            · ${item.korrigiert}/${item.gesamt}
          </div>

        </div>

        <div class="admin-actions">

          <button
            class="secondary small"
            onclick="moveCorrection(${item.id}, -1)"
            ${index === 0 ? "disabled" : ""}
          >
            ↑
          </button>

          <button
            class="secondary small"
            onclick="moveCorrection(${item.id}, 1)"
            ${index === corrections.length - 1 ? "disabled" : ""}
          >
            ↓
          </button>

          <button
            class="secondary small"
            onclick="changeProgress(${item.id}, -1)"
          >
            −1
          </button>

          <button
            class="primary small"
            onclick="changeProgress(${item.id}, 1)"
          >
            +1
          </button>

          <button
            class="secondary small"
            onclick="resetProgress(${item.id})"
          >
            0
          </button>

          <button
            class="secondary small danger"
            onclick="deleteCorrection(${item.id})"
          >
            Löschen
          </button>

        </div>

      </div>

    `).join("");
}


/* =========================
   START
   ========================= */

setupAdmin();
loadCorrections();
updateAdminVisibility();


/* =========================
   LIVE-AKTUALISIERUNG
   ========================= */

db.channel("korrektur-counter")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "korrekturen"
    },
    () => loadCorrections()
  )
  .subscribe();
