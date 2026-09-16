-- AlterTable
ALTER TABLE `email_bounces` ADD COLUMN `email_type` VARCHAR(50) NULL,
    ADD COLUMN `registration_id` VARCHAR(255) NULL,
    ADD COLUMN `broadcast_content` JSON NULL;

-- CreateTable
CREATE TABLE `email_send_logs` (
    `id` VARCHAR(191) NOT NULL,
    `resend_email_id` VARCHAR(255) NOT NULL,
    `email_type` VARCHAR(50) NOT NULL,
    `church_id` VARCHAR(191) NULL,
    `person_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `registration_id` VARCHAR(255) NULL,
    `broadcast_content` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_send_logs_resend_email_id_key`(`resend_email_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
