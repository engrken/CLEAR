-- READ ONLY: run against target PostgreSQL instance before any migration.
SELECT current_database() AS database_name,
       current_setting('TimeZone') AS session_timezone,
       now() AS clock_instant,
       now() AT TIME ZONE 'UTC' AS utc_wall_clock,
       now() AT TIME ZONE 'Asia/Manila' AS manila_wall_clock;

SELECT table_name, column_name, data_type, datetime_precision, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND data_type IN ('timestamp without time zone', 'timestamp with time zone', 'date')
ORDER BY table_name, ordinal_position;

SELECT "timestamp"
FROM "SystemLog"
ORDER BY "timestamp" DESC
LIMIT 10;

SELECT "timestamp", "date", "orNumber"
FROM "Collection"
ORDER BY "timestamp" DESC
LIMIT 10;
