CREATE TABLE `chip_totals` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`player_id` text NOT NULL,
	`chips` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chip_totals_group_id_player_id_unique` ON `chip_totals` (`group_id`,`player_id`);