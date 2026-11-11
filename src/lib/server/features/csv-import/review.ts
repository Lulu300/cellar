import { z } from 'zod';
import { rowColumns } from '#lib/server/features/shared/imported-rows.js';
import { normalized } from '#lib/server/features/shared/names.js';
import { CSV_OTHERS_KEY, csvRowKey } from '#lib/shared/csv-import.js';
import { id } from '#lib/shared/schemas/common.js';
import { UnevenLine, type CsvRecord } from './parse';
import { unevenRow, type Outcome, type RowProblem } from './pipeline';
import type { KeptChoice } from './choices';
import type { ReferenceIndex, Row } from './referenceIndex';
import { keyOfName, parentOf, TABLES, type Reference, type TableName } from './tables';

/** A row of a file of the import, numbered from 1 under its header. */
const rowOfFile = z.object({ file: z.string().min(1), row: z.number().int().min(1) });
export type RowOfFile = z.output<typeof rowOfFile>;

/** How the user settles a problem of the review, for every row that has it. */
const answerSchema = z.discriminatedUnion('action', [
    /** Leaves the rows out. */
    z.object({ action: z.literal('ignore') }),
    /**
     * Another text for the cell: for a reference, the name of a row that the cellar or the import
     * has, within `parent` when the table names its rows within a parent.
     */
    z.object({ action: z.literal('set'), value: z.string(), parent: z.string().optional() }),
    /** Creates the row that the reference names, under this name, within `parent`. */
    z.object({ action: z.literal('create'), value: z.string(), parent: z.string().optional() }),
    /** Puts the bottles in this wine: one of the cellar, or the wine of a row of a wines file. */
    z.object({ action: z.literal('wine'), wine: z.union([z.object({ id }), rowOfFile]) }),
    /** Imports a bottle that is already in the cellar. */
    z.object({ action: z.literal('import') })
]);
export type Answer = z.output<typeof answerSchema>;

/**
 * The answers of a review, by the key of the problem they settle. CSV_OTHERS_KEY holds the answer to
 * every problem that has none: only `ignore`.
 */
export const choicesSchema = z
    .record(z.string().max(2000), answerSchema)
    .refine((choices) => [undefined, 'ignore'].includes(choices[CSV_OTHERS_KEY]?.action), {
        message: `The answer to "${CSV_OTHERS_KEY}" can only be to ignore`
    });
export type Choices = z.output<typeof choicesSchema>;

/**
 * A column of a row that names a row of another table: a reference of the row, or, in a bottle
 * file, a column that tells its wine apart, which an answer renames as it renames the reference.
 */
interface Naming {
    column: string;
    target: TableName;
    /** The column of the same row that names the parent of the target, if it has one. */
    parentColumn?: string;
    required: boolean;
    /** Whether a row of `target` can be created from its name (and parent) alone. */
    creatable: boolean;
}

/** Tables whose rows the review can create from a name, within a parent for some. */
const CREATABLE = new Set<TableName>([
    'countries',
    'regions',
    'appellations',
    'wineClassifications',
    'wineTypes',
    'wineColors',
    'wineFormats',
    'origins',
    'storageContainers',
    'producers'
]);

function namingsOf(table: TableName): Naming[] {
    const naming = (reference: Reference, creatable: boolean): Naming => ({
        column: reference.csvColumn,
        target: reference.table,
        parentColumn: parentOf(reference.table)?.reference.csvColumn,
        required: reference.required,
        creatable: creatable && CREATABLE.has(reference.table)
    });
    const namings = Object.values(TABLES[table].references ?? {})
        .filter((reference) => reference.table !== 'wineDefinitions')
        .map((reference) => naming(reference, true));
    if (table === 'wineBottles') {
        // The columns that tell the wine of a bottle apart: renamed as the wines are, never
        // created from a bottle.
        namings.push(
            ...Object.values(TABLES.wineDefinitions.references!).map((reference) =>
                naming({ ...reference, required: false }, false)
            )
        );
    }
    // An image is created from its name, without asking.
    return namings.filter((naming) => naming.target !== 'wineImages');
}

const NAMINGS = new Map(
    (Object.keys(TABLES) as TableName[]).map((table) => [table, namingsOf(table)])
);

const referenceKey = (target: TableName, name: unknown, parent: unknown) =>
    JSON.stringify(['reference', target, keyOfName(target, name), normalized(parent)]);
