-- AlterTable
ALTER TABLE `email_bounces` MODIFY `recipient_id` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `contact_submissions` (
    `id` VARCHAR(50) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `category` VARCHAR(100) NOT NULL,
    `message` TEXT NOT NULL,
    `is_private` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `contact_submissions_church_id_idx`(`church_id`),
    INDEX `contact_submissions_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contact_submissions` ADD CONSTRAINT `contact_submissions_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
