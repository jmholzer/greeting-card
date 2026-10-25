-- Additive and nullable: where a message sits on the card, as fractions of the writing surface.
-- Existing rows keep NULL and are given a computed place when the card is drawn.
ALTER TABLE "Message" ADD COLUMN "placeX" DOUBLE PRECISION;
ALTER TABLE "Message" ADD COLUMN "placeY" DOUBLE PRECISION;
ALTER TABLE "Message" ADD COLUMN "placeWidth" DOUBLE PRECISION;
ALTER TABLE "Message" ADD COLUMN "placeHeight" DOUBLE PRECISION;
ALTER TABLE "Message" ADD COLUMN "placeRotation" DOUBLE PRECISION;
