-- DropForeignKey
ALTER TABLE `birthday_greetings` DROP FOREIGN KEY `birthday_greetings_person_id_fkey`;

-- DropIndex
DROP INDEX `birthday_greetings_person_id_year_key` ON `birthday_greetings`;

-- AlterTable
ALTER TABLE `churches` ADD COLUMN `short_name` VARCHAR(50) NULL,
    ADD COLUMN `whatsapp_number` VARCHAR(20) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `display_name` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `people` ADD COLUMN `whatsapp_opt_out` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `whatsapp_opt_out_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `birthday_greetings` ADD COLUMN `channel` ENUM('EMAIL', 'WHATSAPP') NOT NULL DEFAULT 'EMAIL',
    MODIFY `subject` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `message_templates` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `channel` ENUM('EMAIL', 'WHATSAPP') NOT NULL DEFAULT 'WHATSAPP',
    `purpose` ENUM('BIRTHDAY', 'VISITOR_FOLLOW_UP', 'PASTORAL_CHECK_IN') NOT NULL,
    `check_in_reason` ENUM('ABSENTEEISM', 'ILLNESS', 'BEREAVEMENT', 'WORKER_WELFARE', 'DISCIPLESHIP', 'FAMILY_SUPPORT', 'GENERAL_CHECK_IN') NULL,
    `name` VARCHAR(100) NOT NULL,
    `body` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `message_templates_church_id_channel_purpose_is_active_idx`(`church_id`, `channel`, `purpose`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outreach_messages` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `person_id` VARCHAR(191) NOT NULL,
    `sent_by_user_id` VARCHAR(191) NOT NULL,
    `channel` ENUM('EMAIL', 'WHATSAPP') NOT NULL DEFAULT 'WHATSAPP',
    `purpose` ENUM('BIRTHDAY', 'VISITOR_FOLLOW_UP', 'PASTORAL_CHECK_IN') NOT NULL,
    `check_in_id` VARCHAR(191) NULL,
    `birthday_year` INTEGER NULL,
    `template_id` VARCHAR(191) NULL,
    `to_phone` VARCHAR(20) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('OPENED', 'CONFIRMED_SENT', 'NOT_SENT') NOT NULL DEFAULT 'OPENED',
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `outreach_messages_church_id_created_at_idx`(`church_id`, `created_at`),
    INDEX `outreach_messages_person_id_created_at_idx`(`person_id`, `created_at`),
    INDEX `outreach_messages_sent_by_user_id_status_idx`(`sent_by_user_id`, `status`),
    INDEX `outreach_messages_purpose_status_idx`(`purpose`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `birthday_greetings_person_id_year_channel_key` ON `birthday_greetings`(`person_id`, `year`, `channel`);

-- AddForeignKey
ALTER TABLE `birthday_greetings` ADD CONSTRAINT `birthday_greetings_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outreach_messages` ADD CONSTRAINT `outreach_messages_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outreach_messages` ADD CONSTRAINT `outreach_messages_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outreach_messages` ADD CONSTRAINT `outreach_messages_sent_by_user_id_fkey` FOREIGN KEY (`sent_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outreach_messages` ADD CONSTRAINT `outreach_messages_check_in_id_fkey` FOREIGN KEY (`check_in_id`) REFERENCES `pastoral_check_ins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outreach_messages` ADD CONSTRAINT `outreach_messages_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `message_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

