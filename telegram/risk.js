function calcCustomStake(bankroll, evPercent) {
  let stake = bankroll * 0.02 * (evPercent / 10);

  const maxStake = bankroll * 0.02;
  if (stake > maxStake) stake = maxStake;

  return Number(stake.toFixed(2));
}
