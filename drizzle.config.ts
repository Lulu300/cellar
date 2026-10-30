import { defineConfig } from 'drizzle-kit';
import { DATABASE_PATH } from './src/lib/server/paths';

export default defineConfig({
    schema: './src/lib/server/db/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    // Only the commands that open a database (push, pull, studio) use it: generate does not.
    dbCredentials: {
        url: DATABASE_PATH
    },
    verbose: true,
    strict: true
});
