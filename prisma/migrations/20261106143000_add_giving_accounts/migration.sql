-- CreateTable
CREATE TABLE `giving_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `bank_name` VARCHAR(100) NOT NULL,
    `account_name` VARCHAR(255) NOT NULL,
    `account_number` VARCHAR(34) NOT NULL,
    `currency` ENUM('NGN', 'USD', 'GBP', 'EUR') NOT NULL DEFAULT 'NGN',
    `note` VARCHAR(500) NULL,
    `purposes` JSON NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_id` VARCHAR(191) NULL,

    INDEX `giving_accounts_church_id_is_active_sort_order_idx`(`church_id`, `is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `giving_accounts` ADD CONSTRAINT `giving_accounts_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
