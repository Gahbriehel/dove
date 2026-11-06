-- CreateTable
CREATE TABLE `scriptures` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `kind` ENUM('WEEK', 'YEAR') NOT NULL,
    `text` VARCHAR(1500) NOT NULL,
    `reference` VARCHAR(100) NOT NULL,
    `translation` VARCHAR(20) NULL,
    `given_by` VARCHAR(100) NULL,
    `starts_on` DATE NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `created_by_id` VARCHAR(191) NULL,
    `updated_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scriptures_church_id_kind_status_starts_on_idx`(`church_id`, `kind`, `status`, `starts_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scriptures` ADD CONSTRAINT `scriptures_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
