import { getAllMatches, getFhOdds } from "../telegram/scraper.js";
import { calcFhDrawProb, correctEvCalc, oddsToXg } from "../telegram/evCalculator.js";
import { getBankroll, updateBankroll, insertFhBet, updateFhBetOutcome, listFhBets, adjustFhBetOutcome } from "./fhmodel.js";

/**
 * Fetch first-half +EV draw bets
 */
export async function getFhEv(req, res) {
  try {
    const matches = await getAllMatches();
    const positiveEv = [];

    for (const match of matches) {
      const odds = await getFhOdds(match.matchId);
      if (!odds) continue;

      const { homeXg, awayXg } = oddsToXg(odds);

      const modelProb = calcFhDrawProb(homeXg * 0.45, awayXg * 0.45);

      const ev = correctEvCalc(odds, modelProb);

      if (ev.evPercent > 5) {
        positiveEv.push({
          match: match.matchName,
          drawOdds: ev.drawOdds,
          evPercent: ev.evPercent.toFixed(2),
          modelProb: ev.modelDrawProb.toFixed(3),
          fairDrawProb: ev.fairDrawProb.toFixed(3),
        });
      }
    }

    positiveEv.sort((a, b) => b.evPercent - a.evPercent);

    return res.json(positiveEv);

  } catch (err) {
    console.error("Error fetching FH EV bets:", err);
    return res.status(500).json({ error: "Failed to fetch FH EV bets" });
  }
}

/**
 * Set bankroll manually
 */
export async function setBankroll(req, res) {
  try {
    const { total } = req.body;
    if (typeof total !== "number" || total <= 0) {
      return res.status(400).json({ error: "Invalid bankroll amount" });
    }

    await updateBankroll(total);
    return res.json({ message: "Bankroll updated successfully", newBankroll: total });

  } catch (err) {
    console.error("Error setting bankroll:", err);
    return res.status(500).json({ error: "Failed to set bankroll" });
  }
}

/**
 * Fetch current bankroll
 */
export async function fetchBankroll(req, res) {
  try {
    const bankroll = await getBankroll();
    if (!bankroll) {
      return res.status(404).json({ error: "No bankroll found" });
    }
    return res.json({ bankroll: bankroll.total });

  } catch (err) {
    console.error("Error fetching bankroll:", err);
    return res.status(500).json({ error: "Failed to fetch bankroll" });
  }
}

/**
 * Place a new FH bet
 * Automatically calculates stake from bankroll and saves the bet
 */
export async function placeFhBet(req, res) {
  try {
    const { match_id, match_name, draw_odds, model_prob, fair_prob, ev_percent } = req.body;

    // Log incoming payload to help debug bad requests
    console.debug("placeFhBet payload:", req.body);

    // Accept numeric zeros — only reject if a required field is null/undefined
    if (
      match_id == null ||
      match_name == null ||
      draw_odds == null ||
      model_prob == null ||
      ev_percent == null
    ) {
      return res.status(400).json({ error: "Missing required bet fields", received: req.body });
    }

    const bankrollData = await getBankroll();
    if (!bankrollData) {
      return res.status(400).json({ error: "Bankroll not set" });
    }

    const bankroll = bankrollData.total;

    // Simple custom stake: 2% max, scaled by EV
    let stake = bankroll * 0.02 * (ev_percent / 10);
    const maxStake = bankroll * 0.02;
    if (stake > maxStake) stake = maxStake;
    stake = Number(stake.toFixed(2));

    const bet = {
      match_id,
      match_name,
      draw_odds,
      model_prob,
      fair_prob,
      ev_percent,
      stake,
      bankroll_snapshot: bankroll
    };

    try {
      const insertedBet = await insertFhBet(bet);

      // Deduct stake immediately from bankroll snapshot so available bankroll reflects placed bets
      try {
        const currentTotal = Number(bankrollData.total);
        const newTotal = Number((currentTotal - stake).toFixed(2));
        await updateBankroll(newTotal);
        return res.json({ message: "Bet placed successfully", bet: insertedBet, newBankroll: newTotal });
      } catch (bankErr) {
        console.error('Failed to update bankroll after placing bet:', bankErr);
        // Still return success for bet placement but include warning
        return res.status(200).json({ message: "Bet placed but failed to update bankroll", bet: insertedBet });
      }

    } catch (insertErr) {
      if (insertErr.message.includes("already exists")) {
        return res.status(400).json({ error: "Bet for this match already exists" });
      }
      throw insertErr;
    }

  } catch (err) {
    console.error("Error placing FH bet:", err);
    return res.status(500).json({ error: "Failed to place bet" });
  }
}


/**
 * Resolve a bet (update outcome and bankroll)
 */
export async function resolveFhBet(req, res) {
  try {
    const { betId, outcome } = req.body;
    if (!betId || !["win", "lose"].includes(outcome)) {
      return res.status(400).json({ error: "Invalid betId or outcome" });
    }

    const result = await updateFhBetOutcome(betId, outcome);
    return res.json({ message: "Bet resolved", result });

  } catch (err) {
    console.error("Error resolving FH bet:", err);
    return res.status(500).json({ error: "Failed to resolve bet" });
  }
}


/**
 * Adjust a bet's profit/loss manually
 */
export async function adjustFhBet(req, res) {
  try {
    const { betId, profit_loss } = req.body;
    if (!betId || profit_loss == null || isNaN(Number(profit_loss))) {
      return res.status(400).json({ error: "Invalid betId or profit_loss" });
    }

    const result = await adjustFhBetOutcome(betId, Number(profit_loss));
    return res.json({ message: "Bet adjusted", result });

  } catch (err) {
    console.error("Error adjusting FH bet:", err);
    return res.status(500).json({ error: "Failed to adjust bet" });
  }
}

/**
 * List all FH bets (optional filter by outcome)
 */
export async function getAllFhBets(req, res) {
  try {
    const { outcome } = req.query; // optional: win | lose | pending
    const bets = await listFhBets(outcome);
    return res.json(bets);

  } catch (err) {
    console.error("Error fetching FH bets:", err);
    return res.status(500).json({ error: "Failed to fetch FH bets" });
  }
}
