import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/data/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/savegame.db',
  },
});