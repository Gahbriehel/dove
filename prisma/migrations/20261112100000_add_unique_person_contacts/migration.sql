-- DropIndex
DROP INDEX `people_email_idx` ON `people`;

-- DropIndex
DROP INDEX `people_phone_idx` ON `people`;

-- CreateIndex
CREATE UNIQUE INDEX `people_church_id_email_key` ON `people`(`church_id`, `email`);

-- CreateIndex
CREATE UNIQUE INDEX `people_church_id_phone_key` ON `people`(`church_id`, `phone`);
