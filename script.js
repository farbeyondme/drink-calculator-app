// Constants
const SPIRIT_TEMP = 76; // °F
const MIXER_TEMP = 40;  // °F

const alcoholData = {
  vodka: { abv: 40, caloriesPerOz: 64, sugar: 0, carbs: 0, fat: 0, sodium: 0 },
  gin: { abv: 40, caloriesPerOz: 64, sugar: 0, carbs: 0, fat: 0, sodium: 0 },
  rum: { abv: 40, caloriesPerOz: 64, sugar: 0, carbs: 0, fat: 0, sodium: 0 },
  tequila: { abv: 40, caloriesPerOz: 64, sugar: 0, carbs: 0, fat: 0, sodium: 0 },
  whisky: { abv: 40, caloriesPerOz: 70, sugar: 0, carbs: 0, fat: 0, sodium: 0 },
  lager: { abv: 5, caloriesPerOz: 13, sugar: 0.1, carbs: 1.1, fat: 0, sodium: 0 },
  'light lager': { abv: 4.2, caloriesPerOz: 9, sugar: 0.1, carbs: 0.5, fat: 0, sodium: 0 },
  'orange juice': { abv: 0, caloriesPerOz: 14, sugar: 2.5, carbs: 3.5, fat: 0, sodium: 1 },
  'club soda': { abv: 0, caloriesPerOz: 0, sugar: 0, carbs: 0, fat: 0, sodium: 0 },
  'simple syrup': { abv: 0, caloriesPerOz: 50, sugar: 13, carbs: 13, fat: 0, sodium: 0 },
  'sugar-free tonic': { abv: 0, caloriesPerOz: 0, sugar: 0, carbs: 0, fat: 0, sodium: 5 },
  'tonic': { abv: 0, caloriesPerOz: 10, sugar: 2.5, carbs: 3, fat: 0, sodium: 5 },
  'ginger ale': { abv: 0, caloriesPerOz: 12, sugar: 3, carbs: 3.5, fat: 0, sodium: 7 },
  'sugar-free ginger ale': { abv: 0, caloriesPerOz: 0, sugar: 0, carbs: 0, fat: 0, sodium: 5 },
  'red bull': { abv: 0, caloriesPerOz: 13, sugar: 3, carbs: 3.5, fat: 0, sodium: 10 },
  'sugar-free red bull': { abv: 0, caloriesPerOz: 1, sugar: 0, carbs: 0, fat: 0, sodium: 10 }
};

function calculateDilutionFactor(method, iceType, time) {
  // Estimate based on method, ice, and time
  const methodBase = {
    shaken: 0.15,
    stirred: 0.12,
    built: 0.05
  };

  const iceMultiplier = {
    'crushed': 1.3,
    'small cube': 1,
    'top hat': 0.8,
    'large cube': 0.6
  };

  const timeMultiplier = {
    short: 1,
    medium: 1.3,
    long: 1.6
  };

  let methodKey = method.includes('shaken') ? 'shaken'
                : method.includes('stirred') ? 'stirred'
                : 'built';

  let iceKey = Object.keys(iceMultiplier).find(k => iceType.toLowerCase().includes(k)) || 'small cube';
  let timeKey = time <= 9 ? 'short' : time <= 20 ? 'medium' : 'long';

  return methodBase[methodKey] * iceMultiplier[iceKey] * timeMultiplier[timeKey];
}

function parseIngredients(inputs) {
  return inputs.map(input => {
    const [name, oz] = input.split(':').map(x => x.trim().toLowerCase());
    const data = alcoholData[name];
    const amount = parseFloat(oz);
    return {
      name,
      oz: amount,
      abv: data?.abv || 0,
      calories: (data?.caloriesPerOz || 0) * amount,
      sugar: (data?.sugar || 0) * amount,
      carbs: (data?.carbs || 0) * amount,
      fat: (data?.fat || 0) * amount,
      sodium: (data?.sodium || 0) * amount,
      alcoholOz: (data?.abv || 0) * amount / 100
    };
  });
}

function calculateDrink(inputs, method, iceType, time) {
  const ingredients = parseIngredients(inputs);
  const totalVolume = ingredients.reduce((sum, i) => sum + i.oz, 0);
  const dilution = calculateDilutionFactor(method, iceType, time);
  const dilutedVolume = totalVolume * (1 + dilution);
  const totalAlcoholOz = ingredients.reduce((sum, i) => sum + i.alcoholOz, 0);
  const abv = (totalAlcoholOz / dilutedVolume) * 100;

  const nutrition = ingredients.reduce((acc, i) => {
    acc.calories += i.calories;
    acc.sugar += i.sugar;
    acc.carbs += i.carbs;
    acc.fat += i.fat;
    acc.sodium += i.sodium;
    return acc;
  }, { calories: 0, sugar: 0, carbs: 0, fat: 0, sodium: 0 });

  return {
    abv: abv.toFixed(1),
    volume: dilutedVolume.toFixed(1),
    ...nutrition
  };
}

// Example: hook into a button click
document.getElementById("calculate-btn").addEventListener("click", () => {
  const inputs = document.getElementById("ingredients").value.split('\n');
  const method = document.getElementById("method").value;
  const iceType = document.getElementById("ice").value;
  const time = parseInt(document.getElementById("dilutionTime").value, 10);

  const result = calculateDrink(inputs, method, iceType, time);

  document.getElementById("output").innerHTML = `
    <strong>ABV:</strong> ${result.abv}%<br>
    <strong>Total Volume:</strong> ${result.volume} oz<br>
    <strong>Calories:</strong> ${result.calories.toFixed(0)} kcal<br>
    <strong>Sugar:</strong> ${result.sugar.toFixed(1)} g<br>
    <strong>Carbs:</strong> ${result.carbs.toFixed(1)} g<br>
    <strong>Fat:</strong> ${result.fat.toFixed(1)} g<br>
    <strong>Sodium:</strong> ${result.sodium.toFixed(0)} mg
  `;
});
