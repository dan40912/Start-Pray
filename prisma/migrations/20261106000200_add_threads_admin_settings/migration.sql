ALTER TABLE `site_setting`
  ADD COLUMN `threadsEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `threadsUserId` VARCHAR(191) NULL,
  ADD COLUMN `threadsAccessTokenSecret` TEXT NULL,
  ADD COLUMN `threadsGraphApiVersion` VARCHAR(32) NOT NULL DEFAULT 'v1.0';
