import express from "express";
import { 
  getFhEv, 
  fetchBankroll, 
  setBankroll, 
  placeFhBet, 
  resolveFhBet, 
  adjustFhBet,
  getAllFhBets 
} from "./fhController.js";

const r = express.Router();

// Fetch first-half +EV bets
r.get("/start", getFhEv);

// Bankroll endpoints
r.get("/bankroll", fetchBankroll);
r.post("/bankroll", setBankroll);

// Place a new FH bet
r.post("/bets", placeFhBet);

// Resolve a bet (win/lose)
r.post("/bets/resolve", resolveFhBet);

// Adjust a bet profit/loss manually
r.post("/bets/adjust", adjustFhBet);

// List all FH bets, optional ?outcome=win|lose
r.get("/bets", getAllFhBets);

export default r;
