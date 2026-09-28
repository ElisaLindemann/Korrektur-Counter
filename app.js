dCorrections();
}

async function moveCorrection(id, direction) {
  const index = corrections.findIndex(x => x.id === id);
  const otherIndex = index + direction;

  if (
    index < 0 ||
    otherIndex < 0 ||
    otherIndex >= corrections.length
  ) {
    return;
  }

  const current = corrections[index];
  const other = corrections[otherIndex];

  await db
    .from("korrekturen")
    .update({ position: other.position })
    .eq("id", current.id);

  await db
    .from("korrekturen")
    .update({ position: current.position })
    .eq("id", other.id);

  await loadCorrections();
}

function renderAdmin() {
  if (!corrections.length) {
    adminList.innerHTML =
      `<div class="empty">Noch keine Korrekturen.</div>`;
    return;
  }

  adminList.innerHTML = corrections.map((item, index) => `
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
        >↑</button>

        <button
          class="secondary small"
          onclick="moveCorrection(${item.id}, 1)"
          ${index === corrections.length - 1 ? "disabled" : ""}
        >↓</button>

        <button
          class="secondary small"
          onclick="changeProgress(${item.id}, -1)"
        >−1</button>

        <button
          class="primary small"
          onclick="changeProgress(${item.id}, 1)"
        >+1</button>

        <button
          class="secondary small"
          onclick="resetProgress(${item.id})"
        >0</button>

        <button
          class="secondary small danger"
          onclick="deleteCorrection(${item.id})"
        >Löschen</button>
      </div>
    </div>
  `).join("");
}

window.addEventListener("hashchange", updateMode);

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

loadCorrections();
updateMode();
