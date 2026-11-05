-- AlterTable
ALTER TABLE `people` ADD COLUMN `pin_hash` VARCHAR(255) NULL,
    ADD COLUMN `pin_failed_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `pin_locked_until` DATETIME(3) NULL,
    ADD COLUMN `user_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `people_user_id_key` ON `people`(`user_id`);

-- AddForeignKey
ALTER TABLE `people` ADD CONSTRAINT `people_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
