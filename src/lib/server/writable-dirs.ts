import {
    closeSync,
    existsSync,
    mkdirSync,
    openSync,
    readdirSync,
    statSync,
    unlinkSync,
    writeFileSync
} from 'node:fs';
import path from 'node:path';
import { CSV_IMPORTS_DIR, DATA_DIR, DATABASE_PATH, IMAGES_DIR } from './paths';

const DATA_OWNERSHIP_DOC =
    'https://github.com/Lulu300/cellar/blob/main/README-Docker.md#data-ownership';
// Enough to recognise the pattern; the fix, `chown -R`, covers the rest anyway.
const LISTED_PER_FOLDER = 5;
// Created and owned by the NAS (Synology indexes images into @eaDir, for example), and possibly
// recreated after a chown: the app never writes there, so they must not block the start.
const NAS_SYSTEM_NAMES = new Set(['@eaDir', '#recycle', '#snapshot', '.snapshot', 'lost+found']);

type Failure = { target: string; error: string };

function errorCode(error: unknown): string {
    return (error as NodeJS.ErrnoException).code ?? String(error);
}

function createError(dir: string): string | null {
    try {
        mkdirSync(dir, { recursive: true });
        return null;
    } catch (error) {
        return errorCode(error);
    }
}

// Creating a file is the real test: access(W_OK) only reads the permission bits, which NFS, SMB
// and ACLs can contradict.
function dirWriteError(dir: string): string | null {
    // The pid keeps two processes started at once, such as `pnpm dev` and `pnpm build`, from
    // deleting each other's probe.
    const probe = path.join(dir, `.cellar-write-check-${process.pid}`);
    try {
        writeFileSync(probe, '');
        unlinkSync(probe);
        return null;
    } catch (error) {
        return errorCode(error);
    }
}

// Opening read-write is the real test for the same reason, and it leaves the file unchanged.
function fileWriteError(file: string): string | null {
    try {
        closeSync(openSync(file, 'r+'));
        return null;
    } catch (error) {
        const code = errorCode(error);
        // A link to a folder: test that folder without walking it, which could loop.
        if (code === 'EISDIR') return dirWriteError(file);
        // Gone since it was listed, like another process's probe or the journal of a database that
        // another process writes to, or a dangling link: there is nothing to write to.
        return code === 'ENOENT' ? null : code;
    }
}

/** The owner of `target`, or of its closest existing parent when it could not be created. */
function owner(target: string): string {
    let existing = target;
    while (!existsSync(existing)) existing = path.dirname(existing);
    const { uid, gid } = statSync(existing);
    return existing === target ? `owned by ${uid}:${gid}` : `${existing} is owned by ${uid}:${gid}`;
}

/** `dir` and everything under it that the app cannot write to. */
function unwritable(dir: string): Failure[] {
    const dirError = dirWriteError(dir);
    const failures = dirError ? [{ target: dir, error: dirError }] : [];

    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
        // Report the folder once: its failed probe already did.
        return dirError ? failures : [{ target: dir, error: errorCode(error) }];
    }
    for (const entry of entries) {
        if (NAS_SYSTEM_NAMES.has(entry.name)) continue;
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            failures.push(...unwritable(entryPath));
        } else {
            const error = fileWriteError(entryPath);
            if (error) failures.push({ target: entryPath, error });
        }
    }
    return failures;
}

/** The report lines of one top folder: the first failures, then how many more. */
function reportLines(dir: string, failures: Failure[]): string[] {
    const lines = failures
        .slice(0, LISTED_PER_FOLDER)
        .map(({ target, error }) => `  - ${target} (${error}, ${owner(target)})`);
    const hidden = failures.length - LISTED_PER_FOLDER;
    return hidden > 0 ? [...lines, `  - and ${hidden} more in ${dir}`] : lines;
}

/**
 * The folder and file of the database, when DATABASE_PATH puts it outside DATA_DIR. SQLite writes
 * cellar.db-wal and cellar.db-shm next to it. The folder is created when missing, like the others,
 * but not walked: it may hold anything.
 */
function databaseFailures(): Failure[] {
    const file = path.resolve(DATABASE_PATH);
    const dir = path.dirname(file);
    if (dir === path.resolve(DATA_DIR)) return [];
    const dirError = createError(dir) ?? dirWriteError(dir);
    if (dirError) return [{ target: dir, error: dirError }];
    const fileError = fileWriteError(file);
    return fileError ? [{ target: file, error: fileError }] : [];
}

/**
 * Creates the folders the app writes to when they are missing, and stops the process when one of
 * them, or a file or folder inside, is not writable. Without it, a container whose data belongs to
 * another user (root, before 0.2.0) serves pages and passes its health check while every save,
 * upload and backup fails. Upgraded installs often have writable folders full of root-owned files:
 * a read-only cellar.db then breaks the migrations and the login.
 */
export function exitUnlessDirsWritable(): void {
    const failures = [DATA_DIR, IMAGES_DIR, CSV_IMPORTS_DIR].flatMap((relativeDir) => {
        const dir = path.resolve(relativeDir);
        const error = createError(dir);
        return reportLines(dir, error ? [{ target: dir, error }] : unwritable(dir));
    });
    failures.push(...reportLines(path.dirname(path.resolve(DATABASE_PATH)), databaseFailures()));
    if (failures.length === 0) return;

    const user = `${process.getuid?.()}:${process.getgid?.()}`;
    console.error(
        [
            `Cellar cannot start: it runs as ${user} and cannot write to these folders or files:`,
            ...failures,
            `Give the folders mounted there, and everything in them, to ${user}, for example with`,
            `\`sudo chown -R ${user} docker-data\` next to docker-compose.yml, then start Cellar again.`,
            `Other setups (named volumes, no sudo, another user): ${DATA_OWNERSHIP_DOC}`
        ].join('\n')
    );
    process.exit(1);
}
