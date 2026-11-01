-- AlterTable
ALTER TABLE `people` ADD COLUMN `profile_token_opened_at` DATETIME(3) NULL,
    ADD COLUMN `names_confirmed` BOOLEAN NOT NULL DEFAULT true;
