-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `bookingMode` ENUM('NORMAL', 'POINTS') NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `redemptionPointsSnapshot` INTEGER NULL;

-- AlterTable
ALTER TABLE `points_transactions` ADD COLUMN `redeemAppointmentId` CHAR(36) NULL,
    ADD COLUMN `reversalOfTransactionId` CHAR(36) NULL,
    MODIFY `type` ENUM('EARN', 'REDEEM', 'REDEEM_REVERSAL', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT') NOT NULL;

-- AlterTable
ALTER TABLE `services` ADD COLUMN `redemptionPoints` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `points_transactions_reversalOfTransactionId_key` ON `points_transactions`(`reversalOfTransactionId`);

-- CreateIndex
CREATE UNIQUE INDEX `points_transactions_tenantId_redeemAppointmentId_key` ON `points_transactions`(`tenantId`, `redeemAppointmentId`);

-- AddForeignKey
ALTER TABLE `points_transactions` ADD CONSTRAINT `points_transactions_reversalOfTransactionId_fkey` FOREIGN KEY (`reversalOfTransactionId`) REFERENCES `points_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks
ALTER TABLE `services` ADD CONSTRAINT `services_redemption_points_positive` CHECK (`redemptionPoints` IS NULL OR `redemptionPoints` > 0);

ALTER TABLE `points_transactions` DROP CHECK `points_transactions_earn_key_chk`;

ALTER TABLE `points_transactions` ADD CONSTRAINT `points_transactions_keys_chk` CHECK (
    (`type` = 'EARN' AND `earnAppointmentId` IS NOT NULL AND `redeemAppointmentId` IS NULL)
    OR (`type` = 'REDEEM' AND `redeemAppointmentId` IS NOT NULL AND `earnAppointmentId` IS NULL)
    OR (`type` = 'REDEEM_REVERSAL' AND `earnAppointmentId` IS NULL AND `redeemAppointmentId` IS NULL)
    OR (`type` IN ('ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT') AND `earnAppointmentId` IS NULL AND `redeemAppointmentId` IS NULL)
);
