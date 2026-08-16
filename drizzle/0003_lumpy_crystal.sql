CREATE TABLE `player_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`handle` varchar(24) NOT NULL,
	`isPublic` int NOT NULL DEFAULT 1,
	`preferredCategory` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `player_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_profiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `player_profiles_handle_unique` UNIQUE(`handle`)
);
--> statement-breakpoint
ALTER TABLE `player_profiles` ADD CONSTRAINT `player_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;