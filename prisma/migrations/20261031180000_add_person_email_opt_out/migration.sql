-- AlterTable
ALTER TABLE `people` ADD COLUMN `email_opt_out` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `email_opt_out_at` DATETIME(3) NULL;
