-- P1-W-A-rest: seed 5 direct-loyalty airline reward programs.
-- Idempotent: each row inserted only if name does not already exist.
-- issuer_id is intentionally NULL — these are airline programs, not co-branded cards.
--
-- Apply via: psql / Supabase SQL editor / supabase db push (whichever is canonical).
-- Verify with: supabase_verify_airline_programs.sql

INSERT INTO reward_programs (name, code, currency_type, issuer_id)
SELECT 'Alaska Mileage Plan', 'alaska_mp', 'airline', NULL
WHERE NOT EXISTS (SELECT 1 FROM reward_programs WHERE name = 'Alaska Mileage Plan');

INSERT INTO reward_programs (name, code, currency_type, issuer_id)
SELECT 'American AAdvantage', 'american_aa', 'airline', NULL
WHERE NOT EXISTS (SELECT 1 FROM reward_programs WHERE name = 'American AAdvantage');

INSERT INTO reward_programs (name, code, currency_type, issuer_id)
SELECT 'Air Canada Aeroplan', 'aeroplan_ac', 'airline', NULL
WHERE NOT EXISTS (SELECT 1 FROM reward_programs WHERE name = 'Air Canada Aeroplan');

INSERT INTO reward_programs (name, code, currency_type, issuer_id)
SELECT 'Cathay Asia Miles', 'cathay_am', 'airline', NULL
WHERE NOT EXISTS (SELECT 1 FROM reward_programs WHERE name = 'Cathay Asia Miles');

INSERT INTO reward_programs (name, code, currency_type, issuer_id)
SELECT 'ANA Mileage Club', 'ana_mc', 'airline', NULL
WHERE NOT EXISTS (SELECT 1 FROM reward_programs WHERE name = 'ANA Mileage Club');
