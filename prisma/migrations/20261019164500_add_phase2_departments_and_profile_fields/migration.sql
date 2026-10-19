-- AlterTable
ALTER TABLE `people` ADD COLUMN `follow_up_notes` TEXT NULL,
    ADD COLUMN `follow_up_status` ENUM('PENDING', 'IN_PROGRESS', 'CONVERTED', 'INACTIVE') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `last_follow_up_at` DATETIME(3) NULL,
    ADD COLUMN `profile_token` VARCHAR(255) NULL,
    ADD COLUMN `profile_token_expires_at` DATETIME(3) NULL,
    MODIFY `membership_status` ENUM('VISITOR', 'MEMBER', 'WORKER', 'LEADER', 'PASTOR') NOT NULL DEFAULT 'VISITOR';

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `departments_church_id_idx`(`church_id`),
    UNIQUE INDEX `departments_church_id_name_key`(`church_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `department_memberships` (
    `id` VARCHAR(191) NOT NULL,
    `person_id` VARCHAR(191) NOT NULL,
    `department_id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(50) NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `department_memberships_person_id_idx`(`person_id`),
    INDEX `department_memberships_department_id_idx`(`department_id`),
    UNIQUE INDEX `department_memberships_person_id_department_id_key`(`person_id`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `people_profile_token_key` ON `people`(`profile_token`);

-- CreateIndex
CREATE INDEX `people_follow_up_status_idx` ON `people`(`follow_up_status`);

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_memberships` ADD CONSTRAINT `department_memberships_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_memberships` ADD CONSTRAINT `department_memberships_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
