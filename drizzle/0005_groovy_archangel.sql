CREATE TABLE `multiplayer_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` varchar(64) NOT NULL,
	`winnerSide` enum('pro','con','draw','abandoned','server_fault') NOT NULL,
	`winningUserId` int,
	`finalizationKey` varchar(96) NOT NULL,
	`reason` varchar(64) NOT NULL DEFAULT 'completed',
	`aiAnalysisJson` text,
	`finalizedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `multiplayer_results_roomId_unique` UNIQUE(`roomId`),
	CONSTRAINT `multiplayer_results_finalizationKey_unique` UNIQUE(`finalizationKey`)
);
--> statement-breakpoint
CREATE TABLE `player_rating_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resultId` int NOT NULL,
	`roomId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`opponentUserId` int,
	`priorRating` int NOT NULL,
	`newRating` int NOT NULL,
	`delta` int NOT NULL,
	`outcome` enum('win','loss','draw','abandonment') NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `player_rating_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_rating_events_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `rating` int DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `gamesPlayed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `wins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `losses` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `draws` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `abandons` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `peakRating` int DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_results` ADD CONSTRAINT `multiplayer_results_roomId_multiplayer_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `multiplayer_rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `multiplayer_results` ADD CONSTRAINT `multiplayer_results_winningUserId_users_id_fk` FOREIGN KEY (`winningUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_rating_events` ADD CONSTRAINT `player_rating_events_resultId_multiplayer_results_id_fk` FOREIGN KEY (`resultId`) REFERENCES `multiplayer_results`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_rating_events` ADD CONSTRAINT `player_rating_events_roomId_multiplayer_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `multiplayer_rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_rating_events` ADD CONSTRAINT `player_rating_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_rating_events` ADD CONSTRAINT `player_rating_events_opponentUserId_users_id_fk` FOREIGN KEY (`opponentUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `player_rating_events_user_created_idx` ON `player_rating_events` (`userId`,`createdAt`);