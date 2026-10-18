-- Read-only operational view: no recipient email address or HTML exposed.
SELECT "documentType", "status", COUNT(*) AS messages, MIN("createdAt") AS oldest
FROM public."DigitalReceiptDelivery"
GROUP BY "documentType", "status"
ORDER BY "documentType", "status";
-- Inspect one tenant's recent delivery attempts:
SELECT "eventKey", "referenceNo", "recipientRole", "status", "attempts", "sentAt",
       LEFT(COALESCE("lastError",''), 120) AS "errorSummary"
FROM public."DigitalReceiptDelivery"
ORDER BY "createdAt" DESC LIMIT 30;
