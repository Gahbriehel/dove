/*
  Warnings:

  - Made the column `church_id` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_church_id_fkey`;

-- AlterTable
ALTER TABLE `churches` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `branch_name` VARCHAR(255) NULL,
    ADD COLUMN `campus_name` VARCHAR(255) NULL,
    ADD COLUMN `email` VARCHAR(255) NULL,
    ADD COLUMN `phone` VARCHAR(50) NULL,
    ADD COLUMN `website_url` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(50) NULL,
    MODIFY `church_id` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
