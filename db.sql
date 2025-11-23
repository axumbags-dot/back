CREATE TABLE fh_bets (
    bet_id SERIAL PRIMARY KEY,
    match_id VARCHAR(50) NOT NULL,
    match_name VARCHAR(150) NOT NULL,
    bet_time TIMESTAMP DEFAULT NOW(),
    draw_odds NUMERIC(5,2) NOT NULL,
    model_prob NUMERIC(4,3) NOT NULL,
    fair_prob NUMERIC(4,3) NOT NULL,
    ev_percent NUMERIC(5,2) NOT NULL,
    stake NUMERIC(10,2) DEFAULT 0,
    outcome VARCHAR(10) DEFAULT 'pending', -- 'win', 'lose', 'pending'
    profit_loss NUMERIC(10,2) DEFAULT 0,
    bankroll_snapshot NUMERIC(12,2) NOT NULL, -- bankroll at bet time
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bankroll (
    id SERIAL PRIMARY KEY,
    total NUMERIC(12,2) NOT NULL,   -- current bankroll
    initial NUMERIC(12,2) NOT NULL, -- starting bankroll
    last_update TIMESTAMP DEFAULT NOW()
);