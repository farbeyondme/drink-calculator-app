// ===============================
// Auto-fill ABV for known alcohols
// ===============================
const ALCOHOL_DEFAULTS = {
  "vodka": 40, "gin": 40, "rum": 40, "tequila": 40, "whisky": 40, "whiskey": 40,
  "bourbon": 45, "rye": 45, "scotch": 40, "mezcal": 42, "cognac": 40, "brandy": 40,
  "aperol": 11, "campari": 24, "triple sec": 30, "amaretto": 28, "coffee liqueur": 20,
  "irish cream": 17, "sweet vermouth": 16, "dry vermouth": 18,
  "light lager": 4.2, "lager": 5, "stout": 6
};

// ---- Mixer per-oz nutrition defaults (kcal, sugar g, carbs g, fat g, sodium mg) ----
const MIXER_DEFAULTS = {
  "club soda":             { kcal: 0,  sugar: 0,   carbs: 0,   fat: 0, sodium: 0 },
  "tonic":                 { kcal: 10, sugar: 2.5, carbs: 3.0, fat: 0, sodium: 5 },
  "sugar-free tonic":      { kcal: 0,  sugar: 0,   carbs: 0,   fat: 0, sodium: 5 },
  "ginger ale":            { kcal: 12, sugar: 3.0, carbs: 3.5, fat: 0, sodium: 7 },
  "sugar-free ginger ale": { kcal: 0,  sugar: 0,   carbs: 0,   fat: 0, sodium: 5 },
  "orange juice":          { kcal: 14, sugar: 2.5, carbs: 3.5, fat: 0, sodium: 1 },
  "red bull":              { kcal: 13, sugar: 3.0, carbs: 3.5, fat: 0, sodium:10 },
  "sugar-free red bull":   { kcal: 1,  sugar: 0,   carbs: 0,   fat: 0, sodium:10 },
  "simple syrup":          { kcal: 50, sugar:13.0, carbs:13.0, fat: 0, sodium: 0 }
};

function norm(s){ return (s||"").toString().trim().toLowerCase(); }

// Track manual ABV edits so we don't overwrite user input later
function markManualABV(container = document) {
  container.querySelectorAll(".alcohol-abv").forEach(input => {
    if (input._hasManualFlag) return;
    input._hasManualFlag = true;
    input.addEventListener("input", () => { input._manual = true; });
  });
}

// Improved ABV auto-fill: only fill if user hasn't typed in that field
function wireAlcoholAutoABV(container = document) {
  markManualABV(container);
  container.querySelectorAll(".alcohol-name").forEach(input => {
    if (input._hasABVHandler) return; // avoid double-binding
    input._hasABVHandler = true;

    input.addEventListener("change", () => {
      const name = norm(input.value);
      const row = input.closest(".ingredient-row");
      if (!row) return;
      const abvField = row.querySelector(".alcohol-abv");
      const guess = ALCOHOL_DEFAULTS[name];
      if (guess && !abvField._manual) {
        abvField.value = guess; // set default unless user typed
      }
    });
  });
}

