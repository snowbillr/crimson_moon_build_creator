const state = {
  weapons: [],
  shields: [],
  trinkets: [],
  selectedBoon: null,
  selectedWeaponArt: "",
};

const boonOptionsEl = document.getElementById("boon-options");
const boonHintEl = document.getElementById("boon-hint");
const weaponArtSelectEl = document.getElementById("weapon-art-select");
const resultSummaryEl = document.getElementById("result-summary");
const trinketResultsEl = document.getElementById("trinket-results");
const twoHandedResultsEl = document.getElementById("two-handed-results");
const oneHandedResultsEl = document.getElementById("one-handed-results");

init().catch((error) => {
  resultSummaryEl.textContent = `Failed to load data: ${error.message}`;
});

async function init() {
  const [weaponsRaw, trinkets] = await Promise.all([
    fetch("./weapons.json").then((response) => response.text()),
    fetch("./trinkets.json").then((response) => response.json()),
  ]);

  const weaponData = parseWeaponsData(weaponsRaw);

  state.weapons = weaponData.weapons ?? [];
  state.shields = weaponData.shields ?? [];
  state.trinkets = trinkets.filter((trinket) => trinket.boon);

  renderBoonOptions();
  renderWeaponArtOptions();
  renderResults();
}

function renderBoonOptions() {
  const boons = [...new Set(state.trinkets.map((trinket) => trinket.boon))].sort((a, b) =>
    a.localeCompare(b),
  );

  boonOptionsEl.innerHTML = boons
    .map(
      (boon) => `
      <label>
        <input type="checkbox" name="boon" value="${escapeHtml(boon)}" /> ${escapeHtml(boon)}
      </label>`,
    )
    .join("");

  boonOptionsEl.querySelectorAll('input[name="boon"]').forEach((checkbox) => {
    checkbox.addEventListener("change", onBoonChange);
  });
}

function renderWeaponArtOptions() {
  const arts = new Set();

  [...state.weapons, ...state.shields].forEach((item) => {
    if (item.weapon_art) {
      arts.add(item.weapon_art);
    }
  });

  [...arts]
    .sort((a, b) => a.localeCompare(b))
    .forEach((art) => {
      const option = document.createElement("option");
      option.value = art;
      option.textContent = art;
      weaponArtSelectEl.appendChild(option);
    });

  weaponArtSelectEl.addEventListener("change", () => {
    state.selectedWeaponArt = weaponArtSelectEl.value;
    renderResults();
  });
}

function onBoonChange(event) {
  const changed = event.target;
  if (changed.checked) {
    state.selectedBoon = changed.value;
    boonOptionsEl.querySelectorAll('input[name="boon"]').forEach((checkbox) => {
      if (checkbox !== changed) {
        checkbox.disabled = true;
      }
    });
    boonHintEl.textContent = "Only one boon can be selected because only one trinket can be equipped.";
  } else {
    state.selectedBoon = null;
    boonOptionsEl.querySelectorAll('input[name="boon"]').forEach((checkbox) => {
      checkbox.disabled = false;
    });
    boonHintEl.textContent = "";
  }

  renderResults();
}

function renderResults() {
  const oneHandWeapons = state.weapons.filter((weapon) => weapon.type.startsWith("1H"));
  const twoHandWeapons = state.weapons.filter(
    (weapon) => weapon.type === "Polearm" || weapon.type.startsWith("2H"),
  );

  if (!state.selectedWeaponArt) {
    resultSummaryEl.textContent = "Select a weapon art to see matching loadouts.";
    trinketResultsEl.innerHTML = "";
    twoHandedResultsEl.innerHTML = "";
    oneHandedResultsEl.innerHTML = "";
    return;
  }

  const selectedTrinkets = state.selectedBoon
    ? state.trinkets.filter((trinket) => trinket.boon === state.selectedBoon)
    : [];

  const validTwoHand = twoHandWeapons.filter((weapon) => weapon.weapon_art === state.selectedWeaponArt);

  const validOneHandPairs = [];
  for (const weapon of oneHandWeapons) {
    for (const shield of state.shields) {
      if (weapon.weapon_art === state.selectedWeaponArt || shield.weapon_art === state.selectedWeaponArt) {
        validOneHandPairs.push({ weapon, shield });
      }
    }
  }

  if (state.selectedBoon && !selectedTrinkets.length) {
    resultSummaryEl.textContent = `No valid loadouts found: no trinket grants ${state.selectedBoon}.`;
    trinketResultsEl.innerHTML = '<h3>Matching Trinket</h3><p class="muted">None</p>';
    twoHandedResultsEl.innerHTML = "";
    oneHandedResultsEl.innerHTML = "";
    return;
  }

  const totalLoadouts = validTwoHand.length + validOneHandPairs.length;
  resultSummaryEl.textContent =
    totalLoadouts > 0
      ? `Found ${totalLoadouts} valid loadout${totalLoadouts === 1 ? "" : "s"} for ${state.selectedWeaponArt}.`
      : `No valid loadouts found for ${state.selectedWeaponArt}.`;

  trinketResultsEl.innerHTML = state.selectedBoon
    ? `<h3>Matching Trinket</h3>${renderList(
        selectedTrinkets.map((item) => `${item.name ?? item.trinket} (${item.boon})`),
      )}`
    : `<h3>Trinket</h3><p class="muted">No boon selected. You may equip any one trinket.</p>`;

  twoHandedResultsEl.innerHTML = `<h3>2H Weapon Options</h3>${renderList(
    validTwoHand.map((weapon) => `${weapon.name} (${weapon.type})`),
  )}`;

  oneHandedResultsEl.innerHTML = `<h3>1H + Shield Options</h3>${renderList(
    validOneHandPairs.map((pair) => `${pair.weapon.name} + ${pair.shield.name}`),
  )}`;
}

function renderList(items) {
  if (!items.length) {
    return '<p class="muted">None</p>';
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseWeaponsData(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return { weapons: parsed, shields: [] };
    }
    return parsed;
  } catch {
    try {
      return JSON.parse(`{"weapons":${rawText}}`);
    } catch {
      throw new Error("Unsupported weapons.json format.");
    }
  }
}
