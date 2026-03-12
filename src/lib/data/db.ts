import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "savegame.db");

// Forced refresh to fix SQLITE_READONLY_DBMOVED after schema push
// HMR Trigger: 2026-03-10
const sqlite = new Database(DB_PATH);

// Initialize Drizzle ORM
export { sqlite };
export const db = drizzle(sqlite, { schema });