const cellKey = (table: TableName, column: string, value: unknown) =>
    JSON.stringify(['cell', table, column, value ?? '']);
const rowKey = (at: RowOfFile) => csvRowKey(at.file, at.row);
/** A full case: the answer places the bottles that it cannot hold, not those it can. */
const fullKey = (record: CsvRecord) =>
    JSON.stringify(['full', normalized(record.containerName), normalized(record.storageCaseName)]);
const isCaseFull = (problem: RowProblem) => problem.code === 'case_full';
const isFullKey = (key: string) => (JSON.parse(key) as string[])[0] === 'full';

/** The kinds of problems of the review, by what settles them. */
type IssueKind = 'reference' | 'wine' | 'cell' | 'row';

/** A wine that the bottles of a wine issue may be put in. */
export interface WineOption {
    wine: { id: string } | RowOfFile;
    name: string;
    producer: string | null;
    appellation: string | null;
    region: string | null;
    classification: string | null;
    type: string | null;
    color: string | null;
    rating: number | null;
    grapeVarieties: string[];
    description: string | null;
}

/** The most rows that an issue lists, of all those it counts. */
const LISTED_ROWS = 20;
/** The most issues that a review lists: the others are counted. */
const LISTED_ISSUES = 1000;

/** A problem that rows of the import share, which one answer settles for all of them. */
export interface Issue {
    key: string;
    kind: IssueKind;
    /** The table of the rows; null for a file whose name names none. */
    table: TableName | null;
    /** The column to settle, and the text it has. */
    column?: string;
    value?: string;
    /** For a reference named within a parent, the column and the text of the parent. */
    parentColumn?: string;
    parent?: string;
    /** For a reference, the table it names, whether it may be left blank, and created. */
    target?: TableName;
    /** The table of the parent that a row of `target` is named within. */
    parentTarget?: TableName;
    required?: boolean;
    creatable?: boolean;
    /**
     * Why the first row that met it unsettled could not be imported as it was; absent when answers
     * settled every row.
     */
    problem?: RowProblem;
    /** Whether some rows are still not settled. */
    open: boolean;
    answer?: Answer;
    /** An answer given in an earlier import to the same problem, never applied by itself. */
    suggestion?: Answer;
    /** For a wine issue, the wines that the bottles may be meant for. */
    wines?: WineOption[];
    /** For a wine issue, the row of a wines file of the import that names the wine, still open. */
    pending?: RowOfFile;
    /** For a reference, the names of the target that are close to the value. */
    close?: string[];
    count: number;
    rows: RowOfFile[];
    /** The values of its first row. */
    sample: CsvRecord;
}

/** An issue as a row meets it, before the rows that share it are counted. */
type IssueFound = Omit<Issue, 'open' | 'count' | 'rows' | 'sample' | 'answer'>;

/** The choice for one row that the answers make, besides the texts they change. */
export interface RowChoice {
    wine?: Row;
    /** A bottle already in the cellar is imported anyway. */
    keep?: boolean;
}

/** What the pipeline does for the review: tries a row, creates a row named, finds a wine. */
export interface Attempts {
    attempt(record: CsvRecord, choice: RowChoice): Outcome;
    /** Creates the row of `target` named, unless the import has it already; its problems if any. */
    create(target: TableName, name: string, parent: string | undefined): RowProblem[] | undefined;
    wine(choice: { id: string } | RowOfFile): Row | undefined;
    /** The key of the wine that a bottle names, which a wine answer is given for. */
    wineKey(record: CsvRecord): string;
    /** The wines that a bottle may be meant for. */
    winesOf(record: CsvRecord): WineOption[];
    /** The row of a wines file of the import that names the wine of a bottle, and failed. */
    pendingWine(record: CsvRecord): RowOfFile | undefined;
    /** Whether a bottle of twins, wines that a file cannot tell apart, is in one of them already. */
    twinInCellar(record: CsvRecord): boolean;
    /** The names of `target` close to `name`. */
    closeNames(target: TableName, name: string): string[];
}

export type Settled = Outcome | { ignored: string };

/**
 * The review of an import: applies the answers of the user to the rows, and lists the problems that
 * rows share, settled or not, for the user to answer.
 */
export class Review {
    private issues = new Map<string, Issue>();
    /** The answers applied to rows that were then imported or ignored, for the next imports. */
    readonly used = new Set<string>();

    constructor(readonly answers: Choices) {}

