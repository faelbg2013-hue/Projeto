-- CreateTable
CREATE TABLE `appointments` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `professionalId` CHAR(36) NOT NULL,
    `serviceId` CHAR(36) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'CONFIRMED',
    `notes` VARCHAR(500) NULL,
    `serviceNameSnapshot` VARCHAR(120) NOT NULL,
    `servicePriceSnapshot` DECIMAL(10, 2) NOT NULL,
    `serviceDurationMinutesSnapshot` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(80) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `appointments_tenantId_professionalId_startAt_idx`(`tenantId`, `professionalId`, `startAt`),
    INDEX `appointments_tenantId_clientId_startAt_idx`(`tenantId`, `clientId`, `startAt`),
    UNIQUE INDEX `appointments_tenantId_clientId_idempotencyKey_key`(`tenantId`, `clientId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professionals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Histórico do atendimento. Sobreposição de horários fica na transação com lock, não em unique de startAt.
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_range_chk` CHECK (`startAt` < `endAt`);
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_duration_chk` CHECK (`serviceDurationMinutesSnapshot` > 0);
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_price_chk` CHECK (`servicePriceSnapshot` >= 0);
