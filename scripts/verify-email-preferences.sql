-- Read-only verification. Use on Neon staging.
SELECT COUNT(*) AS preference_records,
       COUNT(*) FILTER (WHERE NOT "receiveParticipantEmails") AS student_or_requestor_optouts,
       COUNT(*) FILTER (WHERE NOT "receiveOfficerCopies") AS officer_copy_optouts
FROM public."TransactionEmailPreference";
SELECT "status", COUNT(*) AS delivery_records
FROM public."DigitalReceiptDelivery"
GROUP BY "status" ORDER BY "status";
