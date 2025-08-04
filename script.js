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
  "aperol":         { kcal: 35, sugar: 4.5, carbs: 4.5 },
  "campari":        { kcal: 70, sugar: 5.0, carbs: 5.0 },
  "triple sec":     { kcal: 86, sugar: 7.2, carbs: 7.2 },
  "amaretto":       { kcal: 94, sugar: 9.0, carbs: 9.0 },
  "coffee liqueur": { kcal: 80, sugar: 8.0, carbs: 8.0 },
  "irish cream":    { kcal: 100, sugar: 7.0, carbs: 7.0 },
  "sweet vermouth": { kcal: 45, sugar: 4.0, carbs: 4.0 },
  "dry vermouth":   { kcal: 35, sugar: 0.4, carbs: 0.4 }
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
    input.addEventListener("input", handler);
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
// Dilution model (realistic; two-stage)
// ===============================

// Prep dilution (happens while making the drink; independent of serving ice)
const PREP_DILUTION = {
  shaken_with_ice:  0.40,
  stirred_with_ice: 0.28,
  built_over_ice:   0.12,
  built_neat:       0.00
};

// Service melt (happens in the glass over time; 15–20 min baseline fractions)
const SERVICE_MELT = {
  crushed:    0.060,
  small_cube: 0.035, // ~1–1.25" cubes, ~4 pieces in rocks baseline
  top_hat:    0.032, // Hoshizaki AM top-hat (~6 pieces in rocks baseline)
  large_cube: 0.025, // single 2" clear cube
  none:       0.000
};

// Time multipliers (presets)
const TIME_MULT = { shot: 0.9, sipped: 1.0, nursed: 1.1 };

// Default piece counts by GLASS × ICE (typical packed service)
const GLASS_ICE_PIECES = {
  rocks:   { crushed: 1, small_cube: 4,  top_hat: 6,  large_cube: 1, none: 0 },
  coupe:   { crushed: 0, small_cube: 0,  top_hat: 0,  large_cube: 0, none: 0 }, // usually no ice
  martini: { crushed: 0, small_cube: 0,  top_hat: 0,  large_cube: 0, none: 0 }, // no ice
  wine:    { crushed: 1, small_cube: 8,  top_hat: 10, large_cube: 0, none: 0 }, // spritz/full ice wine glass
  pint:    { crushed: 1, small_cube: 12, top_hat: 14, large_cube: 2, none: 0 }, // tall & packed
  collins: { crushed: 1, small_cube: 8,  top_hat: 10, large_cube: 0, none: 0 }  // highball/collins
};

// Sub-linear scaling so more pieces => more melt, with diminishing returns
function pieceMultiplier(pieces, baselinePieces) {
  const base = baselinePieces || 1;
  if (!base || !pieces) return 1;
  return Math.sqrt(pieces / base);
}

function getFractions(prepMethod, dilutionTime, iceType, glassType) {
  const prepBase  = PREP_DILUTION[prepMethod] ?? 0;
  const t         = TIME_MULT[dilutionTime] ?? 1.0;

  // Prep dilution (independent of serving ice)
  const prepFrac  = prepBase * t;

  // Service melt (depends on glass & ice)
  const baseSvc   = SERVICE_MELT[iceType] ?? 0;
  const glassMap  = GLASS_ICE_PIECES[glassType] || GLASS_ICE_PIECES.rocks;
  const pieces    = (glassMap && iceType in glassMap) ? glassMap[iceType] : 0;
  const svcMult   = pieceMultiplier(pieces, pieces); // table value is baseline → multiplier = 1
  const serviceFrac = baseSvc * t * svcMult;

  return { prepFrac, serviceFrac };
}

// ===============================
// Rims (optional)
// ===============================
const RIM_DEFAULTS = {
  sugar_full: { sugarG: 6.0,  carbsG: 6.0,  kcal: 24, sodiumMg: 0   },
  sugar_half: { sugarG: 3.0,  carbsG: 3.0,  kcal: 12, sodiumMg: 0   },
  salt_full:  { sugarG: 0.0,  carbsG: 0.0,  kcal: 0,  sodiumMg: 500 },
  salt_half:  { sugarG: 0.0,  carbsG: 0.0,  kcal: 0,  sodiumMg: 250 },
  tajin_full: { sugarG: 0.5,  carbsG: 0.5,  kcal: 2,  sodiumMg: 300 },
  tajin_half: { sugarG: 0.25, carbsG: 0.25, kcal: 1,  sodiumMg: 150 },
  none:       { sugarG: 0.0,  carbsG: 0.0,  kcal: 0,  sodiumMg: 0   }
};

