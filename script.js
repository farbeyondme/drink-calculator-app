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

// Nutrition defaults for liqueurs (per oz). Approximations; refine later as needed.
const LIQUEUR_DEFAULTS = {
  "aperol":         { kcal: 35, sugar: 4.5, carbs: 4.5 },  // ~11% abv
  "campari":        { kcal: 70, sugar: 5.0, carbs: 5.0 },  // ~24% abv
  "triple sec":     { kcal: 86, sugar: 7.2, carbs: 7.2 },  // ~30% abv
  "amaretto":       { kcal: 94, sugar: 9.0, carbs: 9.0 },  // ~28% abv
  "coffee liqueur": { kcal: 80, sugar: 8.0, carbs: 8.0 },  // Kahlua-ish
  "irish cream":    { kcal: 100, sugar: 7.0, carbs: 7.0 }, // Baileys-ish
  "sweet vermouth": { kcal: 45, sugar: 4.0, carbs: 4.0 },  // ~16% abv
  "dry vermouth":   { kcal: 35, sugar: 0.4, carbs: 0.4 }   // ~18% abv
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

    const handler = () => {
      const name = norm(input.value);
      const row = input.closest(".ingredient-row");
      if (!row) return;
      const abvField = row.querySelector(".alcohol-abv");
      const guess = ALCOHOL_DEFAULTS[name];
      if (guess && !abvField._manual) abvField.value = guess;
    };

    input.addEventListener("change", handler);
    input.addEventListener("input", handler); // ensure it fills while typing
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
  // Base dilution from how it’s made (prep stage, independent of serving ice)
  const baseByMethod = {
    shaken_with_ice:   0.18, // shake with ice, then strain (neat or over ice later)
    stirred_with_ice:  0.12, // stir with ice, then strain
    built_over_ice:    0.10, // assembled over ice (prep already has ice)
    built_neat:        0.00  // assembled without ice
  };

  const drinkTimeMult = { shot: 0.9, sipped: 1.0, nursed: 1.1 };

  // Extra melt from being served over ice (service stage), applies even if built_neat
  const serviceMeltByIce = {
    crushed:    0.06,
    small_cube: 0.03,
    large_cube: 0.02,
    top_hat:    0.015,
    none:       0.00
  };

  const base = baseByMethod[prepMethod] ?? 0;
  const timeMult = drinkTimeMult[dilutionTime] ?? 1.0;

  const basePortion = base * timeMult; // prep-stage melt (always applies for shaken/stirred/built_over_ice)

  const servicePortion = (iceType !== 'none')
    ? (serviceMeltByIce[iceType] ?? 0) * timeMult
    : 0;

  return basePortion + servicePortion; // fraction of pre-dilution volume
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
  let mixerKcal = 0; // includes mixer kcal and liqueur kcal

  // ---- Alcohols (skip empty rows); add liqueur sugar/kcal if applicable ----
  document.querySelectorAll("#alcohol-list .ingredient-row").forEach(row => {
    const name  = norm(row.querySelector(".alcohol-name")?.value);
    const abvVal = parseFloat(row.querySelector(".alcohol-abv")?.value);
    const volOz  = parseFloat(row.querySelector(".alcohol-volume")?.value);
    if (isNaN(abvVal) || isNaN(volOz) || volOz <= 0) return;

    const abv = abvVal / 100;
    const volMl = volOz * OZ_TO_ML;

    totalVolumeOz  += volOz;
    totalAlcoholMl += volMl * abv;

    // If this alcohol is a liqueur, include its sugar/kcal per oz
    const liq = LIQUEUR_DEFAULTS[name];
    if (liq) {
      totalSugarG += (liq.sugar || 0) * volOz;
      totalCarbsG += (liq.carbs || liq.sugar || 0) * volOz;
      mixerKcal   += (liq.kcal  || 0) * volOz;
    }
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

  // kcal from alcohol: ml -> grams (0.789 g/ml) * 7 kcal/g
  const kcalAlcohol = totalAlcoholMl * ETHANOL_DENSITY * 7 / 1000 * 1000;

  // Use mixerKcal (includes mixer + liqueur kcal) to avoid double-counting sugar
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
