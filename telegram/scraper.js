const MATCH_LIST_URL = "https://api.betika.co.tz/v1/uo/matches?sport_id=5&page=1&limit=100&keyword=&tab=upcoming&sub_type_id=1,186&tag_id=&country_id=3&language=en";
const MATCH_ODDS_URL = "https://api.betika.co.tz/v1/uo/match?id={MATCH_ID}&language=en";
const HEADERS = { "User-Agent": "Mozilla/5.0", "Accept": "application/json" };

/**
 * Fetch all matches from Betika
 */
export async function getAllMatches() {
  try {
    const res = await fetch(MATCH_LIST_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    const matches = data.data || [];
console.log(matches.length);
    
    

    return matches.map(m => ({
      matchId: m.match_id,
      matchName: `${m.home_team} vs ${m.away_team}`
    }));

  } catch (err) {
    console.error("Error fetching matches:", err);
    return [];
  }
}

/**
 * Fetch first-half 1X2 odds for a given match
 */
export async function getFhOdds(matchId, retries = 2) {
  const url = MATCH_ODDS_URL.replace("{MATCH_ID}", matchId);

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    const fhMarket = (data.data || []).find(m => m.sub_type_id === "60");
    if (!fhMarket || !fhMarket.odds) return null;

    const [home, draw, away] = fhMarket.odds;
    return {
      home: parseFloat(home.odd_value),
      draw: parseFloat(draw.odd_value),
      away: parseFloat(away.odd_value)
    };

  } catch (err) {
    if (retries > 0) {
      console.warn(`Retrying FH odds fetch for match ${matchId}...`);
      await new Promise(r => setTimeout(r, 500)); // naive delay
      return getFhOdds(matchId, retries - 1);
    }
    console.error(`Error fetching FH odds for ${matchId}:`, err);
    return null;
  }
}
