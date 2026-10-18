-- Read-only Neon verification: do not mutate records.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND ((table_name='Penalty' AND column_name IN ('penaltyType','assessedAmount'))
    OR table_name='PenaltySettlementEvent')
ORDER BY table_name, ordinal_position;

SELECT conname, contype, conrelid::regclass AS source_table
FROM pg_constraint
WHERE conrelid='public."PenaltySettlementEvent"'::regclass
ORDER BY conname;

SELECT "penaltyType", count(*) AS penalty_count
FROM public."Penalty"
GROUP BY "penaltyType" ORDER BY "penaltyType";