// ===============================
// Submit handler (shows Start & End)
// ===============================
document.getElementById("drink-form").addEventListener("submit", function (e) {
  e.preventDefault();

  let preVolumeOz = 0;     // volume before any dilution
  let totalAlcoholMl = 0;  // pure ethanol ml
  let totalSugarG = 0;
  let totalFatG = 0;
  let totalCarbsG = 0;
  let totalSodiumMg = 0;
  let mixerKcal = 0;       // mixer + liqueur kcal

  // ---- Alcohols ----
  document.querySelectorAll("#alcohol-list .ingredient-row").forEach(row => {
    const name  = norm(row.querySelector(".alcohol-name")?.value);
    const abvVal = parseFloat(row.querySelector(".alcohol-abv")?.value);
    const volOz  = parseFloat(row.querySelector(".alcohol-volume")?.value);
    if (isNaN(abvVal) || isNaN(volOz) || volOz <= 0) return;

    const abv = abvVal / 100;
    const volMl = volOz * OZ_TO_ML;

    preVolumeOz    += volOz;
    totalAlcoholMl += volMl * abv;

    const liq = LIQUEUR_DEFAULTS[name];
    if (liq) {
      totalSugarG += (liq.sugar || 0) * volOz;
      totalCarbsG += (liq.carbs || liq.sugar || 0) * volOz;
      mixerKcal   += (liq.kcal  || 0) * volOz;
    }
  });

  // ---- Mixers ----
  document.querySelectorAll("#mixer-list .ingredient-row").forEach(row => {
    const name  = norm(row.querySelector(".mixer-name")?.value);
    const volOz = parseFloat(row.querySelector(".mixer-volume")?.value);
    if (isNaN(volOz) || volOz <= 0) return;

    const def = MIXER_DEFAULTS[name] || { kcal: 0, sugar: 0, carbs: 0, fat: 0, sodium: 0 };

    preVolumeOz  += volOz;
    totalSugarG  += def.sugar  * volOz;
    totalCarbsG  += def.carbs  * volOz;
    totalFatG    += def.fat    * volOz;
    totalSodiumMg+= def.sodium * volOz;
    mixerKcal    += def.kcal   * volOz;
  });

  // ---- Dilution fractions ----
  const prepMethod   = document.getElementById("prep-method").value;
  const dilutionTime = document.getElementById("dilution-time").value;
  const iceType      = document.getElementById("ice-type").value;
  const glassType    = document.getElementById("glass-type")?.value || "rocks";
  const rimOption    = document.getElementById("rim-option")?.value || "none";

  const { prepFrac, serviceFrac } = getFractions(prepMethod, dilutionTime, iceType, glassType);

  // ---- Add rim contributions (doesn't change volume)
  const rim = RIM_DEFAULTS[rimOption] || RIM_DEFAULTS.none;
  totalSugarG   += rim.sugarG;
  totalCarbsG   += rim.carbsG;
  totalSodiumMg += rim.sodiumMg;
  const rimKcal  = rim.kcal;

  // ---- Volumes: start (after prep) and end (after prep + service)
  const startVolOz = preVolumeOz * (1 + prepFrac);
  const endVolOz   = preVolumeOz * (1 + prepFrac + serviceFrac);

  // ---- ABV: start & end
  const startABV = startVolOz > 0 ? (totalAlcoholMl / (startVolOz * OZ_TO_ML)) * 100 : 0;
  const endABV   = endVolOz   > 0 ? (totalAlcoholMl / (endVolOz   * OZ_TO_ML)) * 100 : 0;

  // ---- Calories (water doesn't change kcal)
  const kcalAlcohol = totalAlcoholMl * ETHANOL_DENSITY * 7 / 1000 * 1000;
  const totalKcal   = kcalAlcohol + mixerKcal + rimKcal;

  // ---- Render ----
  const html = `
    <h2>Results</h2>
    <p><strong>Starting Volume (at serve):</strong> ${startVolOz.toFixed(2)} oz</p>
    <p><strong>Starting ABV (at serve):</strong> ${startABV.toFixed(1)}%</p>

    <p><strong>Ending Volume (end of drink):</strong> ${endVolOz.toFixed(2)} oz</p>
    <p><strong>Ending ABV (end of drink):</strong> ${endABV.toFixed(1)}%</p>

    <p><strong>Total Dilution Added:</strong> +${(endVolOz - preVolumeOz).toFixed(2)} oz</p>

    <p><strong>Calories:</strong> ${totalKcal.toFixed(0)} kcal</p>
    <p><strong>Sugar:</strong> ${totalSugarG.toFixed(1)} g</p>
    <p><strong>Carbs:</strong> ${totalCarbsG.toFixed(1)} g</p>
    <p><strong>Fat:</strong> ${totalFatG.toFixed(1)} g</p>
    <p><strong>Sodium:</strong> ${totalSodiumMg.toFixed(0)} mg</p>
    ${glassType ? `<p><strong>Glass:</strong> ${glassType.replace('_',' ')}</p>` : ""}
    ${rimOption && rimOption !== 'none' ? `<p><strong>Rim:</strong> ${rimOption.replace('_',' ').replace('tajin','Tajín')}</p>` : ""}
  `;
  document.getElementById("results").innerHTML = html;
});
