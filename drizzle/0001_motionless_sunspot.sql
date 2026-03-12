ALTER TABLE `gamestate` ADD `shortlist` text;--> statement-breakpoint
ALTER TABLE `scouting_reports` ADD `isPriority` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `scouting_reports` ADD `perceivedMin` integer;--> statement-breakpoint
ALTER TABLE `scouting_reports` ADD `perceivedMax` integer;