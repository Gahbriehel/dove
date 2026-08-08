-- AlterTable
ALTER TABLE `events` ADD COLUMN `google_calendar_sync` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `image_url` VARCHAR(512) NULL;

-- AlterTable
ALTER TABLE `registrations` ADD COLUMN `google_calendar_sync` BOOLEAN NOT NULL DEFAULT false;
