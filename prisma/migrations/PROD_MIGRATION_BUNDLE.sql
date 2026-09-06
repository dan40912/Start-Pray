-- PROD migration bundle generated at: 2026-09-06T15:24:57.193Z
-- Source: prisma/migrations/*/migration.sql
-- NOTE: Prefer running `npx prisma migrate deploy` in production.
-- This bundle is for DBA review / controlled SQL execution.

-- ==============================
-- MIGRATION: 20250921133228_init
-- ==============================
-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `faithTradition` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `solanaAddress` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `acceptedTerms` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrayerRequest` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ANSWERED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `tokensTarget` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ownerId` VARCHAR(191) NULL,

    UNIQUE INDEX `PrayerRequest_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrayerResponse` (
    `id` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `voiceUrl` VARCHAR(191) NULL,
    `tokensAwarded` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requestId` VARCHAR(191) NOT NULL,
    `responderId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PrayerRequest` ADD CONSTRAINT `PrayerRequest_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrayerResponse` ADD CONSTRAINT `PrayerResponse_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `PrayerRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrayerResponse` ADD CONSTRAINT `PrayerResponse_responderId_fkey` FOREIGN KEY (`responderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20250922153531_add_site_banner
-- ==============================
-- CreateTable
CREATE TABLE `site_banner` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `eyebrow` VARCHAR(191) NULL,
    `headline` VARCHAR(191) NOT NULL,
    `subheadline` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `primaryCtaLabel` VARCHAR(191) NOT NULL,
    `primaryCtaHref` VARCHAR(191) NOT NULL,
    `secondaryCtaLabel` VARCHAR(191) NULL,
    `secondaryCtaHref` VARCHAR(191) NULL,
    `heroImage` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ==============================
-- MIGRATION: 20250922153729_tweak_site_banner_timestamp
-- ==============================
-- AlterTable
ALTER TABLE `site_banner` MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- ==============================
-- MIGRATION: 20250922160107_add_home_prayer_cards
-- ==============================
-- CreateTable
CREATE TABLE `home_prayer_card` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `image` VARCHAR(191) NOT NULL,
    `alt` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `tags` JSON NOT NULL,
    `meta` JSON NOT NULL,
    `detailsHref` VARCHAR(191) NOT NULL,
    `voiceHref` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `home_prayer_card_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ==============================
-- MIGRATION: 20250923123803_add_home_prayer_categories
-- ==============================
-- AlterTable
ALTER TABLE `home_prayer_card` ADD COLUMN `categoryId` INTEGER NULL;

-- CreateTable
CREATE TABLE `home_prayer_category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `home_prayer_category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `home_prayer_card_categoryId_idx` ON `home_prayer_card`(`categoryId`);

-- AddForeignKey
ALTER TABLE `home_prayer_card` ADD CONSTRAINT `home_prayer_card_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `home_prayer_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20250923123901_home_prayer_category_required
-- ==============================
/*
  Warnings:

  - Made the column `categoryId` on table `home_prayer_card` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `home_prayer_card` DROP FOREIGN KEY `home_prayer_card_categoryId_fkey`;

-- AlterTable
ALTER TABLE `home_prayer_card` MODIFY `categoryId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `home_prayer_card` ADD CONSTRAINT `home_prayer_card_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `home_prayer_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20250925092510_add_is_anonymous_to_prayer_response
-- ==============================
-- AlterTable
ALTER TABLE `prayerresponse` ADD COLUMN `isAnonymous` BOOLEAN NOT NULL DEFAULT false;

-- ==============================
-- MIGRATION: 20250925095849_support_dual_requests
-- ==============================
/*
  Warnings:

  - You are about to drop the column `requestId` on the `prayerresponse` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `prayerresponse` DROP FOREIGN KEY `PrayerResponse_requestId_fkey`;

-- DropIndex
DROP INDEX `PrayerResponse_requestId_fkey` ON `prayerresponse`;

-- AlterTable
ALTER TABLE `prayerresponse` DROP COLUMN `requestId`,
    ADD COLUMN `homeCardId` INTEGER NULL,
    ADD COLUMN `prayerRequestId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `PrayerResponse` ADD CONSTRAINT `PrayerResponse_prayerRequestId_fkey` FOREIGN KEY (`prayerRequestId`) REFERENCES `PrayerRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrayerResponse` ADD CONSTRAINT `PrayerResponse_homeCardId_fkey` FOREIGN KEY (`homeCardId`) REFERENCES `home_prayer_card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20250925185300_add_is_blocked_to_user
-- ==============================
-- AlterTable
ALTER TABLE `user` ADD COLUMN `avatarUrl` VARCHAR(191) NULL,
    ADD COLUMN `bio` VARCHAR(191) NULL,
    ADD COLUMN `isBlocked` BOOLEAN NOT NULL DEFAULT false;

-- ==============================
-- MIGRATION: 20250926182456_add_block_report_wallet
-- ==============================
-- AlterTable
ALTER TABLE `home_prayer_card` ADD COLUMN `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reportCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `prayerrequest` ADD COLUMN `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reportCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `prayerresponse` ADD COLUMN `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reportCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `reportCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `walletBalance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- ==============================
-- MIGRATION: 20250927015035_add_owner_and_block_fields
-- ==============================
/*
  Warnings:

  - You are about to drop the column `category` on the `prayerrequest` table. All the data in the column will be lost.
  - You are about to drop the column `isBlocked` on the `prayerrequest` table. All the data in the column will be lost.
  - You are about to drop the column `reportCount` on the `prayerrequest` table. All the data in the column will be lost.
  - You are about to drop the column `tokensTarget` on the `prayerrequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `home_prayer_card` ADD COLUMN `ownerId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `prayerrequest` DROP COLUMN `category`,
    DROP COLUMN `isBlocked`,
    DROP COLUMN `reportCount`,
    DROP COLUMN `tokensTarget`;

-- AddForeignKey
ALTER TABLE `home_prayer_card` ADD CONSTRAINT `home_prayer_card_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20250927042232_banner_active
-- ==============================
-- AlterTable
ALTER TABLE `site_banner` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- ==============================
-- MIGRATION: 20250927121557_add_log_admin
-- ==============================
-- CreateTable
CREATE TABLE `admin_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` ENUM('ACTION', 'SYSTEM') NOT NULL,
    `level` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    `message` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `actorEmail` VARCHAR(191) NULL,
    `targetType` VARCHAR(191) NULL,
    `targetId` VARCHAR(191) NULL,
    `requestPath` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_log_category_createdAt_idx`(`category`, `createdAt`),
    INDEX `admin_log_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ==============================
-- MIGRATION: 20250927123644_add_wallet_ledge
-- ==============================
/*
  Warnings:

  - You are about to alter the column `tokensAwarded` on the `prayerresponse` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE `home_prayer_card` ADD COLUMN `isSettled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `settledAmount` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `prayerresponse` ADD COLUMN `isSettled` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `tokensAwarded` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `bscAddress` VARCHAR(191) NULL,
    ADD COLUMN `isAddressVerified` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `token_transaction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('EARN_PRAYER', 'EARN_RESPONSE', 'WITHDRAW', 'DONATE') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING_CHAIN', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `amount` DECIMAL(10, 2) NOT NULL,
    `relatedHomeCardId` INTEGER NULL,
    `relatedResponseId` VARCHAR(191) NULL,
    `txHash` VARCHAR(191) NULL,
    `targetAddress` VARCHAR(191) NULL,
    `gasFee` DECIMAL(10, 8) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `token_transaction_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `token_transaction_type_status_idx`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `token_transaction` ADD CONSTRAINT `token_transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `token_transaction` ADD CONSTRAINT `token_transaction_relatedHomeCardId_fkey` FOREIGN KEY (`relatedHomeCardId`) REFERENCES `home_prayer_card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `token_transaction` ADD CONSTRAINT `token_transaction_relatedResponseId_fkey` FOREIGN KEY (`relatedResponseId`) REFERENCES `PrayerResponse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20250927130030_add_role_superadmin
-- ==============================
-- CreateTable
CREATE TABLE `AdminAccount` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER', 'ADMIN') NOT NULL DEFAULT 'ADMIN',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminAccount_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ==============================
-- MIGRATION: 20250929025833_add_prayer_response_reports
-- ==============================
-- CreateTable
CREATE TABLE `prayer_response_report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `responseId` VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prayer_response_report_responseId_idx`(`responseId`),
    INDEX `prayer_response_report_reason_idx`(`reason`),
    INDEX `prayer_response_report_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `prayer_response_report_responseId_reporterId_key`(`responseId`, `reporterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `prayer_response_report` ADD CONSTRAINT `prayer_response_report_responseId_fkey` FOREIGN KEY (`responseId`) REFERENCES `PrayerResponse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prayer_response_report` ADD CONSTRAINT `prayer_response_report_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20250929030732_add_home_prayer_card_reports
-- ==============================
-- CreateTable
CREATE TABLE `home_prayer_card_report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cardId` INTEGER NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `home_prayer_card_report_cardId_idx`(`cardId`),
    INDEX `home_prayer_card_report_reason_idx`(`reason`),
    INDEX `home_prayer_card_report_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `home_prayer_card_report_cardId_reporterId_key`(`cardId`, `reporterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `home_prayer_card_report` ADD CONSTRAINT `home_prayer_card_report_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `home_prayer_card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_prayer_card_report` ADD CONSTRAINT `home_prayer_card_report_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20250930161907_add_reset_password
-- ==============================
-- AlterTable
ALTER TABLE `user` ADD COLUMN `resetToken` VARCHAR(255) NULL,
    ADD COLUMN `resetTokenExpiry` DATETIME(3) NULL;

-- ==============================
-- MIGRATION: 20251002195101_not_mandatory_for_voicehref
-- ==============================
-- AlterTable
ALTER TABLE `home_prayer_card` MODIFY `voiceHref` VARCHAR(191) NULL;

-- ==============================
-- MIGRATION: 20251010_add_token_reward_rule
-- ==============================
-- No-op placeholder migration.
-- Keep at least one valid SQL statement so shadow database replay does not fail.
SELECT 1;

-- ==============================
-- MIGRATION: 20251010_add_token_reward_tables
-- ==============================
-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `faithTradition` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `solanaAddress` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `acceptedTerms` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `bio` VARCHAR(191) NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `reportCount` INTEGER NOT NULL DEFAULT 0,
    `walletBalance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `bscAddress` VARCHAR(191) NULL,
    `isAddressVerified` BOOLEAN NOT NULL DEFAULT false,
    `resetToken` VARCHAR(255) NULL,
    `resetTokenExpiry` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrayerRequest` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ANSWERED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ownerId` VARCHAR(191) NULL,

    UNIQUE INDEX `PrayerRequest_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrayerResponse` (
    `id` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `voiceUrl` VARCHAR(191) NULL,
    `tokensAwarded` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `isSettled` BOOLEAN NOT NULL DEFAULT false,
    `isAnonymous` BOOLEAN NOT NULL DEFAULT false,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `reportCount` INTEGER NOT NULL DEFAULT 0,
    `rewardStatus` ENUM('PENDING', 'BLOCKED', 'REWARDED') NOT NULL DEFAULT 'PENDING',
    `rewardEligibleAt` DATETIME(3) NULL,
    `rewardEvaluatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `prayerRequestId` VARCHAR(191) NULL,
    `homeCardId` INTEGER NULL,
    `responderId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `home_prayer_card_report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cardId` INTEGER NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `home_prayer_card_report_cardId_idx`(`cardId`),
    INDEX `home_prayer_card_report_reason_idx`(`reason`),
    INDEX `home_prayer_card_report_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `home_prayer_card_report_cardId_reporterId_key`(`cardId`, `reporterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prayer_response_report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `responseId` VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prayer_response_report_responseId_idx`(`responseId`),
    INDEX `prayer_response_report_reason_idx`(`reason`),
    INDEX `prayer_response_report_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `prayer_response_report_responseId_reporterId_key`(`responseId`, `reporterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_banner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eyebrow` VARCHAR(191) NULL,
    `headline` VARCHAR(191) NOT NULL,
    `subheadline` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `primaryCtaLabel` VARCHAR(191) NOT NULL,
    `primaryCtaHref` VARCHAR(191) NOT NULL,
    `secondaryCtaLabel` VARCHAR(191) NULL,
    `secondaryCtaHref` VARCHAR(191) NULL,
    `heroImage` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_setting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `maintenanceMode` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `token_reward_rule` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `rewardTokens` DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
    `observationDays` INTEGER NOT NULL DEFAULT 3,
    `allowedReports` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `home_prayer_category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `home_prayer_category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `home_prayer_card` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `image` VARCHAR(191) NOT NULL,
    `alt` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `tags` JSON NOT NULL,
    `meta` JSON NOT NULL,
    `detailsHref` VARCHAR(191) NOT NULL,
    `voiceHref` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `categoryId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ownerId` VARCHAR(191) NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `reportCount` INTEGER NOT NULL DEFAULT 0,
    `isSettled` BOOLEAN NOT NULL DEFAULT false,
    `settledAmount` DECIMAL(10, 2) NULL,

    UNIQUE INDEX `home_prayer_card_slug_key`(`slug`),
    INDEX `home_prayer_card_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAccount` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER', 'ADMIN') NOT NULL DEFAULT 'ADMIN',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminAccount_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `token_transaction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('EARN_PRAYER', 'EARN_RESPONSE', 'WITHDRAW', 'DONATE') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING_CHAIN', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `amount` DECIMAL(10, 2) NOT NULL,
    `relatedHomeCardId` INTEGER NULL,
    `relatedResponseId` VARCHAR(191) NULL,
    `txHash` VARCHAR(191) NULL,
    `targetAddress` VARCHAR(191) NULL,
    `gasFee` DECIMAL(10, 8) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `token_transaction_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `token_transaction_type_status_idx`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` ENUM('ACTION', 'SYSTEM') NOT NULL,
    `level` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    `message` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `actorEmail` VARCHAR(191) NULL,
    `targetType` VARCHAR(191) NULL,
    `targetId` VARCHAR(191) NULL,
    `requestPath` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_log_category_createdAt_idx`(`category`, `createdAt`),
    INDEX `admin_log_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PrayerRequest` ADD CONSTRAINT `PrayerRequest_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrayerResponse` ADD CONSTRAINT `PrayerResponse_prayerRequestId_fkey` FOREIGN KEY (`prayerRequestId`) REFERENCES `PrayerRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrayerResponse` ADD CONSTRAINT `PrayerResponse_homeCardId_fkey` FOREIGN KEY (`homeCardId`) REFERENCES `home_prayer_card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrayerResponse` ADD CONSTRAINT `PrayerResponse_responderId_fkey` FOREIGN KEY (`responderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_prayer_card_report` ADD CONSTRAINT `home_prayer_card_report_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `home_prayer_card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_prayer_card_report` ADD CONSTRAINT `home_prayer_card_report_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prayer_response_report` ADD CONSTRAINT `prayer_response_report_responseId_fkey` FOREIGN KEY (`responseId`) REFERENCES `PrayerResponse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prayer_response_report` ADD CONSTRAINT `prayer_response_report_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_prayer_card` ADD CONSTRAINT `home_prayer_card_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `home_prayer_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_prayer_card` ADD CONSTRAINT `home_prayer_card_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `token_transaction` ADD CONSTRAINT `token_transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `token_transaction` ADD CONSTRAINT `token_transaction_relatedHomeCardId_fkey` FOREIGN KEY (`relatedHomeCardId`) REFERENCES `home_prayer_card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `token_transaction` ADD CONSTRAINT `token_transaction_relatedResponseId_fkey` FOREIGN KEY (`relatedResponseId`) REFERENCES `PrayerResponse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20260327000100_add_admin_grant_transaction_type
-- ==============================
-- AlterTable
ALTER TABLE `token_transaction`
    MODIFY `type` ENUM('EARN_PRAYER', 'EARN_RESPONSE', 'ADMIN_GRANT', 'WITHDRAW', 'DONATE') NOT NULL;

-- ==============================
-- MIGRATION: 20260331_add_public_profile_and_overcomer_reports
-- ==============================
ALTER TABLE `user`
  ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `publicProfileEnabled` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `overcomer_user_report` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `targetUserId` VARCHAR(191) NOT NULL,
  `reporterId` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `overcomer_user_report_targetUserId_reporterId_key`(`targetUserId`, `reporterId`),
  INDEX `overcomer_user_report_targetUserId_idx`(`targetUserId`),
  INDEX `overcomer_user_report_reporterId_idx`(`reporterId`),
  INDEX `overcomer_user_report_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `overcomer_user_report`
  ADD CONSTRAINT `overcomer_user_report_targetUserId_fkey`
    FOREIGN KEY (`targetUserId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `overcomer_user_report_reporterId_fkey`
    FOREIGN KEY (`reporterId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20260426_add_user_story_media
-- ==============================
ALTER TABLE `user`
  ADD COLUMN `storyAudioUrl` TEXT NULL,
  ADD COLUMN `storyYoutubeUrl` TEXT NULL,
  ADD COLUMN `storyUpdatedAt` DATETIME(3) NULL;

-- ==============================
-- MIGRATION: 20260428_add_prayer_location
-- ==============================
ALTER TABLE `home_prayer_card`
  ADD COLUMN `locationCity` VARCHAR(120) NULL,
  ADD COLUMN `locationCountry` VARCHAR(120) NULL,
  ADD COLUMN `locationLat` DECIMAL(9,6) NULL,
  ADD COLUMN `locationLng` DECIMAL(9,6) NULL;

-- ==============================
-- MIGRATION: 20260429_add_private_prayer_cards
-- ==============================
ALTER TABLE `home_prayer_card`
  ADD COLUMN `isPrivate` BOOLEAN NOT NULL DEFAULT false;

-- ==============================
-- MIGRATION: 20260630000100_add_prd005_review_fields
-- ==============================
ALTER TABLE `user`
  ADD COLUMN `trustScore` INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN `flaggedCount` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `home_prayer_card`
  ADD COLUMN `needsReview` BOOLEAN NOT NULL DEFAULT false;

-- ==============================
-- MIGRATION: 20260709000100_add_voice_moderation
-- ==============================
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

-- ==============================
-- MIGRATION: 20260711000100_add_guest_response_moderation
-- ==============================
ALTER TABLE `prayerresponse`
  ADD COLUMN `moderationStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN `guestSessionHash` VARCHAR(64) NULL,
  ADD COLUMN `ipHash` VARCHAR(64) NULL;

CREATE INDEX `prayerresponse_guestSessionHash_createdAt_idx`
  ON `prayerresponse`(`guestSessionHash`, `createdAt`);

CREATE INDEX `prayerresponse_ipHash_createdAt_idx`
  ON `prayerresponse`(`ipHash`, `createdAt`);

-- ==============================
-- MIGRATION: 20260715000100_add_token_reward_safety_fields
-- ==============================
ALTER TABLE `token_reward_rule`
  ADD COLUMN `rewardsEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `dailyRewardCap` INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN `perCardRewardCap` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `minMessageLength` INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN `requireVoiceApproved` BOOLEAN NOT NULL DEFAULT true;

-- ==============================
-- MIGRATION: 20260805000100_add_prayed_reaction
-- ==============================
-- CreateTable
CREATE TABLE `prayer_prayed_reaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `prayerId` INTEGER NOT NULL,
    `actorType` ENUM('USER', 'GUEST') NOT NULL,
    `actorKeyHash` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `ipHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prayer_prayed_reaction_prayerId_idx`(`prayerId`),
    INDEX `prayer_prayed_reaction_ipHash_createdAt_idx`(`ipHash`, `createdAt`),
    UNIQUE INDEX `prayer_prayed_reaction_prayerId_actorType_actorKeyHash_key`(`prayerId`, `actorType`, `actorKeyHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `prayer_prayed_reaction` ADD CONSTRAINT `prayer_prayed_reaction_prayerId_fkey` FOREIGN KEY (`prayerId`) REFERENCES `home_prayer_card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prayer_prayed_reaction` ADD CONSTRAINT `prayer_prayed_reaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================
-- MIGRATION: 20260906000100_add_guest_fingerprint_to_home_prayer_card
-- ==============================
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
