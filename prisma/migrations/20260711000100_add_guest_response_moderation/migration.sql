ALTER TABLE `prayerresponse`
  ADD COLUMN `moderationStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN `guestSessionHash` VARCHAR(64) NULL,
  ADD COLUMN `ipHash` VARCHAR(64) NULL;

CREATE INDEX `prayerresponse_guestSessionHash_createdAt_idx`
  ON `prayerresponse`(`guestSessionHash`, `createdAt`);

CREATE INDEX `prayerresponse_ipHash_createdAt_idx`
  ON `prayerresponse`(`ipHash`, `createdAt`);
