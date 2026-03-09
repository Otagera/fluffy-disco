
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'savegame.db');
const SCHEMA_PATH = path.join(process.cwd(), 'src', 'lib', 'data', 'schema.sql');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

export const db = new Database(DB_PATH);

export function initializeDatabase() {
    const tableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='gamestate'").get() as { count: number };
    
    if (tableCheck.count === 0) {
        console.log('Initializing new SQLite database from schema...');
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema);
        return;
    }

    // Lightweight forward-only migrations for existing save files.
    const hasColumn = (table: string, column: string) => {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        return columns.some((c) => c.name === column);
    };

    const ensureColumn = (table: string, column: string, definition: string) => {
        if (!hasColumn(table, column)) {
            console.log(`Applying migration: ${table}.${column}`);
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        }
    };

    // teams additions
    ensureColumn('teams', 'overall', 'INTEGER');
    ensureColumn('teams', 'tacticalStyle', "TEXT DEFAULT 'Balanced'");
    ensureColumn('teams', 'mentality', "TEXT DEFAULT 'BALANCED'");
    ensureColumn('teams', 'formation', "TEXT DEFAULT '4-4-2 Wide'");
    ensureColumn('teams', 'stadiumName', 'TEXT');
    ensureColumn('teams', 'stadiumCapacity', 'INTEGER');
    ensureColumn('teams', 'primaryColor', 'TEXT');
    ensureColumn('teams', 'secondaryColor', 'TEXT');
    ensureColumn('teams', 'transferBudget', 'INTEGER DEFAULT 0');
    ensureColumn('teams', 'wageBudget', 'INTEGER DEFAULT 0');
    ensureColumn('teams', 'managerConfidence', 'INTEGER DEFAULT 50');

    // players additions
    ensureColumn('players', 'squadNumber', 'INTEGER');
    ensureColumn('players', 'overall', 'INTEGER');
    ensureColumn('players', 'matchSharpness', 'INTEGER DEFAULT 50');
    ensureColumn('players', 'morale', 'INTEGER DEFAULT 50');
    ensureColumn('players', 'preferredFoot', "TEXT DEFAULT 'Right'");
    ensureColumn('players', 'wage', 'INTEGER DEFAULT 0');
    ensureColumn('players', 'contractExpires', 'INTEGER');
    ensureColumn('players', 'injuryType', 'TEXT');
    ensureColumn('players', 'injuryWeeksRemaining', 'INTEGER DEFAULT 0');
    ensureColumn('players', 'decisions', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'positioning', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'concentration', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'aggression', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'anticipation', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'workRate', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'pace', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'acceleration', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'stamina', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'strength', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'reflexes', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'handling', 'INTEGER NOT NULL DEFAULT 50');
    ensureColumn('players', 'injuryProneness', 'INTEGER DEFAULT 50');
    ensureColumn('players', 'consistency', 'INTEGER DEFAULT 50');
    ensureColumn('players', 'dirtiness', 'INTEGER DEFAULT 50');
    ensureColumn('players', 'importantMatches', 'INTEGER DEFAULT 50');

    // fixtures additions
    ensureColumn('fixtures', 'homeScore', 'INTEGER');
    ensureColumn('fixtures', 'awayScore', 'INTEGER');
}
