-- CreateTable
CREATE TABLE `confessions` (
    `id` VARCHAR(191) NOT NULL,
    `church_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `body` TEXT NOT NULL,
    `scripture_ref` VARCHAR(100) NULL,
    `category` VARCHAR(50) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `listen_count` INTEGER NOT NULL DEFAULT 0,
    `created_by_id` VARCHAR(191) NULL,
    `updated_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `confessions_church_id_status_sort_order_idx`(`church_id`, `status`, `sort_order`),
    UNIQUE INDEX `confessions_church_id_slug_key`(`church_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `confession_audio` (
    `id` VARCHAR(191) NOT NULL,
    `confession_id` VARCHAR(191) NOT NULL,
    `voice` ENUM('FEMALE', 'MALE') NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `duration_sec` INTEGER NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `text_hash` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `confession_audio_confession_id_voice_key`(`confession_id`, `voice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `confessions` ADD CONSTRAINT `confessions_church_id_fkey` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `confession_audio` ADD CONSTRAINT `confession_audio_confession_id_fkey` FOREIGN KEY (`confession_id`) REFERENCES `confessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