    /** Whether some rows are still not settled. */
    get open(): boolean {
        return [...this.issues.values()].some((issue) => issue.open);
    }

    /** The issues, the open ones first, the first LISTED_ISSUES of them, and how many are left. */
    list(): { issues: Issue[]; unlisted: number } {
        const issues = [...this.issues.values()].toSorted(
            (a, b) => Number(b.open) - Number(a.open)
        );
        return {
            issues: issues.slice(0, LISTED_ISSUES),
            unlisted: Math.max(0, issues.length - LISTED_ISSUES)
        };
    }

    /**
     * Whether a file left out whole, with no table name or not CSV, is ignored; it is noted as an
     * issue of its row 0 otherwise.
     */
    ignoresFile(table: TableName | null, file: string, problem: RowProblem): boolean {
        const at = { file, row: 0 };
        const ignored = this.answerTo(rowKey(at))?.action === 'ignore';
        this.note({ key: rowKey(at), kind: 'row', table, problem }, at, {}, !ignored);
        return ignored;
    }

    /**
     * Gives each open issue without an answer the choice kept from an earlier import, if the row it
     * names still exists: a suggestion, which the user takes or not.
     */
    suggest(kept: Map<string, KeptChoice>, index: ReferenceIndex): void {
        for (const issue of this.issues.values()) {
            const choice = kept.get(issue.key);
            if (!choice || !issue.open || issue.answer) continue;
            if ('value' in choice) {
                if (issue.kind === 'cell')
                    issue.suggestion = { action: 'set', value: choice.value };
            } else if (issue.kind === 'wine') {
                if (index.wineOfChoice(choice)) issue.suggestion = { action: 'wine', wine: choice };
            } else if (issue.kind === 'reference') {
                const named = index.named(issue.target!, choice.id);
                if (named)
                    issue.suggestion = { action: 'set', value: named.name, parent: named.parent };
            }
        }
    }

    /**
     * The choices to keep for the next imports, from the answers applied to rows: the rows given to
     * references, created or not, and to the bottles of wines, by id, and the texts of cells. A row
     * ignored or imported anyway is not kept.
     */
    toKeep(index: ReferenceIndex): { key: string; kept: KeptChoice }[] {
        return [...this.used].flatMap((key): { key: string; kept: KeptChoice }[] => {
            const issue = this.issues.get(key)!;
            const answer = this.answers[key];
            if (answer.action === 'wine') {
                const wine = index.wineOfChoice(answer.wine);
                return wine ? [{ key, kept: { id: wine.id } }] : [];
            }
            if (answer.action !== 'set' && answer.action !== 'create') return [];
            if (issue.kind === 'cell') return [{ key, kept: { value: answer.value } }];
            const parent = answer.parent ? { name: answer.parent } : undefined;
            const row = index.find(issue.target!, answer.value, parent);
            return row ? [{ key, kept: { id: row.id } }] : [];
        });
    }

    /** The answer to the issue `key`: its own, or that to every issue left. */
    private answerTo(key: string): Answer | undefined {
        return this.answers[key] ?? this.answers[CSV_OTHERS_KEY];
    }

    private note(issue: IssueFound, at: RowOfFile, record: CsvRecord, open: boolean): void {
        let noted = this.issues.get(issue.key);
        if (!noted) {
            noted = {
                ...issue,
                answer: this.answerTo(issue.key),
                open: false,
                count: 0,
                rows: [],
                sample: record
            };
            this.issues.set(issue.key, noted);
        }
        noted.count += 1;
        if (noted.rows.length < LISTED_ROWS) noted.rows.push(at);
        if (open) {
            noted.open = true;
            noted.problem ??= issue.problem;
        }
    }

