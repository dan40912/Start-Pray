-- `description` was created as the Prisma default VARCHAR(191), while
-- /api/home-cards accepts up to 3000 characters. Any prayer longer than 191
-- characters failed on insert with "The provided value for the column is too
-- long for the column's type", so the card could not be saved at all.
--
-- Widening only:
--   * VARCHAR(191) -> TEXT keeps every existing value byte-for-byte
--   * stays NOT NULL, as before; no default, no backfill
--   * no column is dropped, renamed or narrowed
--   * no index covers this column, so nothing has to be rebuilt
--
-- MySQL 8 runs VARCHAR -> TEXT as a table copy (ALGORITHM=COPY). The table is
-- small, but run it in a quiet moment rather than at peak traffic.
ALTER TABLE `home_prayer_card`
  MODIFY `description` TEXT NOT NULL;
