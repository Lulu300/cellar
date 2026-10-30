import { onTestFinished } from 'vitest';
import { db } from '#lib/server/db/index.js';

/**
 * Makes SQLite refuse, until the end of the test, each `operation` on `table` for which `when`
 * holds: an SQL condition that can read the row as NEW (insert, update) or OLD (update, delete).
 * It stands for a broken row or a full disk in the middle of an operation.
 */
export function failWrites(
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    when: string
): void {
    const trigger = `fail_${operation.toLowerCase()}_${table}`;
    db.$client.exec(
        `CREATE TEMP TRIGGER ${trigger} BEFORE ${operation} ON main.${table} WHEN ${when}
         BEGIN SELECT RAISE(ABORT, 'Write refused by the test'); END`
    );
    onTestFinished(() => {
        db.$client.exec(`DROP TRIGGER temp.${trigger}`);
    });
}
