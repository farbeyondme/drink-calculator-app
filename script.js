// ---- Auto-fill ABV for known alcohols ----
const ALCOHOL_DEFAULTS = {
  "vodka": 40, "gin": 40, "rum": 40, "tequila": 40, "whisky": 40, "whiskey": 40,
  "bourbon": 45, "rye": 45, "scotch": 40, "mezcal": 42, "cognac": 40, "brandy": 40,
  "aperol": 11, "campari": 24, "triple sec": 30, "amaretto": 28, "coffee liqueur": 20,
  "irish cream": 17, "sweet vermouth": 16, "dry vermouth": 18,
  "light lager": 4.2, "lager": 5, "stout": 6
};

function norm(s){ return (s||"").toString().trim().toLowerCase(); }

function wireAlcoholAutoABV(container = document) {
  container.querySelectorAll(".alcohol-name").forEach(input => {
    if (input._hasABVHandler) return; // avoid double-binding
    input._hasABVHandler = true;

    input.addEventListener("change", () => {
      const name = norm(input.value);
      const row = input.closest(".ingredient-row");
      if (!row) return;
      const abvField = row.querySelector(".alcohol-abv");
      const guess = ALCOHOL_DEFAULTS[name];
      if (guess && (!abvField.value || Number(abvField.value) === 0)) {
        abvField.value = guess; // auto-fill ABV if empty
      }
    });
  });
}

// Wire existing row(s) on load
document.addEventListener("DOMContentLoaded", () => {
  wireAlcoholAutoABV(document);
});

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
    <input type="text" class="mixer-name" placeholder="e.g. OJ" required />
    <input type="number" class="mixer-sugar" placeholder="Sugar (g/oz)" min="0" step="0.1" />
    <input type="number" class="mixer-volume" placeholder="oz" min="0" step="0.1" required />
  `;
  document.getElementById("mixer-list").appendChild(div);
}

function getDilutionFactor(prepMethod, dilutionTime, iceType) {
  // Estimated dilution % based on method, time, and ice type
  const base = {
    shaken_neat: 0.17,
    shaken_over_ice: 0.20,
    stirred_neat: 0.12,
    stirred_over_ice: 0.15,
    built_over_ice: 0.10,
    built_neat: 0.0,
    built_neat_served_ice: 0.10
  }[prepMethod] || 0;

  const timeMult = {
    shot: 0.9,
    sipped: 1.0,
    nursed: 1.1
  }[dilutionTime] || 1;

  const iceMult = {
    crushed: 1.25,
    small_cube: 1.0,
    large_cube: 0.85,
    top_hat: 0.75,
    none: 0
  }[iceType] || 1;

  return base * timeMult * iceMult;
}
// ---- Auto-fill ABV for known alcohols ----
const ALCOHOL_DEFAULTS = {
  "vodka": 40, "gin": 40, "rum": 40, "tequila": 40, "whisky": 40, "whiskey": 40,
  "bourbon": 45, "rye": 45, "scotch": 40, "mezcal": 42, "cognac": 40, "brandy": 40,
  "aperol": 11, "campari": 24, "triple sec": 30, "amaretto": 28, "coffee liqueur": 20,
  "irish cream": 17, "sweet vermouth": 16, "dry vermouth": 18,
  "light lager": 4.2, "lager": 5, "stout": 6
};

function norm(s){ return (s||"").toString().trim().toLowerCase(); }

function wireAlcoholAutoABV(container = document) {
  container.querySelectorAll(".alcohol-name").forEach(input => {
    if (input._hasABVHandler) return; // avoid double-binding
    input._hasABVHandler = true;

    input.addEventListener("change", () => {
      const name = norm(input.value);
      const row = input.closest(".ingredient-row");
      if (!row) return;
      const abvField = row.querySelector(".alcohol-abv");
      const guess = ALCOHOL_DEFAULTS[name];
      if (guess && (!abvField.value || Number(abvField.value) === 0)) {
        abvField.value = guess; // auto-fill ABV if empty
      }
    });
  });
}

// Wire existing rows on load
document.addEventListener("DOMContentLoaded", () => {
  wireAlcoholAutoABV(document);
});
document.getElementById("drink-form").addEventListener("submit", function (e) {
  e.preventDefault();

  let totalVolume = 0;
  let totalAlcoholMl = 0;
  let totalSugarG = 0;
  let totalFatG = 0;
  let totalCarbsG = 0;
  let totalSodiumMg = 0;

  // Alcohols
  const alcohols = document.querySelectorAll("#alcohol-list .ingredient-row");
  alcohols.forEach(row => {
    const abv = parseFloat(row.querySelector(".alcohol-abv").value) / 100;
    const volOz = parseFloat(row.querySelector(".alcohol-volume").value);
    const volMl = volOz * 29.5735;
    const alcMl = volMl * abv;

    totalVolume += volOz;
    totalAlcoholMl += alcMl;

    // Estimate nutrition (per oz): 64 cal, 0g sugar/fat/carbs/sodium for spirits
    totalFatG += 0;
    totalCarbsG += 0;
    totalSugarG += 0;
    totalSodiumMg += 0;
  });

  // Mixers
  const mixers = document.querySelectorAll("#mixer-list .ingredient-row");
  mixers.forEach(row => {
    const volOz = parseFloat(row.querySelector(".mixer-volume").value);
    const sugarPerOz = parseFloat(row.querySelector(".mixer-sugar").value) || 0;
    totalVolume += volOz;
    totalSugarG += sugarPerOz * volOz;
    totalCarbsG += sugarPerOz * volOz; // Simple assumption: sugar = carbs
  });

  const prepMethod = document.getElementById("prep-method").value;
  const dilutionTime = document.getElementById("dilution-time").value;
  const iceType = document.getElementById("ice-type").value;

  const dilutionFactor = getDilutionFactor(prepMethod, dilutionTime, iceType);
  const dilutionVolume = totalVolume * dilutionFactor;
  totalVolume += dilutionVolume;

  const abv = (totalAlcoholMl / (totalVolume * 29.5735)) * 100;
  const kcalFromAlcohol = totalAlcoholMl * 0.789 * 7 / 1000 * 1000; // kcal from grams alcohol
  const kcalFromSugar = totalSugarG * 4;
  const totalKcal = kcalFromAlcohol + kcalFromSugar;

  const results = `
    <h2>Results</h2>
    <p><strong>Total Volume:</strong> ${totalVolume.toFixed(2)} oz</p>
    <p><strong>ABV:</strong> ${abv.toFixed(1)}%</p>
    <p><strong>Calories:</strong> ${totalKcal.toFixed(0)} kcal</p>
    <p><strong>Sugar:</strong> ${totalSugarG.toFixed(1)} g</p>
    <p><strong>Carbs:</strong> ${totalCarbsG.toFixed(1)} g</p>
    <p><strong>Fat:</strong> ${totalFatG.toFixed(1)} g</p>
    <p><strong>Sodium:</strong> ${totalSodiumMg.toFixed(0)} mg</p>
    <p><em>Dilution: +${dilutionVolume.toFixed(2)} oz</em></p>
  `;

  document.getElementById("results").innerHTML = results;
});
