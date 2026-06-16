CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`keyHash` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`lastUsed` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `jwt_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`tokenType` enum('access','refresh') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jwt_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `jwt_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenId` int NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`lastActivity` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','viewer') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended','deleted') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorSecret` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `lastPasswordChange` timestamp;--> statement-breakpoint
CREATE INDEX `idx_apikey_user_id` ON `api_keys` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_jwt_user_id` ON `jwt_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_jwt_expires_at` ON `jwt_tokens` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_session_user_id` ON `user_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_session_last_activity` ON `user_sessions` (`lastActivity`);