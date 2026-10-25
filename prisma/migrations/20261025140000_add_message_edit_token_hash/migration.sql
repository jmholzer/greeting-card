-- SHA-256 (hex) of a message's edit token, so its author can edit or delete it.
-- Additive and safe on live data: the column is nullable and existing rows keep
-- NULL, which means they are not editable. No index: messages are always looked
-- up by primary key (id), and the hash is only compared after that lookup.
ALTER TABLE "Message" ADD COLUMN "editTokenHash" TEXT;
