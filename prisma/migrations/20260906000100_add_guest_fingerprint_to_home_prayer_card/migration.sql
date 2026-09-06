-- Anonymous card submissions previously stored no identity at all: ownerId was
-- set to NULL and nothing else was written, so the admin list could only ever
-- print "未知". Responses already carried these two hashes; cards did not.
--
-- Additive only, by design:
--   * both columns are NULL-able with no default, so no existing row is touched
--   * no column is dropped, renamed, narrowed or made NOT NULL
--   * no backfill — rows created before this migration keep NULL forever, which
--     is the honest value: their identity was never captured and cannot be
--     reconstructed. The admin UI renders that as「舊資料」.
--
-- Safe to run while the app is serving traffic; ADD COLUMN ... NULL and CREATE
-- INDEX are online operations on MySQL 8.
ALTER TABLE `home_prayer_card`
  ADD COLUMN `guestSessionHash` VARCHAR(64) NULL,
  ADD COLUMN `ipHash` VARCHAR(64) NULL;

-- Mirrors the composite indexes already on `prayerresponse`, so "show me every
-- submission from this guest / this IP in the last N days" is a single indexed
-- range scan on either table.
CREATE INDEX `home_prayer_card_guestSessionHash_createdAt_idx`
  ON `home_prayer_card`(`guestSessionHash`, `createdAt`);

CREATE INDEX `home_prayer_card_ipHash_createdAt_idx`
  ON `home_prayer_card`(`ipHash`, `createdAt`);
