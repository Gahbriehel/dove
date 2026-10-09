-- AlterTable
ALTER TABLE `email_send_logs` ADD COLUMN `recipient_email` VARCHAR(255) NULL,
    ADD COLUMN `recipient_name` VARCHAR(255) NULL,
    ADD COLUMN `subject` VARCHAR(255) NULL,
    ADD COLUMN `sent_by_user_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `email_send_logs_church_id_idx` ON `email_send_logs`(`church_id`);

-- CreateIndex
CREATE INDEX `email_send_logs_church_id_created_at_idx` ON `email_send_logs`(`church_id`, `created_at`);

-- CreateIndex
CREATE INDEX `email_send_logs_email_type_idx` ON `email_send_logs`(`email_type`);

-- CreateIndex
CREATE INDEX `email_send_logs_recipient_email_idx` ON `email_send_logs`(`recipient_email`);

-- CreateIndex
CREATE INDEX `email_send_logs_sent_by_user_id_idx` ON `email_send_logs`(`sent_by_user_id`);
