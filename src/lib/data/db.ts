
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
    }
}
