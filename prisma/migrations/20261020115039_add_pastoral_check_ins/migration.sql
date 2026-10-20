-- CreateTable
CREATE TABLE `pastoral_check_ins` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `person_id` VARCHAR(191) NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `assigned_to_id` VARCHAR(191) NULL,
    `reason` ENUM('ABSENTEEISM', 'ILLNESS', 'BEREAVEMENT', 'WORKER_WELFARE', 'DISCIPLESHIP', 'FAMILY_SUPPORT', 'GENERAL_CHECK_IN') NOT NULL DEFAULT 'GENERAL_CHECK_IN',
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `scheduled_for` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `outcome` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pastoral_check_ins_church_id_idx`(`church_id`),
    INDEX `pastoral_check_ins_person_id_idx`(`person_id`),
    INDEX `pastoral_check_ins_status_idx`(`status`),
    INDEX `pastoral_check_ins_assigned_to_id_idx`(`assigned_to_id`),
    INDEX `pastoral_check_ins_scheduled_for_idx`(`scheduled_for`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pastoral_check_ins` ADD CONSTRAINT `pastoral_check_ins_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pastoral_check_ins` ADD CONSTRAINT `pastoral_check_ins_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pastoral_check_ins` ADD CONSTRAINT `pastoral_check_ins_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pastoral_check_ins` ADD CONSTRAINT `pastoral_check_ins_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
