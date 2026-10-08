-- Store upload bytes in Postgres so files survive ephemeral filesystems (Heroku dynos).
ALTER TABLE "Upload" ADD COLUMN "data" BYTEA;
