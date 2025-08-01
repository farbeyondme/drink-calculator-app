document.getElementById("drink-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const alcoholOz = parseFloat(document.getElementById("alcohol").value);
  const mixerOz = parseFloat(document.getElementById("mixer").value);
  const abvPercent = parseFloat(document.getElementById("abv").value);

  const totalOz = alcoholOz + mixerOz;
  const abvDecimal = abvPercent / 100;

  const drinkAbv = ((alcoholOz * abvDecimal) / totalOz) * 100;

  const alcoholCals = alcoholOz * abvDecimal * 1.6 * 100;
  const mixerCals = mixerOz * 10;
  const totalCals = Math.round(alcoholCals + mixerCals);

  document.getElementById("result-abv").textContent = drinkAbv.toFixed(1);
  document.getElementById("result-calories").textContent = totalCals;
  document.getElementById("results").classList.remove("hidden");
});
