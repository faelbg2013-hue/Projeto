-- CreateTable
CREATE TABLE `professional_schedules` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `professionalId` CHAR(36) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startTime` CHAR(5) NOT NULL,
    `endTime` CHAR(5) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `professional_schedules_tenantId_professionalId_dayOfWeek_idx`(`tenantId`, `professionalId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professional_time_blocks` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `professionalId` CHAR(36) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `reason` VARCHAR(240) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `professional_time_blocks_tenantId_professionalId_startAt_end_idx`(`tenantId`, `professionalId`, `startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professional_schedule_exceptions` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `professionalId` CHAR(36) NOT NULL,
    `date` CHAR(10) NOT NULL,
    `startTime` CHAR(5) NULL,
    `endTime` CHAR(5) NULL,
    `type` ENUM('BLOCK', 'OPEN') NOT NULL,
    `reason` VARCHAR(240) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `professional_schedule_exceptions_tenantId_professionalId_dat_idx`(`tenantId`, `professionalId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `professional_schedules` ADD CONSTRAINT `professional_schedules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professional_schedules` ADD CONSTRAINT `professional_schedules_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professionals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professional_time_blocks` ADD CONSTRAINT `professional_time_blocks_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professional_time_blocks` ADD CONSTRAINT `professional_time_blocks_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professionals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professional_schedule_exceptions` ADD CONSTRAINT `professional_schedule_exceptions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `professional_schedule_exceptions` ADD CONSTRAINT `professional_schedule_exceptions_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `professionals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Wall-clock and range checks. Overlap stays in the application because MySQL has no exclusion constraint.
ALTER TABLE `professional_schedules` ADD CONSTRAINT `professional_schedules_day_chk` CHECK (`dayOfWeek` BETWEEN 1 AND 7);
ALTER TABLE `professional_schedules` ADD CONSTRAINT `professional_schedules_time_chk` CHECK (`startTime` < `endTime`);
ALTER TABLE `professional_time_blocks` ADD CONSTRAINT `professional_time_blocks_range_chk` CHECK (`startAt` < `endAt`);
ALTER TABLE `professional_schedule_exceptions` ADD CONSTRAINT `professional_schedule_exceptions_time_chk` CHECK (
    (`startTime` IS NULL AND `endTime` IS NULL) OR (`startTime` IS NOT NULL AND `endTime` IS NOT NULL AND `startTime` < `endTime`)
);
