import { m } from '#lib/paraglide/messages.js';
import type { CsvIssueDTO, CsvReviewDTO } from '#lib/shared/dto.js';
import { rowProblemsText } from '#lib/utils/import-problems.js';

type WineOption = CsvReviewDTO['wines'][number];

/** What an issue is about: the text of a column, the wine of bottles, or the problem of a row. */
export function issueTitle(issue: CsvIssueDTO): string {
    switch (issue.kind) {
        case 'wine':
            return m['admin.csv_review_issue_wine']({ name: issue.value ?? '' });
        case 'row':
            return issue.problem ? rowProblemsText([issue.problem]) : '';
        default:
            return issue.value
                ? m['admin.csv_review_issue_value']({ column: issue.column!, value: issue.value })
                : m['admin.csv_review_issue_blank']({ column: issue.column! });
    }
}

/**
 * Why the rows of an open issue cannot be imported as they are, besides what its title says: none
 * for a blank cell, whose title says it.
 */
export function issueReason(issue: CsvIssueDTO): string {
    const problem = issue.problem;
    if (!problem) return '';
    switch (problem.code) {
        case 'missing':
            return '';
        case 'unknown_reference':
            return m['admin.csv_review_reason_unknown']();
        case 'similar_name':
            return m['admin.csv_review_reason_similar']({ similar: problem.similar.join(', ') });
        case 'invalid':
            return m['admin.csv_review_reason_invalid']();
        case 'several_wines':
            return m['admin.csv_review_reason_several_wines']();
        case 'unknown_wine':
            return m['admin.csv_review_reason_unknown_wine']();
        default:
            // A row issue says its problem in its title.
            return issue.kind === 'row' ? '' : rowProblemsText([problem]);
    }
}

/** The rows of an issue, by file: the first ones, and how many more it has. */
export function issueRows(issue: CsvIssueDTO): string {
    const files = Map.groupBy(issue.rows, (row) => row.file);
    const listed = [...files].map(([file, rows]) =>
        m['admin.csv_review_rows_of_file']({
            file,
            count: rows.length,
            rows: rows.map(({ row }) => row).join(', ')
        })
    );
    const more = issue.count - issue.rows.length;
    if (more > 0) listed.push(m['admin.csv_review_more_rows']({ count: more }));
    return listed.join(' · ');
}

/** A wine as the lists of the review name it: its name and producer. */
export function wineLabel(wine: WineOption): string {
    return wine.producer ? `${wine.name} · ${wine.producer}` : wine.name;
}

/** What tells a wine apart from another of the same name: its other fields, as far as it has them. */
export function wineDetails(wine: WineOption): string {
    const where =
        'row' in wine.wine
            ? m['admin.csv_review_wine_of_import']({ row: wine.wine.row, file: wine.wine.file })
            : null;
    return [
        wine.appellation,
        wine.classification,
        wine.type,
        wine.color,
        wine.rating && m['admin.csv_review_wine_rating']({ rating: wine.rating }),
        wine.grapeVarieties.join(', '),
        wine.description,
        where
    ]
        .filter(Boolean)
        .join(' · ');
}
