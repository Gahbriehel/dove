-- AlterTable
ALTER TABLE `people` MODIFY `follow_up_status` ENUM('PENDING', 'IN_PROGRESS', 'CONVERTED', 'INACTIVE') NULL;

-- Remove pending follow up status from persons who are not visitors
UPDATE `people` SET `follow_up_status` = NULL WHERE `membership_status` != 'VISITOR' AND `follow_up_status` = 'PENDING';
