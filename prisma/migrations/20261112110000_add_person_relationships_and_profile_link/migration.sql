-- AlterTable
ALTER TABLE `message_templates` MODIFY `purpose` ENUM('BIRTHDAY', 'VISITOR_FOLLOW_UP', 'PASTORAL_CHECK_IN', 'PROFILE_LINK') NOT NULL;

-- AlterTable
ALTER TABLE `outreach_messages` MODIFY `purpose` ENUM('BIRTHDAY', 'VISITOR_FOLLOW_UP', 'PASTORAL_CHECK_IN', 'PROFILE_LINK') NOT NULL;

-- CreateTable
CREATE TABLE `person_relationships` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `person_id` VARCHAR(191) NOT NULL,
    `related_person_id` VARCHAR(191) NOT NULL,
    `type` ENUM('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'OTHER') NOT NULL,
    `note` VARCHAR(100) NULL,
    `created_by_person_id` VARCHAR(191) NULL,
    `created_by_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `person_relationships_related_person_id_idx`(`related_person_id`),
    INDEX `person_relationships_church_id_idx`(`church_id`),
    UNIQUE INDEX `person_relationships_person_id_related_person_id_key`(`person_id`, `related_person_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `person_relationships` ADD CONSTRAINT `person_relationships_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `person_relationships` ADD CONSTRAINT `person_relationships_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `person_relationships` ADD CONSTRAINT `person_relationships_related_person_id_fkey` FOREIGN KEY (`related_person_id`) REFERENCES `people`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `person_relationships` ADD CONSTRAINT `person_relationships_created_by_person_id_fkey` FOREIGN KEY (`created_by_person_id`) REFERENCES `people`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
