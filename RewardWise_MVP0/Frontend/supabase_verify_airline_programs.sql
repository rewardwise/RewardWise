-- P1-W-A-rest: post-seed verification queries.
-- Run after supabase_seed_airline_programs.sql to confirm the 5 rows landed
-- and no orphaned wallet rows or duplicate names exist.

-- 1. All 5 new programs present, with NULL issuer_id and currency_type 'airline'.
SELECT name, code, currency_type, issuer_id
FROM reward_programs
WHERE name IN (
  'Alaska Mileage Plan',
  'American AAdvantage',
  'Air Canada Aeroplan',
  'Cathay Asia Miles',
  'ANA Mileage Club'
)
ORDER BY name;
-- Expect: 5 rows, issuer_id NULL on each, currency_type 'airline'.

-- 2. No duplicates by name (idempotence check — re-running the seed must not multiply rows).
SELECT name, COUNT(*) AS dup_count
FROM reward_programs
WHERE name IN (
  'Alaska Mileage Plan',
  'American AAdvantage',
  'Air Canada Aeroplan',
  'Cathay Asia Miles',
  'ANA Mileage Club'
)
GROUP BY name
HAVING COUNT(*) > 1;
-- Expect: 0 rows.

-- 3. Code uniqueness (each new code distinct from all existing codes).
SELECT code, COUNT(*) AS dup_count
FROM reward_programs
WHERE code IN ('alaska_mp', 'american_aa', 'aeroplan_ac', 'cathay_am', 'ana_mc')
GROUP BY code
HAVING COUNT(*) > 1;
-- Expect: 0 rows.

-- 4. Wallet-side sanity: any cards rows referencing these programs (should be 0 pre-rollout,
--    will grow as users add them via the wallet picker).
SELECT rp.name, COUNT(c.id) AS wallet_count
FROM reward_programs rp
LEFT JOIN cards c ON c.reward_program_id = rp.id
WHERE rp.name IN (
  'Alaska Mileage Plan',
  'American AAdvantage',
  'Air Canada Aeroplan',
  'Cathay Asia Miles',
  'ANA Mileage Club'
)
GROUP BY rp.name
ORDER BY rp.name;
-- Expect: 5 rows, wallet_count = 0 immediately after deploy.
