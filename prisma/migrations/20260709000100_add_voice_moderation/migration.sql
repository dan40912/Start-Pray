ALTER TABLE `prayerresponse`
  ADD COLUMN `voiceModerationStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'NOT_APPLICABLE') NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN `voiceModeratedAt` DATETIME(3) NULL,
  ADD COLUMN `voiceModeratedBy` VARCHAR(191) NULL,
  ADD COLUMN `voiceAutoFlags` TEXT NULL;

UPDATE `prayerresponse`
SET `voiceModerationStatus` = CASE
  WHEN `voiceUrl` IS NULL OR `voiceUrl` = '' THEN 'NOT_APPLICABLE'
  ELSE 'APPROVED'
END;
