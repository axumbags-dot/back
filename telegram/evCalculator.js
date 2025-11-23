// Simple Poisson EV calculator — conservative FH edition

// Factorial
function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// Poisson probability
function poisson(k, lambda) {
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}

// Calculate first-half draw probability (conservative)
export function calcFhDrawProb(homeXg, awayXg, maxGoals = 4) {
  let prob = 0;
  for (let i = 0; i <= maxGoals; i++) {
    prob += poisson(i, homeXg) * poisson(i, awayXg);
  }

  // Optional cap to avoid unrealistic high FH draws
  return Math.min(prob, 0.55); // 55% max
}

// Convert odds → implied xG (conservative, no extra FH scaling)
export function oddsToXg(odds) {
  const total = 1 / odds.home + 1 / odds.draw + 1 / odds.away;
  const homeProb = (1 / odds.home) / total;
  const awayProb = (1 / odds.away) / total;
  return {
    homeXg: -Math.log(1 - homeProb),
    awayXg: -Math.log(1 - awayProb)
  };
}

// EV calculation
export function correctEvCalc(odds, modelDrawProb) {
  const { draw, home, away } = odds;

  const overround = 1 / home + 1 / draw + 1 / away;
  const fairDrawProb = (1 / draw) / overround;

  const evPerUnit = modelDrawProb * (draw - 1) - (1 - modelDrawProb);
  
  // Scale down EV for realism (optional)
  const scaledEvPercent = Number((evPerUnit * 100 * 0.1).toFixed(2)); // scale ×0.1

  return {
    fairDrawProb: Number(fairDrawProb.toFixed(3)),
    modelDrawProb: Number(modelDrawProb.toFixed(3)),
    evPerUnit: Number(evPerUnit.toFixed(3)),
    evPercent: scaledEvPercent,
    drawOdds: draw
  };
}

// Quick +EV check
export function getEdge(odds) {
  const { homeXg, awayXg } = oddsToXg(odds);
  const modelProb = calcFhDrawProb(homeXg, awayXg);
  return correctEvCalc(odds, modelProb);
}
