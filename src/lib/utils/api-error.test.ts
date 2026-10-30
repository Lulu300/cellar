import { describe, expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { plain, useLocale } from '../../test/locale';
import { apiErrorMessage, responseErrorMessage } from './api-error';

const body = (code: string, details?: unknown) => ({
    error: { code, message: 'In English', details }
});

describe('apiErrorMessage', () => {
    it('shows the translation of the code, not the English message', () => {
        expect(apiErrorMessage(body('duplicate_barcode'))).toBe(
            'This barcode is already assigned to another bottle.'
        );
        useLocale('fr');
        expect(apiErrorMessage(body('duplicate_barcode'))).toBe(
            'Ce code-barres est déjà attribué à une autre bouteille.'
        );
    });

    it('does not show the field names of the API', () => {
        const invalid = body('invalid_body', [{ path: 'purchasePrice', message: 'Too small' }]);

        expect(apiErrorMessage(invalid)).toBe(m['errors.invalid_body']());
    });

    it('says why a backup is refused in the language of the UI, from its details', () => {
        const refused = body('backup_refused', {
            kind: 'mandatory_stop',
            backupVersion: '0.3.0',
            orOlder: true,
            stopVersion: '0.4.0',
            currentVersion: '0.6.0'
        });

        expect(apiErrorMessage(refused)).toBe(
            'This backup comes from Cellar 0.3.0 or an older version, before the mandatory stop 0.4.0: restore it with 0.4.0, restart that version once, back it up again, and restore that new backup here.'
        );
        useLocale('fr');
        expect(
            apiErrorMessage(body('invalid_backup', { problem: 'unknown_version', version: '9.x' }))
        ).toBe('Cette sauvegarde indique la version « 9.x », qui n’est pas une version de Cellar.');
    });

    it('says how many bottles a note does not fit, and how long notes may be', () => {
        const refused = body('notes_too_long', { ids: ['a', 'b'], bottles: 2, maximum: 5000 });

        expect(apiErrorMessage(refused)).toBe(
            'The note does not fit after the notes of 2 bottles: notes hold 5,000 characters at most. Shorten the note, or the notes of these bottles first.'
        );
        useLocale('fr');
        expect(plain(apiErrorMessage(refused))).toBe(
            'La note ne tient pas à la suite des notes de 2 bouteilles : les notes font 5 000 caractères au plus. Raccourcissez la note, ou commencez par raccourcir les notes de ces bouteilles.'
        );
    });

    it('falls back on the general message of a code for a variant that the UI does not know', () => {
        const unknown = body('invalid_backup', { problem: 'new_problem', reason: 'In English' });

        expect(apiErrorMessage(unknown)).toBe(m['errors.invalid_backup']());
    });

    it('names the files of a failed wipe, and tells to fix them when they are the user copies', () => {
        expect(
            apiErrorMessage(
                body('wipe_failed', {
                    files: '/data/csv-imports/wine_types.csv',
                    fixable: true,
                    folder: '/data/csv-imports'
                })
            )
        ).toBe(
            'Nothing was deleted: the default data could not be loaded again from /data/csv-imports/wine_types.csv. Fix these files in /data/csv-imports, or delete them to get the default files back.'
        );
    });

    it('says why an export or a CSV row is refused, from its details', () => {
        expect(apiErrorMessage(body('export_refused', { rule: 'duplicate_barcode' }))).toBe(
            m['errors.export_refused_duplicate_barcode']()
        );
        expect(
            apiErrorMessage(body('invalid_export', { problem: 'incomplete', tables: 'regions' }))
        ).toMatch(/^This export is incomplete: it lacks regions\./);
        const invalidRow = {
            problem: 'invalid_row',
            table: 'wineDefinitions',
            row: 1,
            problems: [
                { code: 'missing', column: 'name' },
                { code: 'invalid', column: 'rating' }
            ],
            reason: 'row 1 of wineDefinitions: Missing name; rating: Too big.'
        };
        expect(apiErrorMessage(body('invalid_export', invalidRow))).toBe(
            'This export cannot be imported: row 1 of wineDefinitions is invalid (No value for name; Invalid value for rating). Nothing was changed.'
        );
        expect(apiErrorMessage(body('import_row_refused', { file: 'countries.csv', row: 2 }))).toBe(
            'Nothing was imported: the database refused row 2 of countries.csv. Fix that row, then import the files again.'
        );
    });

    it('counts the rows that still use a row that cannot be deleted', () => {
        expect(apiErrorMessage(body('in_use', { count: 3, usedBy: 'wine_definitions' }))).toBe(
            'This item is still used by 3 wines, so it cannot be deleted.'
        );
        expect(apiErrorMessage(body('in_use'))).toBe(m['errors.in_use']());
    });

    it('shows the unexpected error for a body that is not an API error', async () => {
        expect(apiErrorMessage({ error: 'Failed' })).toBe(m['errors.internal_error']());
        expect(apiErrorMessage(body('no_such_code'))).toBe(m['errors.internal_error']());
        expect(await responseErrorMessage(new Response('<html>Bad gateway</html>'))).toBe(
            m['errors.internal_error']()
        );
    });
});
