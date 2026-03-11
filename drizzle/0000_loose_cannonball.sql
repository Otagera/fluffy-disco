CREATE TABLE `fixture_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixtureId` text NOT NULL,
	`playerId` text NOT NULL,
	`teamId` text NOT NULL,
	`minute` integer NOT NULL,
	FOREIGN KEY (`fixtureId`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`leagueId` text NOT NULL,
	`week` integer NOT NULL,
	`date` text,
	`homeTeamId` text NOT NULL,
	`awayTeamId` text NOT NULL,
	`played` integer DEFAULT false NOT NULL,
	`homeScore` integer,
	`awayScore` integer,
	FOREIGN KEY (`leagueId`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`homeTeamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`awayTeamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gamestate` (
	`id` integer PRIMARY KEY NOT NULL,
	`managerName` text NOT NULL,
	`managerTeamId` text NOT NULL,
	`currentSeason` integer NOT NULL,
	`currentDate` text NOT NULL,
	`currentWeek` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbox_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`date` text NOT NULL,
	`sender` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`type` text NOT NULL,
	`isRead` integer DEFAULT false NOT NULL,
	`isUrgent` integer DEFAULT false NOT NULL,
	`relatedEntityId` text,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `league_news` (
	`id` text PRIMARY KEY NOT NULL,
	`leagueId` text NOT NULL,
	`week` integer NOT NULL,
	`headline` text NOT NULL,
	`type` text NOT NULL,
	`relatedPlayerId` text,
	`relatedTeamId` text,
	FOREIGN KEY (`leagueId`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`relatedPlayerId`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`relatedTeamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`level` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text,
	`name` text NOT NULL,
	`number` integer,
	`birthDate` text NOT NULL,
	`role` text NOT NULL,
	`potential` integer NOT NULL,
	`overall` integer NOT NULL,
	`condition` integer NOT NULL,
	`matchSharpness` integer NOT NULL,
	`morale` integer NOT NULL,
	`preferredFoot` text NOT NULL,
	`wage` integer NOT NULL,
	`contractExpires` text,
	`consistency` integer DEFAULT 10 NOT NULL,
	`injury` text,
	`attributes` text NOT NULL,
	`hiddenTraits` text,
	`seasonStats` text,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scouting_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`playerId` text NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`progressDays` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `standings` (
	`leagueId` text NOT NULL,
	`teamId` text NOT NULL,
	`played` integer DEFAULT 0 NOT NULL,
	`won` integer DEFAULT 0 NOT NULL,
	`drawn` integer DEFAULT 0 NOT NULL,
	`lost` integer DEFAULT 0 NOT NULL,
	`goalsFor` integer DEFAULT 0 NOT NULL,
	`goalsAgainst` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`leagueId`, `teamId`),
	FOREIGN KEY (`leagueId`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`leagueId` text NOT NULL,
	`name` text NOT NULL,
	`reputation` integer NOT NULL,
	`overall` integer NOT NULL,
	`tacticalStyle` text NOT NULL,
	`mentality` text NOT NULL,
	`formation` text NOT NULL,
	`stadiumName` text,
	`stadiumCapacity` integer,
	`primaryColor` text,
	`secondaryColor` text,
	`transferBudget` integer NOT NULL,
	`wageBudget` integer NOT NULL,
	`managerConfidence` integer NOT NULL,
	`customPositions` text,
	`customRoles` text,
	`playerIds` text,
	FOREIGN KEY (`leagueId`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action
);