// Auto-fill mixer nutrition per-oz if user leaves sugar empty
function wireMixerAutoNutrition(container = document) {
  container.querySelectorAll(".mixer-name").forEach(input => {
    if (input._hasMixHandler) return;
    input._hasMixHandler = true;
    input.addEventListener("change", () => {
      const name = norm(input.value);
      const row = input.closest(".ingredient-row");
      if (!row) return;
      const sugarField = row.querySelector(".mixer-sugar");
      if (!sugarField.value || Number(sugarField.value) === 0) {
        const def = MIXER_DEFAULTS[name];
        if (def) sugarField.value = def.sugar; // show sugar g/oz to user
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireAlcoholAutoABV(document);
  wireMixerAutoNutrition(document);
});

// ===============================
// Add rows
// ===============================
function addAlcohol() {
  const div = document.createElement("div");
  div.className = "ingredient-row";
  div.innerHTML = `
    <input type="text" class="alcohol-name" list="alcohol-options" placeholder="e.g. Rum" required />
    <input type="number" class="alcohol-abv" placeholder="ABV (%)" min="0" max="100" step="0.1" required />
    <input type="number" class="alcohol-volume" placeholder="oz" min="0" step="0.1" required />
  `;
  document.getElementById("alcohol-list").appendChild(div);
  wireAlcoholAutoABV(div); // enable auto-fill on this new row
}

function addMixer() {
  const div = document.createElement("div");
  div.className = "ingredient-row";
  div.innerHTML = `
    <input type="text" class="mixer-name" list="mixer-options" placeholder="e.g. OJ" required />
    <input type="number" class="mixer-sugar" placeholder="Sugar (g/oz)" min="0" step="0.1" />
    <input type="number" class="mixer-volume" placeholder="oz" min="0" step="0.1" required />
  `;
  document.getElementById("mixer-list").appendChild(div);
  wireMixerAutoNutrition(div);
}

// ===============================
// Dilution model
// ===============================
function getDilutionFactor(prepMethod, dilutionTime, iceType) {
  // Base served dilution by method (before time/ice multipliers)
  const base = {
    shaken_neat:      0.17,
    shaken_over_ice:  0.20,
    stirred_neat:     0.12,
    stirred_over_ice: 0.15,
    built_over_ice:   0.10,
    built_neat:       0.00
  }[prepMethod] ?? 0;

  const timeMult = {
    shot:   0.9,
    sipped: 1.0,
    nursed: 1.1
  }[dilutionTime] ?? 1.0;

  const iceMult = {
    crushed:    1.25,
    small_cube: 1.00,
    large_cube: 0.85,
    top_hat:    0.75,
    none:       0.00
  }[iceType] ?? 1.0;

  return base * timeMult * iceMult;
}

// ===============================
// Submit handler
// ===============================
document.getElementById("drink-form").addEventListener("submit", function (e) {
  e.preventDefault();

  let totalVolumeOz = 0;
  let totalAlcoholMl = 0;
  let totalSugarG = 0;
  let totalFatG = 0;
  let totalCarbsG = 0;
  let totalSodiumMg = 0;
  let mixerKcal = 0; // calories from mixers (per-oz defaults)

  // ---- Alcohols ----
  document.querySelectorAll("#alcohol-list .ingredient-row").forEach(row => {
    const abvVal = parseFloat(row.querySelector(".alcohol-abv")?.value);
    const volOz  = parseFloat(row.querySelector(".alcohol-volume")?.value);
    if (isNaN(abvVal) || isNaN(volOz) || volOz <= 0) return; // skip incomplete

    const abv = abvVal / 100;
    const volMl = volOz * 29.5735;
    totalVolumeOz += volOz;
    totalAlcoholMl += volMl * abv;

    // Spirits: assume 0g sugar/fat/carbs/sodium per oz for now
  });

  // ---- Mixers ----
  document.querySelectorAll("#mixer-list .ingredient-row").forEach(row => {
    const name  = norm(row.querySelector(".mixer-name")?.value);
    const volOz = parseFloat(row.querySelector(".mixer-volume")?.value);
    if (isNaN(volOz) || volOz <= 0) return;

    const sugarPerOzInput = parseFloat(row.querySelector(".mixer-sugar")?.value);
    const def = MIXER_DEFAULTS[name] || { kcal: 0, sugar: 0, carbs: 0, fat: 0, sodium: 0 };

    const sugarPerOz  = isNaN(sugarPerOzInput) ? def.sugar : sugarPerOzInput;
    const kcalPerOz   = def.kcal;
    const carbsPerOz  = def.carbs ?? sugarPerOz; // fallback
    const fatPerOz    = def.fat || 0;
    const sodiumPerOz = def.sodium || 0;

    totalVolumeOz += volOz;
    totalSugarG   += sugarPerOz  * volOz;
    totalCarbsG   += carbsPerOz  * volOz;
    totalFatG     += fatPerOz    * volOz;
    totalSodiumMg += sodiumPerOz * volOz;
    mixerKcal     += kcalPerOz   * volOz;
  });

  // ---- Dilution ----
  const prepMethod   = document.getElementById("prep-method").value;
  const dilutionTime = document.getElementById("dilution-time").value;
  const iceType      = document.getElementById("ice-type").value;
  const glassType    = document.getElementById("glass-type")?.value || null;

  const dilutionFactor = getDilutionFactor(prepMethod, dilutionTime, iceType);
  const dilutionOz = totalVolumeOz * dilutionFactor;
  const finalVolOz = totalVolumeOz + dilutionOz;

  // (Optional future: GLASS_OZ mapping if we want to cap or tweak)
  // const GLASS_OZ = { rocks:8, coupe:6, wine:12, pint:16, collins:12, nick_nora:5 };

  // ---- ABV & Calories ----
  const abvPct = finalVolOz > 0 ? (totalAlcoholMl / (finalVolOz * 29.5735)) * 100 : 0;

  // kcal from alcohol: alcohol ml -> grams (0.789 g/ml), *7 kcal/gram
  const kcalAlcohol = totalAlcoholMl * 0.789 * 7 / 1000 * 1000;

  // Choose one path to avoid double-counting:
  // We'll use mixerKcal for mixers (already accounts for sugar/etc.)
  const totalKcal = kcalAlcohol + mixerKcal;

  // ---- Render ----
  const html = `
    <h2>Results</h2>
    <p><strong>Total Volume:</strong> ${finalVolOz.toFixed(2)} oz</p>
    <p><strong>ABV:</strong> ${abvPct.toFixed(1)}%</p>
    <p><strong>Calories:</strong> ${totalKcal.toFixed(0)} kcal</p>
    <p><strong>Sugar:</strong> ${totalSugarG.toFixed(1)} g</p>
    <p><strong>Carbs:</strong> ${totalCarbsG.toFixed(1)} g</p>
    <p><strong>Fat:</strong> ${totalFatG.toFixed(1)} g</p>
    <p><strong>Sodium:</strong> ${totalSodiumMg.toFixed(0)} mg</p>
    ${glassType ? `<p><strong>Glass:</strong> ${glassType.replace('_',' ')}</p>` : ""}
    <p><em>Dilution added: +${dilutionOz.toFixed(2)} oz</em></p>
  `;

  document.getElementById("results").innerHTML = html;
});
