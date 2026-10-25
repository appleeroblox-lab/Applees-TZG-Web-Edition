CREATE TABLE `debug_access` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `debug_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created` integer NOT NULL,
	`command` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `debug_limits` (
	`owner` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`reset` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `debug_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL
);
