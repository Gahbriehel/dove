-- AlterTable
ALTER TABLE `events` ADD COLUMN `category` ENUM('GENERAL', 'CONFERENCE', 'VIGIL', 'COMMUNION', 'REVIVAL', 'WORSHIP', 'OUTREACH') NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN `requires_registration` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `highlights` JSON NULL,
    ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `events_church_id_status_start_date_idx` ON `events`(`church_id`, `status`, `start_date`);

-- CreateIndex
CREATE INDEX `events_church_id_requires_registration_idx` ON `events`(`church_id`, `requires_registration`);

-- CreateIndex
CREATE INDEX `events_church_id_is_featured_idx` ON `events`(`church_id`, `is_featured`);

-- CreateIndex
CREATE INDEX `events_church_id_category_idx` ON `events`(`church_id`, `category`);
