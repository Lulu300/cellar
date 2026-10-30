import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrationsWith } from '../../../test/database';
import { migrateSchema, openDatabase } from './connection';

const folders: string[] = [];
afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function migrations(added: { tag: string; sql: string }[]) {
    const folder = migrationsWith(added);
    folders.push(folder);
    return folder;
}

function tableNames(database: ReturnType<typeof openDatabase>): string[] {
    return database.$client
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .pluck()
        .all() as string[];
}

describe('migrateSchema', () => {
    const sound = { tag: '9000_sound', sql: 'CREATE TABLE `sound` (`id` integer);' };
    const broken = { tag: '9001_broken', sql: 'UPDATE `missing`\nSET `id` = 1;' };

    it('names the pending migrations, quotes the failing statement and its reason, and applies none of them', () => {
        const database = openDatabase(':memory:');
        migrateSchema(database);
        const tablesBefore = tableNames(database);

        expect(() => migrateSchema(database, migrations([sound, broken]))).toThrow(
            "Database migration failed, nothing was applied (pending migrations: 9000_sound, 9001_broken): Failed to run the query 'UPDATE `missing` SET `id` = 1;': no such table: missing"
        );
        expect(tableNames(database)).toEqual(tablesBefore);
    });

    it('names only the migrations newer than the last one applied', () => {
        const database = openDatabase(':memory:');
        migrateSchema(database, migrations([sound]));

        expect(() => migrateSchema(database, migrations([sound, broken]))).toThrow(
            /\(pending migrations: 9001_broken\)/
        );
        expect(tableNames(database)).toContain('sound');
    });

    // The check reads every table, at every start.
    it('checks the foreign keys only when a migration is pending', () => {
        const database = openDatabase(':memory:');
        const prepare = vi.spyOn(database.$client, 'prepare');
        const checkedForeignKeys = () =>
            prepare.mock.calls.some(([sql]) => sql.includes('pragma_foreign_key_check'));

        migrateSchema(database);
        prepare.mockClear();
        migrateSchema(database);
        expect(checkedForeignKeys()).toBe(false);

        migrateSchema(database, migrations([sound]));
        expect(checkedForeignKeys()).toBe(true);
    });

    describe('foreign keys', () => {
        /** A database up to date, holding a container inside another. */
        function nestedContainers() {
            const database = openDatabase(':memory:');
            migrateSchema(database);
            database.$client.exec(
                `INSERT INTO storage_containers (id, name, parent_container_id, created_at, updated_at)
                 VALUES ('cellar', 'Cellar', NULL, 0, 0), ('rack', 'Rack', 'cellar', 0, 0)`
            );
            return database;
        }

        function parentOfRack(database: ReturnType<typeof openDatabase>) {
            return database.$client
                .prepare("SELECT parent_container_id FROM storage_containers WHERE id = 'rack'")
                .pluck()
                .get();
        }

        // The way drizzle-kit changes a constraint. Dropping the old table, with the foreign keys
        // on, would fire ON DELETE SET NULL on the rows copied into the new one.
        const recreateContainers = {
            tag: '9000_recreate_containers',
            sql: `CREATE TABLE \`__new_storage_containers\` (
                    \`id\` text PRIMARY KEY NOT NULL,
                    \`name\` text NOT NULL,
                    \`parent_container_id\` text,
                    \`created_at\` integer NOT NULL,
                    \`updated_at\` integer NOT NULL,
                    FOREIGN KEY (\`parent_container_id\`) REFERENCES \`storage_containers\`(\`id\`) ON DELETE set null
                );
                --> statement-breakpoint
                INSERT INTO \`__new_storage_containers\` SELECT * FROM \`storage_containers\`;
                --> statement-breakpoint
                DROP TABLE \`storage_containers\`;
                --> statement-breakpoint
                ALTER TABLE \`__new_storage_containers\` RENAME TO \`storage_containers\`;`
        };

        it('keeps the links to a table that a migration recreates', () => {
            const database = nestedContainers();

            migrateSchema(database, migrations([recreateContainers]));

            expect(parentOfRack(database)).toBe('cellar');
            expect(database.$client.pragma('foreign_keys', { simple: true })).toBe(1);
        });

        it('applies none of the migrations when one leaves a row pointing to nothing', () => {
            const database = nestedContainers();
            const folder = migrations([
                recreateContainers,
                {
                    tag: '9001_dangling',
                    sql: "UPDATE `storage_containers` SET `parent_container_id` = 'gone';"
                }
            ]);

            expect(() => migrateSchema(database, folder)).toThrow(
                /nothing was applied \(pending migrations: 9000_recreate_containers, 9001_dangling\): .*the migration leaves rows that refer to missing rows: storage_containers -> storage_containers$/
            );
            expect(parentOfRack(database)).toBe('cellar');
            expect(database.$client.pragma('foreign_keys', { simple: true })).toBe(1);
        });

        it('names only the kinds of links that the migrations break', () => {
            const database = nestedContainers();
            database.$client.pragma('foreign_keys = OFF');
            database.$client.exec(
                "INSERT INTO storage_cases (id, name, capacity, container_id, created_at, updated_at) VALUES ('lost', 'Lost', 6, 'gone', 0, 0)"
            );
            database.$client.pragma('foreign_keys = ON');
            const folder = migrations([
                {
                    tag: '9001_dangling',
                    sql: "INSERT INTO `storage_cases` (`id`, `name`, `capacity`, `container_id`, `created_at`, `updated_at`) VALUES ('also-lost', 'Also lost', 6, 'gone', 0, 0);"
                }
            ]);

            expect(() => migrateSchema(database, folder)).toThrow(
                /refer to missing rows: storage_cases -> storage_containers$/
            );
            expect(database.$client.pragma('foreign_key_check')).toHaveLength(1);
        });

        // A total count would see one link repaired and one broken, and let it pass.
        it('refuses a migration that repairs links of one kind and breaks another', () => {
            const database = nestedContainers();
            database.$client.pragma('foreign_keys = OFF');
            database.$client.exec(
                "INSERT INTO storage_cases (id, name, capacity, container_id, created_at, updated_at) VALUES ('lost', 'Lost', 6, 'gone', 0, 0)"
            );
            database.$client.pragma('foreign_keys = ON');
            const folder = migrations([
                {
                    tag: '9001_swap_broken_links',
                    sql: `UPDATE \`storage_cases\` SET \`container_id\` = 'cellar' WHERE \`id\` = 'lost';
                        --> statement-breakpoint
                        UPDATE \`storage_containers\` SET \`parent_container_id\` = 'gone' WHERE \`id\` = 'rack';`
                }
            ]);

            expect(() => migrateSchema(database, folder)).toThrow(
                /refer to missing rows: storage_containers -> storage_containers$/
            );
            expect(parentOfRack(database)).toBe('cellar');
        });

        // Such as a database edited with the sqlite3 shell, where foreign keys are off by default.
        it('still migrates a database whose links were broken before', () => {
            const database = nestedContainers();
            database.$client.pragma('foreign_keys = OFF');
            database.$client.exec(
                "INSERT INTO storage_cases (id, name, capacity, container_id, created_at, updated_at) VALUES ('lost', 'Lost', 6, 'gone', 0, 0)"
            );
            database.$client.pragma('foreign_keys = ON');

            migrateSchema(database, migrations([recreateContainers]));

            expect(parentOfRack(database)).toBe('cellar');
            expect(database.$client.pragma('foreign_key_check')).toHaveLength(1);
        });
    });
});
