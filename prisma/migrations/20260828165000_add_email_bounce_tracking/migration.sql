-- AlterTable
ALTER TABLE `users` ADD COLUMN `email_status` ENUM('DELIVERABLE', 'BOUNCED', 'DROPPED', 'COMPLAINED') NOT NULL DEFAULT 'DELIVERABLE',
    ADD COLUMN `email_bounce_reason` TEXT NULL,
    ADD COLUMN `email_bounced_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `people` ADD COLUMN `email_status` ENUM('DELIVERABLE', 'BOUNCED', 'DROPPED', 'COMPLAINED') NOT NULL DEFAULT 'DELIVERABLE',
    ADD COLUMN `email_bounce_reason` TEXT NULL,
    ADD COLUMN `email_bounced_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `email_bounces` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NULL,
    `email` VARCHAR(255) NOT NULL,
    `resend_email_id` VARCHAR(255) NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `bounce_type` VARCHAR(50) NULL,
    `reason` TEXT NULL,
    `recipient_type` VARCHAR(50) NULL,
    `recipient_id` VARCHAR(191) NULL,
    `is_resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolved_at` DATETIME(3) NULL,
    `resolved_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_bounces_church_id_idx`(`church_id`),
    INDEX `email_bounces_email_idx`(`email`),
    INDEX `email_bounces_is_resolved_idx`(`is_resolved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
