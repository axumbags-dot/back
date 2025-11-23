import { pool } from "../config/db.js";

/**
 * Get total profit/loss across all bets
 */
export async function getTotalProfitLoss() {
  const res = await pool.query(`
    SELECT SUM(profit_loss) AS total_profit_loss 
    FROM fh_bets
    WHERE profit_loss IS NOT NULL
  `);
  return Number(res.rows[0].total_profit_loss || 0);
}

/**
 * Get stats grouped by outcome (win, lose, pending)
 */
export async function getOutcomeStats() {
  const res = await pool.query(`
    SELECT outcome, COUNT(*) AS count, SUM(profit_loss) AS total_profit
    FROM fh_bets
    GROUP BY outcome
  `);
  return res.rows.map(row => ({
    outcome: row.outcome,
    count: Number(row.count),
    totalProfit: Number(row.total_profit || 0)
  }));
}

/**
 * Get average EV and stake
 */
export async function getAverageEvStake() {
  const res = await pool.query(`
    SELECT AVG(ev_percent) AS avg_ev, AVG(stake) AS avg_stake
    FROM fh_bets
  `);
  return {
    avgEv: Number(res.rows[0].avg_ev || 0),
    avgStake: Number(res.rows[0].avg_stake || 0)
  };
}

/**
 * Get top N profitable bets
 * @param {number} limit 
 */
export async function getTopProfitableBets(limit = 5) {
  const res = await pool.query(`
    SELECT *
    FROM fh_bets
    WHERE profit_loss IS NOT NULL
    ORDER BY profit_loss DESC
    LIMIT $1
  `, [limit]);
  return res.rows;
}

/**
 * Get bankroll history over time
 */
export async function getBankrollHistory() {
  const res = await pool.query(`
    SELECT id, total, created_at
    FROM bankroll
    ORDER BY created_at ASC
  `);
  return res.rows;
}

/**
 * Get EV distribution (number of bets in EV ranges)
 */
export async function getEvDistribution() {
  const res = await pool.query(`
    SELECT
      CASE
        WHEN ev_percent < 5 THEN '<5'
        WHEN ev_percent < 10 THEN '5-10'
        WHEN ev_percent < 20 THEN '10-20'
        ELSE '20+'
      END AS ev_range,
      COUNT(*) AS count
    FROM fh_bets
    GROUP BY ev_range
    ORDER BY ev_range
  `);
  return res.rows.map(r => ({ range: r.ev_range, count: Number(r.count) }));
}
