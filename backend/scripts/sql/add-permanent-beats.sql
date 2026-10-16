-- Permanent beat templates + weekly schedule (MySQL)
-- Run once on the API database (phpMyAdmin / mysql client) when deploying.

CREATE TABLE IF NOT EXISTS `beat` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `assigneeId` INT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `beat_tenantId_assigneeId_active_idx` (`tenantId`, `assigneeId`, `active`),
  CONSTRAINT `beat_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `beat_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `beatmember` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `beatId` INT NOT NULL,
  `leadId` INT NULL,
  `customerId` INT NULL,
  `sequence` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `beatmember_beatId_sequence_idx` (`beatId`, `sequence`),
  CONSTRAINT `beatmember_beatId_fkey` FOREIGN KEY (`beatId`) REFERENCES `beat`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `beatmember_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `beatmember_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `beatschedule` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `userId` INT NOT NULL,
  `weekday` INT NOT NULL,
  `beatId` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `beatschedule_tenantId_userId_weekday_key` (`tenantId`, `userId`, `weekday`),
  INDEX `beatschedule_tenantId_userId_idx` (`tenantId`, `userId`),
  CONSTRAINT `beatschedule_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `beatschedule_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `beatschedule_beatId_fkey` FOREIGN KEY (`beatId`) REFERENCES `beat`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Link day stops to a template (run once; ignore error if column already exists)
ALTER TABLE `beatstop` ADD COLUMN `beatId` INT NULL;
ALTER TABLE `beatstop` ADD INDEX `beatstop_beatId_plannedAt_idx` (`beatId`, `plannedAt`);
ALTER TABLE `beatstop` ADD CONSTRAINT `beatstop_beatId_fkey` FOREIGN KEY (`beatId`) REFERENCES `beat`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
