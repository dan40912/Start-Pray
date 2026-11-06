CREATE TABLE `analytics_visit` (
    `id` CHAR(36) NOT NULL,
    `browserId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `landing` VARCHAR(24) NULL,
    `source` VARCHAR(16) NULL,
    `memberAtEntry` BOOLEAN NOT NULL DEFAULT false,
    `pageViews` INTEGER NOT NULL DEFAULT 0,
    `openedPrayer` BOOLEAN NOT NULL DEFAULT false,
    `openedCreate` BOOLEAN NOT NULL DEFAULT false,
    `openedSignup` BOOLEAN NOT NULL DEFAULT false,
    `signedUp` BOOLEAN NOT NULL DEFAULT false,
    `createdPrayer` BOOLEAN NOT NULL DEFAULT false,
    `prayed` BOOLEAN NOT NULL DEFAULT false,
    `textResponse` BOOLEAN NOT NULL DEFAULT false,
    `voiceResponse` BOOLEAN NOT NULL DEFAULT false,

    INDEX `analytics_visit_createdAt_browserId_idx`(`createdAt`, `browserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
