import { SvelteSet } from 'svelte/reactivity';
import { ApiError, errorMessage, request } from '#lib/api/client.js';
import type { CsvAnswer, CsvImportDTO } from '#lib/shared/dto.js';

/** What an import sends besides its answers. */
export interface CsvImportRequest {
    files: File[];
    delimiter: string;
    overrideAllBarcodes: boolean;
}

/** How long the review waits after an answer before it checks the files again. */
const CHECK_DELAY_MS = 400;

/**
 * The review of a CSV import: the files checked with the answers given so far, again after each
 * answer, then imported with them. The files stay in the browser and are sent with each check.
 */
export class CsvReview {
    /** The last check, or the import once done. */
    report = $state<CsvImportDTO | null>(null);
    answers = $state<Record<string, CsvAnswer>>({});
    /** The problems whose answer is the suggestion of an earlier import, not changed since. */
    readonly suggested = new SvelteSet<string>();
    checking = $state(false);
    importing = $state(false);
    imported = $state(false);
    error = $state<string | null>(null);
    private timer: ReturnType<typeof setTimeout> | undefined;
    /** The number of the latest check sent: an older one that answers late is dropped. */
    private latest = 0;

    constructor(private request: CsvImportRequest) {}

    private form(dryRun: boolean): FormData {
        const form = new FormData();
        for (const file of this.request.files) form.append('files', file);
        form.append('delimiter', this.request.delimiter);
        form.append('overrideAllBarcodes', String(this.request.overrideAllBarcodes));
        form.append('dryRun', String(dryRun));
        form.append('choices', JSON.stringify(this.answers));
        return form;
    }

    /** Checks the files with the answers given; the first check takes the suggestions. */
    async check(): Promise<void> {
        clearTimeout(this.timer);
        const number = ++this.latest;
        this.checking = true;
        this.error = null;
        try {
            const report = await request<CsvImportDTO>('/api/admin/import-csv', {
                method: 'POST',
                body: this.form(true)
            });
            if (number !== this.latest) return;
            this.report = report;
            if (this.takeSuggestions()) await this.check();
        } catch (error) {
            if (number === this.latest) this.error = errorMessage(error);
        } finally {
            if (number === this.latest) this.checking = false;
        }
    }

    /**
     * Answers the problems that have a suggestion and no answer with it, flagged: never applied
     * without the user seeing it. Whether any was taken.
     */
    private takeSuggestions(): boolean {
        let taken = false;
        for (const issue of this.report?.review?.issues ?? []) {
            if (!issue.suggestion || this.answers[issue.key]) continue;
            this.answers[issue.key] = issue.suggestion;
            this.suggested.add(issue.key);
            taken = true;
        }
        return taken;
    }

    /** Answers the problem `key`, or withdraws its answer, then checks again after a pause. */
    answer(key: string, answer: CsvAnswer | undefined): void {
        if (answer) this.answers[key] = answer;
        else delete this.answers[key];
        this.suggested.delete(key);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.check(), CHECK_DELAY_MS);
    }

    /**
     * Imports the files with the answers, in one transaction. When rows are left to settle, as the
     * cellar may have changed since the last check, nothing is written and the review shows them.
     */
    async import(): Promise<boolean> {
        clearTimeout(this.timer);
        this.latest++;
        this.importing = true;
        this.error = null;
        try {
            this.report = await request<CsvImportDTO>('/api/admin/import-csv', {
                method: 'POST',
                body: this.form(false)
            });
            this.imported = true;
            return true;
        } catch (error) {
            if (error instanceof ApiError && error.code === 'rows_to_settle') {
                this.report = error.details<CsvImportDTO>();
            }
            this.error = errorMessage(error);
            return false;
        } finally {
            this.importing = false;
        }
    }

    dispose(): void {
        clearTimeout(this.timer);
        this.latest++;
    }
}
