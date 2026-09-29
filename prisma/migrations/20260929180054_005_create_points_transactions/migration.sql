-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `pointsSnapshot` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `points_transactions` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `type` ENUM('EARN', 'REDEEM', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT') NOT NULL,
    `points` INTEGER NOT NULL,
    `reason` VARCHAR(240) NOT NULL,
    `appointmentId` CHAR(36) NULL,
    `earnAppointmentId` CHAR(36) NULL,
    `createdByUserId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `points_transactions_tenantId_clientId_createdAt_idx`(`tenantId`, `clientId`, `createdAt`),
    INDEX `points_transactions_appointmentId_idx`(`appointmentId`),
    UNIQUE INDEX `points_transactions_tenantId_earnAppointmentId_key`(`tenantId`, `earnAppointmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `points_transactions` ADD CONSTRAINT `points_transactions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `points_transactions` ADD CONSTRAINT `points_transactions_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `points_transactions` ADD CONSTRAINT `points_transactions_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks
ALTER TABLE `points_transactions` ADD CONSTRAINT `points_transactions_points_positive` CHECK (`points` > 0);
ALTER TABLE `points_transactions` ADD CONSTRAINT `points_transactions_earn_key_chk` CHECK (
    (`type` = 'EARN' AND `earnAppointmentId` IS NOT NULL)
    OR (`type` <> 'EARN' AND `earnAppointmentId` IS NULL)
);

-- AddForeignKey
ALTER TABLE `points_transactions` ADD CONSTRAINT `points_transactions_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
