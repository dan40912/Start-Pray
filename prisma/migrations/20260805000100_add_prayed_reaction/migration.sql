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
