import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// GameState (Single row)
export const gamestate = sqliteTable('gamestate', {
  id: integer('id').primaryKey(),
  managerName: text('managerName').notNull(),
  managerTeamId: text('managerTeamId').notNull(),
  currentSeason: integer('currentSeason').notNull(),
  currentDate: text('currentDate').notNull(),
  currentWeek: integer('currentWeek').notNull(),
});

// Leagues
export const leagues = sqliteTable('leagues', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  level: integer('level').notNull(),
});

export const leaguesRelations = relations(leagues, ({ many }) => ({
  teams: many(teams),
  standings: many(standings),
  fixtures: many(fixtures),
  news: many(leagueNews),
}));

// Teams
export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  leagueId: text('leagueId').notNull().references(() => leagues.id),
  name: text('name').notNull(),
  reputation: integer('reputation').notNull(),
  overall: integer('overall').notNull(),
  tacticalStyle: text('tacticalStyle').notNull(),
  mentality: text('mentality').notNull(),
  formation: text('formation').notNull(),
  stadiumName: text('stadiumName'),
  stadiumCapacity: integer('stadiumCapacity'),
  primaryColor: text('primaryColor'),
  secondaryColor: text('secondaryColor'),
  transferBudget: integer('transferBudget').notNull(),
  wageBudget: integer('wageBudget').notNull(),
  managerConfidence: integer('managerConfidence').notNull(),
  
  // JSON Columns for tactical overrides and squad order
  customPositions: text('customPositions', { mode: 'json' }).$type<Record<number, {x: number, y: number}>>(),
  customRoles: text('customRoles', { mode: 'json' }).$type<Record<number, string>>(),
  playerIds: text('playerIds', { mode: 'json' }).$type<string[]>(),
});

export const teamsRelations = relations(teams, ({ one, many }) => ({
  league: one(leagues, {
    fields: [teams.leagueId],
    references: [leagues.id],
  }),
  players: many(players),
  standings: many(standings),
}));

// Players
export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  teamId: text('teamId').references(() => teams.id),
  name: text('name').notNull(),
  number: integer('number'),
  birthDate: text('birthDate').notNull(),
  role: text('role').notNull(),
  potential: integer('potential').notNull(),
  overall: integer('overall').notNull(),
  condition: integer('condition').notNull(),
  matchSharpness: integer('matchSharpness').notNull(),
  morale: integer('morale').notNull(),
  preferredFoot: text('preferredFoot').notNull(),
  wage: integer('wage').notNull(),
  contractExpires: integer('contractExpires'),
  
  // JSON Columns for complex nested data
  injury: text('injury', { mode: 'json' }).$type<{ type: string; weeksRemaining: number } | null>(),
  attributes: text('attributes', { mode: 'json' }).notNull().$type<any>(),
  hiddenTraits: text('hiddenTraits', { mode: 'json' }).$type<any>(),
  seasonStats: text('seasonStats', { mode: 'json' }).$type<any>(),
});

export const playersRelations = relations(players, ({ one }) => ({
  team: one(teams, {
    fields: [players.teamId],
    references: [teams.id],
  }),
}));

// Standings
export const standings = sqliteTable('standings', {
  leagueId: text('leagueId').notNull().references(() => leagues.id),
  teamId: text('teamId').notNull().references(() => teams.id),
  played: integer('played').notNull().default(0),
  won: integer('won').notNull().default(0),
  drawn: integer('drawn').notNull().default(0),
  lost: integer('lost').notNull().default(0),
  goalsFor: integer('goalsFor').notNull().default(0),
  goalsAgainst: integer('goalsAgainst').notNull().default(0),
  points: integer('points').notNull().default(0),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.leagueId, table.teamId] }),
  };
});

// Fixtures
export const fixtures = sqliteTable('fixtures', {
  id: text('id').primaryKey(),
  leagueId: text('leagueId').notNull().references(() => leagues.id),
  week: integer('week').notNull(),
  date: text('date'), // YYYY-MM-DD
  homeTeamId: text('homeTeamId').notNull().references(() => teams.id),
  awayTeamId: text('awayTeamId').notNull().references(() => teams.id),
  played: integer('played', { mode: 'boolean' }).notNull().default(false),
  homeScore: integer('homeScore'),
  awayScore: integer('awayScore'),
});

export const fixturesRelations = relations(fixtures, ({ one, many }) => ({
  league: one(leagues, {
    fields: [fixtures.leagueId],
    references: [leagues.id],
  }),
  homeTeam: one(teams, {
    fields: [fixtures.homeTeamId],
    references: [teams.id],
    relationName: 'homeFixtures'
  }),
  awayTeam: one(teams, {
    fields: [fixtures.awayTeamId],
    references: [teams.id],
    relationName: 'awayFixtures'
  }),
  goalEvents: many(fixtureGoals),
}));

// Fixture Goals
export const fixtureGoals = sqliteTable('fixture_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fixtureId: text('fixtureId').notNull().references(() => fixtures.id),
  playerId: text('playerId').notNull().references(() => players.id),
  teamId: text('teamId').notNull().references(() => teams.id),
  minute: integer('minute').notNull(),
});

export const fixtureGoalsRelations = relations(fixtureGoals, ({ one }) => ({
  fixture: one(fixtures, {
    fields: [fixtureGoals.fixtureId],
    references: [fixtures.id],
  }),
}));

// League News
export const leagueNews = sqliteTable('league_news', {
  id: text('id').primaryKey(),
  leagueId: text('leagueId').notNull().references(() => leagues.id),
  week: integer('week').notNull(),
  headline: text('headline').notNull(),
  type: text('type').notNull(),
  relatedPlayerId: text('relatedPlayerId').references(() => players.id),
  relatedTeamId: text('relatedTeamId').references(() => teams.id),
});

export const leagueNewsRelations = relations(leagueNews, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueNews.leagueId],
    references: [leagues.id],
  }),
}));

// Inbox Messages
export const inboxMessages = sqliteTable('inbox_messages', {
  id: text('id').primaryKey(),
  teamId: text('teamId').notNull().references(() => teams.id),
  date: text('date').notNull(),
  sender: text('sender').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  type: text('type').notNull(), // 'BIRTHDAY', 'TRANSFER', 'LEAGUE', 'MATCH'
  isRead: integer('isRead', { mode: 'boolean' }).notNull().default(false),
  isUrgent: integer('isUrgent', { mode: 'boolean' }).notNull().default(false),
  relatedEntityId: text('relatedEntityId'),
});

export const inboxMessagesRelations = relations(inboxMessages, ({ one }) => ({
  team: one(teams, {
    fields: [inboxMessages.teamId],
    references: [teams.id],
  }),
}));