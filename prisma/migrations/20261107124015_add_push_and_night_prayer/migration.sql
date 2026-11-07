-- AlterTable
ALTER TABLE `scriptures` ADD COLUMN `notified_at` DATETIME(3) NULL,
    ADD COLUMN `notify_members` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `push_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(1024) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `topics` JSON NOT NULL,
    `person_id` VARCHAR(191) NULL,
    `user_agent` VARCHAR(255) NULL,
    `failure_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `push_subscriptions_endpoint_key`(`endpoint`(500)),
    INDEX `push_subscriptions_church_id_idx`(`church_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `night_prayers` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(512) NULL,
    `meet_url` VARCHAR(255) NOT NULL,
    `time_of_day` VARCHAR(5) NOT NULL,
    `duration_min` INTEGER NOT NULL DEFAULT 60,
    `join_opens_min_before` INTEGER NOT NULL DEFAULT 10,
    `daysOfWeek` JSON NOT NULL,
    `reminder_offsets_min` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updated_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `night_prayers_church_id_key`(`church_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `night_prayer_exceptions` (
    `id` VARCHAR(191) NOT NULL,
    `night_prayer_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `cancelled` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `night_prayer_exceptions_night_prayer_id_date_key`(`night_prayer_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `confession_reminders` (
    `id` VARCHAR(191) NOT NULL,
    `confession_id` VARCHAR(191) NOT NULL,
    `time_of_day` VARCHAR(5) NOT NULL,
    `daysOfWeek` JSON NOT NULL,
    `starts_on` DATE NULL,
    `ends_on` DATE NULL,
    `message` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `confession_reminders_confession_id_idx`(`confession_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `encouragement_messages` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `text` VARCHAR(240) NOT NULL,
    `reference` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `encouragement_messages_church_id_is_active_last_sent_at_idx`(`church_id`, `is_active`, `last_sent_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_settings` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `scripture_send_time` VARCHAR(5) NOT NULL DEFAULT '07:00',
    `encouragement_slots` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_settings_church_id_key`(`church_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_log` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `topic` VARCHAR(30) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `body` VARCHAR(300) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `recipients` INTEGER NOT NULL DEFAULT 0,
    `delivered` INTEGER NOT NULL DEFAULT 0,
    `failed` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notification_log_key_key`(`key`),
    INDEX `notification_log_church_id_created_at_idx`(`church_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `night_prayers` ADD CONSTRAINT `night_prayers_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `night_prayer_exceptions` ADD CONSTRAINT `night_prayer_exceptions_night_prayer_id_fkey` FOREIGN KEY (`night_prayer_id`) REFERENCES `night_prayers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `confession_reminders` ADD CONSTRAINT `confession_reminders_confession_id_fkey` FOREIGN KEY (`confession_id`) REFERENCES `confessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `encouragement_messages` ADD CONSTRAINT `encouragement_messages_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_settings` ADD CONSTRAINT `notification_settings_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
