import { m } from '#lib/paraglide/messages.js';
import { csvLine } from '#lib/shared/csv.js';
import type { CsvImportDTO } from '#lib/shared/dto.js';
import { issueReason, issueTitle } from './texts.js';

type FileReport = CsvImportDTO['results'][number];

/**
 * The rows of a file that the review ignored, as a CSV file with the columns of the file and, last,
 * why each was ignored: the import leaves that column out when the file is imported again, once
 * corrected. Written with the delimiter of the import.
 */
export function ignoredRowsCsv(
    report: FileReport,
    review: CsvImportDTO['review'],
    delimiter: string
) {
    const reasons = new Map(
        review?.issues.map((issue) => [
            issue.key,
            [issueTitle(issue), issueReason(issue)].filter(Boolean).join(': ')
        ])
    );
    const lines = [
        [...report.columns, m['admin.csv_review_reason_column']()],
        ...report.ignored.map(({ key, values }) => [...values, reasons.get(key) ?? ''])
    ];
    return lines.map((line) => csvLine(line, delimiter)).join('\n') + '\n';
}

/** The name of the file of the ignored rows of `file`. */
export const ignoredRowsFileName = (file: string) => file.replace(/(\.csv)?$/i, '-ignored.csv');