    /**
     * Imports a row of `table` with the answers that its texts have: renamed, created, put in a
     * wine, ignored. A problem left is noted as an open issue.
     */
    settle(
        table: TableName,
        at: RowOfFile,
        line: CsvRecord | UnevenLine,
        attempts: Attempts
    ): Settled {
        if (line instanceof UnevenLine) return this.settleRow(table, at, unevenRow(line));
        // The answers that the texts of the row have, gathered before any is applied: an ignore
        // among them leaves the row out before anything is created for it. A row left out later,
        // by the answer to every issue left or to a full case, keeps the rows that its answers
        // asked to create.
        const applied: IssueFound[] = [];
        const creates: { naming: Naming; answer: Answer & { action: 'create' } }[] = [];
        let record = line;
        for (const naming of NAMINGS.get(table)!) {
            const value = record[naming.column] ?? '';
            const parent = naming.parentColumn ? record[naming.parentColumn] : undefined;
            const key = referenceKey(naming.target, value, parent);
            const answer = this.answers[key];
            if (!answer) continue;
            applied.push(this.referenceIssue(key, table, naming, value, parent));
            if (answer.action !== 'set' && answer.action !== 'create') continue;
            if (answer.action === 'create' && naming.creatable) creates.push({ naming, answer });
            record = { ...record, [naming.column]: answer.value };
            if (naming.parentColumn && answer.parent !== undefined) {
                record[naming.parentColumn] = answer.parent;
            }
        }
        for (const [column, value] of Object.entries(line)) {
            const key = cellKey(table, column, value);
            const answer = this.answers[key];
            if (!answer) continue;
            applied.push(this.cellIssue(key, table, column, value));
            if (answer.action === 'set') record = { ...record, [column]: answer.value };
        }
        const rowAnswer = this.answers[rowKey(at)];
        const choice: RowChoice = {};
        if (table === 'wineBottles') {
            const key = attempts.wineKey(record);
            // A bottle of twins that one of them has is already in the cellar, whatever the
            // answer to the wine of the others, unless it is imported anyway.
            const given = this.answers[key];
            const inCellar =
                given && rowAnswer?.action !== 'import' && attempts.twinInCellar(record);
            const answer = inCellar ? undefined : given;
            const wine = answer?.action === 'wine' ? attempts.wine(answer.wine) : undefined;
            if (answer?.action === 'ignore' || wine) {
                applied.push(this.wineIssue(key, table, record, attempts));
                choice.wine = wine;
            }
        }
        const ignoring = applied.find((issue) => this.answers[issue.key].action === 'ignore');
        if (ignoring || rowAnswer?.action === 'ignore') {
            for (const issue of applied) this.note(issue, at, line, false);
            return { ignored: ignoring?.key ?? rowKey(at) };
        }

        for (const { naming, answer } of creates) {
            const problems = attempts.create(naming.target, answer.value, answer.parent);
            if (!problems) continue;
            // A name that cannot be created is the problem of the issue it was the answer to.
            const owner = applied.find((issue) => issue.column === naming.column)!;
            return this.failed(applied, at, line, problems, table, record, attempts, owner);
        }
        let outcome = attempts.attempt(record, choice);
        if ('skipped' in outcome && table === 'wineBottles' && rowAnswer?.action === 'import') {
            const kept = outcome.skipped;
            outcome = attempts.attempt(record, { ...choice, keep: true });
            if ('imported' in outcome) outcome = { ...outcome, kept };
        }
        // A bottle that its case cannot hold goes where the answer to its case says.
        const full = 'failed' in outcome ? outcome.failed.find(isCaseFull) : undefined;
        const fullAnswer = full && this.answers[fullKey(record)];
        if (full && fullAnswer) {
            applied.push({ ...this.fullIssue(table, record, attempts), problem: full });
            if (fullAnswer.action === 'ignore') {
                for (const issue of applied) this.note(issue, at, line, false);
                return { ignored: fullKey(record) };
            }
            if (fullAnswer.action === 'set') {
                record = {
                    ...record,
                    storageCaseName: fullAnswer.value,
                    containerName: fullAnswer.parent ?? record.containerName
                };
                outcome = attempts.attempt(record, choice);
            }
        }
        if ('failed' in outcome) {
            return this.failed(applied, at, line, outcome.failed, table, record, attempts);
        }
        for (const issue of applied) {
            this.note(issue, at, line, false);
            this.used.add(issue.key);
        }
        return outcome;
    }

