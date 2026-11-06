ALTER TABLE `adminaccount` ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `admin_log` ADD COLUMN `operationKey` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `admin_log_operationKey_key` ON `admin_log`(`operationKey`);
CREATE TABLE `media_upload` (
  `url` VARCHAR(512) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `media_upload_ownerId_idx` (`ownerId`),
  PRIMARY KEY (`url`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
