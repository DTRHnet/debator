CREATE TABLE `debate_sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`topic` text NOT NULL,
	`topicSource` enum('random','custom') NOT NULL,
	`timerSeconds` int NOT NULL,
	`roundCount` int NOT NULL,
	`proTranscript` text NOT NULL,
	`conTranscript` text NOT NULL,
	`proScore` int,
	`conScore` int,
	`verdictJson` text,
	`status` enum('pending','unavailable','failed','complete') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `debate_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`timerSeconds` int NOT NULL DEFAULT 60,
	`roundCount` int NOT NULL DEFAULT 1,
	`preferredModel` varchar(160) NOT NULL DEFAULT 'google/gemma-3-27b-it:free',
	`encryptedOpenRouterKey` text,
	`keyLastFour` varchar(4),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `debate_sessions` ADD CONSTRAINT `debate_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `debate_sessions_user_created_idx` ON `debate_sessions` (`userId`,`createdAt`);