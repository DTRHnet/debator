CREATE TABLE `matchmaking_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rulesetJson` text NOT NULL,
	`rulesetHash` varchar(64) NOT NULL,
	`rating` int NOT NULL DEFAULT 1000,
	`category` varchar(64),
	`status` enum('queued','matched','cancelled','expired') NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `matchmaking_queue_id` PRIMARY KEY(`id`),
	CONSTRAINT `matchmaking_queue_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `multiplayer_rooms` (
	`id` varchar(64) NOT NULL,
	`hostUserId` int NOT NULL,
	`topic` text NOT NULL,
	`rulesetJson` text NOT NULL,
	`state` enum('waiting','ready','countdown','speaking','turn_submitted','round_complete','judging','completed','abandoned','expired','cancelled') NOT NULL DEFAULT 'waiting',
	`stateVersion` int NOT NULL DEFAULT 0,
	`currentRound` int NOT NULL DEFAULT 1,
	`activeSide` enum('pro','con'),
	`deadlineAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `multiplayer_rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `room_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` varchar(64) NOT NULL,
	`eventId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `room_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`side` enum('pro','con') NOT NULL,
	`ready` int NOT NULL DEFAULT 0,
	`connected` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `room_turns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` varchar(64) NOT NULL,
	`round` int NOT NULL,
	`side` enum('pro','con') NOT NULL,
	`userId` int NOT NULL,
	`transcript` text NOT NULL,
	`idempotencyKey` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_turns_id` PRIMARY KEY(`id`),
	CONSTRAINT `room_turns_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `matchmaking_queue` ADD CONSTRAINT `matchmaking_queue_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD CONSTRAINT `multiplayer_rooms_hostUserId_users_id_fk` FOREIGN KEY (`hostUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_events` ADD CONSTRAINT `room_events_roomId_multiplayer_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `multiplayer_rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_players` ADD CONSTRAINT `room_players_roomId_multiplayer_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `multiplayer_rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_players` ADD CONSTRAINT `room_players_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_turns` ADD CONSTRAINT `room_turns_roomId_multiplayer_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `multiplayer_rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_turns` ADD CONSTRAINT `room_turns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `matchmaking_queue_status_created_idx` ON `matchmaking_queue` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `multiplayer_rooms_state_updated_idx` ON `multiplayer_rooms` (`state`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `room_events_room_event_idx` ON `room_events` (`roomId`,`eventId`);--> statement-breakpoint
CREATE INDEX `room_players_room_idx` ON `room_players` (`roomId`);--> statement-breakpoint
CREATE INDEX `room_players_user_idx` ON `room_players` (`userId`);--> statement-breakpoint
CREATE INDEX `room_turns_room_round_idx` ON `room_turns` (`roomId`,`round`);