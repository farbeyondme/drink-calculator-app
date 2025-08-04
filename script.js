// ===============================
// Defaults & helpers
// ===============================

// Typical ABV (%) for common alcohols (used to auto-fill ABV)
const ALCOHOL_DEFAULTS = {
  "vodka": 40, "gin": 40, "rum": 40, "tequila": 40, "whisky": 40, "whiskey": 40,
  "bourbon": 45, "rye": 45, "scotch": 40, "mezcal": 42, "cognac": 40, "brandy": 40,
  "aperol": 11, "campari": 24, "triple sec": 30, "amaretto": 28, "coffee liqueur": 20,
  "irish cream": 17, "sweet vermouth": 16, "dry vermouth": 18,
  "light lager": 4.2, "lager": 5, "stout": 6
};

// Mixer per-oz nutrition (approx): kcal, sugar g, carbs g, fat g, sodium mg
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

const OZ_TO_ML = 29.5735;
const ETHANOL_DENSITY = 0.789; // g/ml

function norm(s){ return (s||"").toString().trim().toLowerCase(); }

// ===============================
// Auto-fill ABV on alcohol name selection
// ===============================
function markManualABV(container = document) {
  container.querySelectorAll(".alcohol-abv").forEach(input => {
    if (input._hasManualFlag) return;
    input._hasManualFlag = true;
    input.addEventListener("input", () => { input._manual = true; });
  });
}

function wireAlcoholAutoABV(container = document) {
  markManualABV(container);
  container.querySelectorAll(".alcohol-name").forEach(input => {
    if (input._hasABVHandler) return;
    input._hasABVHandler = true;
    input.addEventListener("change", () => {
      const name = norm(input.value);
      const row = input.closest(".ingredient-row");
      if (!row) return;
      const abvField = row.querySelector(".alcohol-abv");
      const guess = ALCOHOL_DEFAULTS[name];
      if (guess && !abvField._manual) abvField.value = guess;
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireAlcoholAutoABV(document);
});

// ===============================
// Add rows
// ===============================
function addAlcohol() {
  const div = document.createElement("div");
  div.className = "ingredient-row";
  div.innerHTML = `
    <input type="text" class="alcohol-name" list="alcohol-options" placeholder="e.g. Rum" />
    <input type="number" class="alcohol-abv" placeholder="ABV (%)" min="0" max="100" step="0.1" />
    <input type="number" class="alcohol-volume" placeholder="oz" min="0" step="0.1" />
  `;
  document.getElementById("alcohol-list").appendChild(div);
  wireAlcoholAutoABV(div);
}

function addMixer() {
  const div = document.createElement("div");
  div.className = "ingredient-row mixer-row";
  div.innerHTML = `
    <input type="text" class="mixer-name" list="mixer-options" placeholder="e.g. Club Soda" />
    <input type="number" class="mixer-volume" placeholder="oz" min="0" step="0.1" />
  `;
  document.getElementById("mixer-list").appendChild(div);
}

// ===============================
// Dilution model (4 methods total)
// ===============================
function getDilutionFactor(prepMethod, dilutionTime, iceType) {
  // Base served dilution from making the drink
  const base = {
    shaken:         0.18,
    stirred:        0.12,
    built_over_ice: 0.10,
    built_neat:     0.00
  }[prepMethod] ?? 0;

  // Drinking-time multiplier
  const timeMult = {
    shot:   0.9,
    sipped: 1.0,
    nursed: 1.1
  }[dilutionTime] ?? 1.0;

  // Additional melt from being served over ice.
  // If served neat (iceType === 'none'), multiplier = 1.0 (don’t erase base).
  const iceMult = {
    crushed:    1.25,
    small_cube: 1.00,
    large_cube: 0.85,
    top_hat:    0.75,
    none:       1.00
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
  let mixerKcal = 0;

  // ---- Alcohols (skip empty rows) ----
  document.querySelectorAll("#alcohol-list .ingredient-row").forEach(row => {
    const abvVal = parseFloat(row.querySelector(".alcohol-abv")?.value);
    const volOz  = parseFloat(row.querySelector(".alcohol-volume")?.value);
    if (isNaN(abvVal) || isNaN(volOz) || volOz <= 0) return;

    const abv = abvVal / 100;
    const volMl = volOz * OZ_TO_ML;

    totalVolumeOz  += volOz;
    totalAlcoholMl += volMl * abv;
    // Spirits assumed 0g sugar/fat/carbs/sodium for now
  });

  // ---- Mixers (use defaults; no user sugar entry required) ----
  document.querySelectorAll("#mixer-list .ingredient-row").forEach(row => {
    const name  = norm(row.querySelector(".mixer-name")?.value);
    const volOz = parseFloat(row.querySelector(".mixer-volume")?.value);
    if (isNaN(volOz) || volOz <= 0) return;

    const def = MIXER_DEFAULTS[name] || { kcal: 0, sugar: 0, carbs: 0, fat: 0, sodium: 0 };

    totalVolumeOz += volOz;
    totalSugarG   += def.sugar  * volOz;
    totalCarbsG   += def.carbs  * volOz;
    totalFatG     += def.fat    * volOz;
    totalSodiumMg += def.sodium * volOz;
    mixerKcal     += def.kcal   * volOz;
  });

  // ---- Dilution ----
  const prepMethod   = document.getElementById("prep-method").value;   // 'shaken' | 'stirred' | 'built_over_ice' | 'built_neat'
  const dilutionTime = document.getElementById("dilution-time").value; // 'shot' | 'sipped' | 'nursed'
  const iceType      = document.getElementById("ice-type").value;      // 'none' | cube types
  const glassType    = document.getElementById("glass-type")?.value || null;

  const dilutionFactor = getDilutionFactor(prepMethod, dilutionTime, iceType);
  const dilutionOz = totalVolumeOz * dilutionFactor;
  const finalVolOz = totalVolumeOz + dilutionOz;

  // ---- ABV & Calories ----
  const abvPct = finalVolOz > 0 ? (totalAlcoholMl / (finalVolOz * OZ_TO_ML)) * 100 : 0;

  // kcal from alcohol: ml -> g (0.789 g/ml) * 7 kcal/g
  const kcalAlcohol = totalAlcoholMl * ETHANOL_DENSITY * 7 / 1000 * 1000;

  // Use mixerKcal for mixers to avoid double-counting sugar
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
