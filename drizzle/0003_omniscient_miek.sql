ALTER TABLE `auditLogs` MODIFY COLUMN `resourceId` varchar(255);--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `resource` varchar(128);--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `status` enum('success','failure') DEFAULT 'success';--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `errorMessage` text;