    /** Notes the problems of a row that the answers did not settle. */
    private failed(
        applied: IssueFound[],
        at: RowOfFile,
        line: CsvRecord,
        problems: RowProblem[],
        table: TableName,
        record: CsvRecord,
        attempts: Attempts,
        owner?: IssueFound
    ): Settled {
        // A problem in a column that an answer changed, or of a case that an answer chose, stays
        // that answer's issue, open, for the user to answer it again on the same card.
        const answeredFor = (problem: RowProblem) =>
            owner ??
            applied.find((issue) =>
                problem.code === 'case_full'
                    ? isFullKey(issue.key)
                    : issue.kind !== 'wine' &&
                      'column' in problem &&
                      issue.column === problem.column
            );
        const found = problems.map((problem): IssueFound => {
            const answered = answeredFor(problem);
            if (!answered) return this.issueOf(table, at, record, problem, attempts);
            const close =
                answered.kind === 'reference' && answered.value
                    ? attempts.closeNames(answered.target!, answered.value)
                    : undefined;
            return { ...answered, close, problem };
        });
        // An answer that did not settle its problem leaves it open, the row counted once.
        const keys = new Set(found.map(({ key }) => key));
        for (const issue of applied) if (!keys.has(issue.key)) this.note(issue, at, line, false);
        // Each problem is noted, so that the user sees them all. An answer to ignore one of them,
        // its own or that to every issue left, leaves the row out, as before it is tried.
        const ignoring = found.find((issue) => this.answerTo(issue.key)?.action === 'ignore');
        for (const issue of found) this.note(issue, at, line, !ignoring);
        return ignoring ? { ignored: ignoring.key } : { failed: problems };
    }

    /** A row that only `ignore` settles: uneven, or with a problem of the whole row. */
    private settleRow(table: TableName, at: RowOfFile, problem: RowProblem): Settled {
        const issue = { key: rowKey(at), kind: 'row' as const, table, problem };
        const ignored = this.answerTo(issue.key)?.action === 'ignore';
        this.note(issue, at, {}, !ignored);
        return ignored ? { ignored: issue.key } : { failed: [problem] };
    }

    private referenceIssue(
        key: string,
        table: TableName,
        naming: Naming,
        value: string,
        parent: string | undefined
    ) {
        return {
            key,
            kind: 'reference' as const,
            table,
            column: naming.column,
            value,
            parentColumn: naming.parentColumn,
            parent,
            target: naming.target,
            parentTarget: parentOf(naming.target)?.reference.table,
            required: naming.required,
            creatable: naming.creatable
        };
    }

    /** The bottles that their case cannot hold: another case is chosen, never created. */
    private fullIssue(table: TableName, record: CsvRecord, attempts: Attempts): IssueFound {
        const naming = NAMINGS.get(table)!.find((naming) => naming.column === 'storageCaseName')!;
        const value = record.storageCaseName ?? '';
        return {
            ...this.referenceIssue(fullKey(record), table, naming, value, record.containerName),
            creatable: false,
            close: attempts.closeNames('storageCases', value)
        };
    }

    private cellIssue(key: string, table: TableName, column: string, value: string) {
        // A cell that the row may leave blank can be emptied.
        const rule = rowColumns(table)[column];
        const required = rule ? !rule.safeParse(undefined).success : false;
        return { key, kind: 'cell' as const, table, column, value, required };
    }

    private wineIssue(key: string, table: TableName, record: CsvRecord, attempts: Attempts) {
        return {
            key,
            kind: 'wine' as const,
            table,
            column: 'wineName',
            value: record.wineName ?? '',
            // Its first row tells them: the other rows of the issue name the same wine.
            wines: this.issues.get(key)?.wines ?? attempts.winesOf(record)
        };
    }

    /** The issue of a problem of a row that no answer settled. */
    private issueOf(
        table: TableName,
        at: RowOfFile,
        record: CsvRecord,
        problem: RowProblem,
        attempts: Attempts
    ): IssueFound {
        if (problem.code === 'unknown_wine' || problem.code === 'several_wines') {
            const key = attempts.wineKey(record);
            const pending =
                problem.code === 'unknown_wine' ? attempts.pendingWine(record) : undefined;
            return { ...this.wineIssue(key, table, record, attempts), pending, problem };
        }
        if (problem.code === 'case_full')
            return { ...this.fullIssue(table, record, attempts), problem };
        const column = 'column' in problem ? problem.column : undefined;
        const naming = NAMINGS.get(table)!.find((naming) => naming.column === column);
        if (naming) {
            const value = record[naming.column] ?? '';
            const parent = naming.parentColumn ? record[naming.parentColumn] : undefined;
            const key = referenceKey(naming.target, value, parent);
            return {
                ...this.referenceIssue(key, table, naming, value, parent),
                close: value ? attempts.closeNames(naming.target, value) : [],
                problem
            };
        }
        if (column && problem.code !== 'uneven_row') {
            const value = record[column] ?? '';
            return {
                ...this.cellIssue(cellKey(table, column, value), table, column, value),
                problem
            };
        }
        return { key: rowKey(at), kind: 'row', table, problem };
    }
}
