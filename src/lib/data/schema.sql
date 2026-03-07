
CREATE TABLE IF NOT EXISTS leagues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    leagueId TEXT NOT NULL,
    reputation INTEGER NOT NULL,
    overall INTEGER,
    tacticalStyle TEXT DEFAULT 'Balanced',
    mentality TEXT DEFAULT 'BALANCED',
    formation TEXT DEFAULT '4-4-2 Wide',
    stadiumName TEXT,
    stadiumCapacity INTEGER,
    primaryColor TEXT,
    secondaryColor TEXT,
    transferBudget INTEGER DEFAULT 0,
    wageBudget INTEGER DEFAULT 0,
    managerConfidence INTEGER DEFAULT 50,
    FOREIGN KEY(leagueId) REFERENCES leagues(id)
);

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    teamId TEXT,
    name TEXT NOT NULL,
    squadNumber INTEGER,
    age INTEGER NOT NULL,
    role TEXT NOT NULL,
    potential INTEGER NOT NULL,
    overall INTEGER,
    condition INTEGER DEFAULT 100,
    matchSharpness INTEGER DEFAULT 50,
    morale INTEGER DEFAULT 50,
    preferredFoot TEXT DEFAULT 'Right',
    wage INTEGER DEFAULT 0,
    contractExpires INTEGER,
    injuryType TEXT,
    injuryWeeksRemaining INTEGER DEFAULT 0,
    
    -- Technical
    passing INTEGER NOT NULL,
    finishing INTEGER NOT NULL,
    tackling INTEGER NOT NULL,
    dribbling INTEGER NOT NULL,
    crossing INTEGER NOT NULL,
    marking INTEGER NOT NULL,
    
    -- Mental
    vision INTEGER NOT NULL,
    composure INTEGER NOT NULL,
    decisions INTEGER NOT NULL,
    positioning INTEGER NOT NULL,
    concentration INTEGER NOT NULL,
    aggression INTEGER NOT NULL,
    anticipation INTEGER NOT NULL,
    workRate INTEGER NOT NULL,
    
    -- Physical
    pace INTEGER NOT NULL,
    acceleration INTEGER NOT NULL,
    stamina INTEGER NOT NULL,
    strength INTEGER NOT NULL,
    
    -- GK
    reflexes INTEGER NOT NULL,
    handling INTEGER NOT NULL,
    
    -- Hidden Traits
    injuryProneness INTEGER DEFAULT 50,
    consistency INTEGER DEFAULT 50,
    dirtiness INTEGER DEFAULT 50,
    importantMatches INTEGER DEFAULT 50,
    
    FOREIGN KEY(teamId) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS player_stats (
    playerId TEXT PRIMARY KEY,
    apps INTEGER DEFAULT 0,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    cleanSheets INTEGER DEFAULT 0,
    yellowCards INTEGER DEFAULT 0,
    redCards INTEGER DEFAULT 0,
    averageRating REAL DEFAULT 0.0,
    FOREIGN KEY(playerId) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS fixtures (
    id TEXT PRIMARY KEY,
    leagueId TEXT NOT NULL,
    week INTEGER NOT NULL,
    homeTeamId TEXT NOT NULL,
    awayTeamId TEXT NOT NULL,
    played INTEGER DEFAULT 0,
    homeScore INTEGER,
    awayScore INTEGER,
    FOREIGN KEY(leagueId) REFERENCES leagues(id),
    FOREIGN KEY(homeTeamId) REFERENCES teams(id),
    FOREIGN KEY(awayTeamId) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS standings (
    leagueId TEXT NOT NULL,
    teamId TEXT NOT NULL,
    played INTEGER DEFAULT 0,
    won INTEGER DEFAULT 0,
    drawn INTEGER DEFAULT 0,
    lost INTEGER DEFAULT 0,
    goalsFor INTEGER DEFAULT 0,
    goalsAgainst INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    PRIMARY KEY (leagueId, teamId),
    FOREIGN KEY(leagueId) REFERENCES leagues(id),
    FOREIGN KEY(teamId) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS gamestate (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    managerName TEXT,
    managerTeamId TEXT,
    currentSeason INTEGER NOT NULL,
    currentDate TEXT NOT NULL,
    currentWeek INTEGER NOT NULL
);
