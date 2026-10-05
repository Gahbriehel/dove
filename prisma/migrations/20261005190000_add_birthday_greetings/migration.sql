-- CreateTable
CREATE TABLE `birthday_greetings` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `person_id` VARCHAR(191) NOT NULL,
    `sent_by_user_id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `heading` VARCHAR(255) NULL,
    `message` TEXT NOT NULL,
    `image_url` VARCHAR(512) NULL,
    `cta_label` VARCHAR(100) NULL,
    `cta_url` VARCHAR(512) NULL,
    `resend_email_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `birthday_greetings_church_id_idx`(`church_id`),
    INDEX `birthday_greetings_church_id_year_idx`(`church_id`, `year`),
    INDEX `birthday_greetings_person_id_idx`(`person_id`),
    INDEX `birthday_greetings_sent_by_user_id_idx`(`sent_by_user_id`),
    UNIQUE INDEX `birthday_greetings_person_id_year_key`(`person_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `birthday_greetings` ADD CONSTRAINT `birthday_greetings_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `birthday_greetings` ADD CONSTRAINT `birthday_greetings_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `birthday_greetings` ADD CONSTRAINT `birthday_greetings_sent_by_user_id_fkey` FOREIGN KEY (`sent_by_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
