import { pool } from "../config/db.js";


export async function getBankroll() {
  const res = await pool.query("SELECT * FROM bankroll ORDER BY id DESC LIMIT 1");
  return res.rows[0];
}

/**
 * Update bankroll after a bet resolves
 * @param {number} newTotal
 */
export async function updateBankroll(newTotal) {
  await pool.query(
    `INSERT INTO bankroll (total, initial)
     VALUES ($1, COALESCE((SELECT initial FROM bankroll ORDER BY id DESC LIMIT 1), $1))`,
    [newTotal]
  );
}

/**
 * Insert a new FH bet
 * @param {object} bet - { match_id, match_name, draw_odds, model_prob, fair_prob, ev_percent, stake, bankroll_snapshot }
 */
export async function insertFhBet(bet) {
  // Check if bet for this match_id already exists
  const check = await pool.query(
    "SELECT * FROM fh_bets WHERE match_id = $1",
    [bet.match_id]
  );

  if (check.rows.length > 0) {
    throw new Error("Bet for this match already exists");
  }

  // Insert new bet
  const query = `
    INSERT INTO fh_bets(
      match_id, match_name, draw_odds, model_prob, fair_prob,
      ev_percent, stake, bankroll_snapshot
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `;
  const values = [
    bet.match_id,
    bet.match_name,
    bet.draw_odds,
    bet.model_prob,
    bet.fair_prob,
    bet.ev_percent,
    bet.stake,
    bet.bankroll_snapshot,
  ];
  const res = await pool.query(query, values);
  return res.rows[0];
}



export async function updateFhBetOutcome(betId, outcome) {
  // Fetch current bet
  const betRes = await pool.query("SELECT * FROM fh_bets WHERE bet_id = $1", [betId]);
  if (!betRes.rows[0]) throw new Error("Bet not found");
  const bet = betRes.rows[0];

  // Coerce numeric DB fields to numbers and calculate profit/loss
  const stake = Number(bet.stake);
  const drawOdds = Number(bet.draw_odds);
  const profit_loss = outcome === "win" ? stake * (drawOdds - 1) : -stake;

  // Update bet
  await pool.query(
    `UPDATE fh_bets
     SET outcome=$1, profit_loss=$2
     WHERE bet_id=$3`,
    [outcome, profit_loss, betId]
  );

  // Update bankroll
  const bankrollRes = await getBankroll();
  const currentTotal = Number(bankrollRes.total);
  const newTotal = currentTotal + Number(profit_loss);
  await updateBankroll(newTotal);

  return { betId, outcome, profit_loss, newBankroll: newTotal };
}

/**
 * Adjust a bet's profit/loss manually and update bankroll
 * @param {number|string} betId
 * @param {number} profit_loss
 */
export async function adjustFhBetOutcome(betId, profit_loss) {
  // Fetch current bet
  const betRes = await pool.query("SELECT * FROM fh_bets WHERE bet_id = $1", [betId]);
  if (!betRes.rows[0]) throw new Error("Bet not found");

  const outcome = Number(profit_loss) > 0 ? 'win' : 'lose';

  // Update bet with provided profit/loss and derived outcome
  await pool.query(
    `UPDATE fh_bets
     SET outcome=$1, profit_loss=$2
     WHERE bet_id=$3`,
    [outcome, profit_loss, betId]
  );

  // Update bankroll
  const bankrollRes = await getBankroll();
  const currentTotal = Number(bankrollRes.total);
  const newTotal = currentTotal + Number(profit_loss);
  await updateBankroll(newTotal);

  return { betId, outcome, profit_loss: Number(profit_loss), newBankroll: newTotal };
}

export async function listFhBets(outcome) {
  let query = "SELECT * FROM fh_bets ORDER BY bet_time DESC";
  let values = [];
  if (outcome) {
    query = "SELECT * FROM fh_bets WHERE outcome=$1 ORDER BY bet_time DESC";
    values = [outcome];
  }
  const res = await pool.query(query, values);
  return res.rows;
}

