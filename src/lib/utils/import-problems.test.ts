import { describe, expect, it } from 'vitest';
import { useLocale } from '../../test/locale';
import { rowProblemsText, skipReasonText } from './import-problems';

describe('the CSV import results', () => {
    it('word the problems of a row in the language of the interface', () => {
        useLocale('fr');
        expect(
            rowProblemsText([
                { code: 'missing', column: 'name' },
                { code: 'invalid', column: 'capacity' }
            ])
        ).toBe('Valeur manquante : name; Valeur non valide pour capacity');
        expect(rowProblemsText([{ code: 'case_full', name: 'A1', capacity: 1 }])).toBe(
            'La case A1 est pleine : elle contient 1 bouteille'
        );
        expect(rowProblemsText([{ code: 'not_csv', line: 4 }])).toBe(
            'Le fichier n’est plus un CSV valide à partir de la ligne 4 : vérifiez ses guillemets (une valeur entre guillemets se termine par un guillemet, et un guillemet dans une valeur s’écrit deux fois)'
        );
        expect(rowProblemsText([{ code: 'uneven_row', values: 3, columns: 1 }])).toBe(
            'La ligne a 3 valeurs, l’en-tête 1 colonne'
        );
        expect(skipReasonText({ code: 'same_barcode', barcode: 'WINE0000001' })).toBe(
            'Déjà dans la cave : code-barres WINE0000001'
        );
    });
});
