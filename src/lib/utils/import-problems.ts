import { m } from '#lib/paraglide/messages.js';
import type { CsvImportDTO } from '#lib/shared/dto.js';

type FileReport = CsvImportDTO['results'][number];
type RowProblem = FileReport['errors'][number]['problems'][number];
type SkipReason = FileReport['skipped'][number]['reason'];

function problemText(problem: RowProblem): string {
    switch (problem.code) {
        case 'missing':
            return m['admin.csv_problem_missing']({ column: problem.column });
        case 'invalid':
            return problem.column
                ? m['admin.csv_problem_invalid']({ column: problem.column })
                : m['admin.csv_problem_invalid_row']();
        case 'unknown_reference':
            return m['admin.csv_problem_unknown_reference']({
                column: problem.column,
                name: problem.name
            });
        case 'unknown_wine':
            return m['admin.csv_problem_unknown_wine']({ name: problem.name });
        case 'several_wines':
            return m['admin.csv_problem_several_wines']({ name: problem.name });
        case 'case_full':
            return m['admin.csv_problem_case_full']({
                name: problem.name,
                capacity: problem.capacity
            });
        case 'uneven_row':
            return m['admin.csv_problem_uneven_row']({
                values: problem.values,
                columns: problem.columns
            });
        case 'no_table':
            return m['admin.csv_problem_no_table']();
        case 'not_csv':
            return problem.line
                ? m['admin.csv_problem_not_csv_from_line']({ line: problem.line })
                : m['admin.csv_problem_not_csv']();
    }
}

/** Why the import left a row out, in the user's language. */
export const rowProblemsText = (problems: RowProblem[]) => problems.map(problemText).join('; ');

/** Why the import found a row already in the cellar, in the user's language. */
export function skipReasonText(reason: SkipReason): string {
    switch (reason.code) {
        case 'same_name':
            return m['admin.csv_skipped_same_name']({ name: reason.name });
        case 'same_barcode':
            return m['admin.csv_skipped_same_barcode']({ barcode: reason.barcode });
        case 'same_bottle':
            return m['admin.csv_skipped_same_bottle']();
    }
}
