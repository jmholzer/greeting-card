-- Idempotency key so a retried submit cannot create a duplicate message.
-- Additive and safe on live data: the column is nullable, and Postgres allows
-- many NULLs in a unique index, so existing rows are unaffected.
ALTER TABLE "Message" ADD COLUMN "requestId" TEXT;

CREATE UNIQUE INDEX "Message_requestId_key" ON "Message"("requestId");
