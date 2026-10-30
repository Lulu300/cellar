import { describe, expect, it } from 'vitest';
import { csvField, csvLine, withoutFormulaGuard } from './csv';

describe('csvField', () => {
    it.each([
        ['=HYPERLINK("http://evil.example")', `"'=HYPERLINK(""http://evil.example"")"`],
        ['+33 6 00 00 00 00', `"'+33 6 00 00 00 00"`],
        ["-2+3+cmd|' /C calc'!A0", `"'-2+3+cmd|' /C calc'!A0"`],
        ['-- best before 2030', `"'-- best before 2030"`],
        ['@SUM(A1)', `"'@SUM(A1)"`],
        ['\t=1+1', `"'\t=1+1"`],
        ['\r=1+1', `"'\r=1+1"`]
    ])('guards a text that a spreadsheet would run as a formula: %j', (text, field) => {
        expect(csvField(text)).toBe(field);
    });

    it('leaves a negative number as a number', () => {
        expect(csvField(-5)).toBe('-5');
    });

    it('leaves a code of letters, digits and dashes as it is, such as a barcode of the prefix -AB', () => {
        expect(csvField('-AB0000001')).toBe('-AB0000001');
        expect(csvField('+33600000000')).toBe('+33600000000');
    });

    it('guards a text that already starts like a guarded one, so that an import keeps it', () => {
        expect(csvField("'=keep")).toBe(`"''=keep"`);
        expect(withoutFormulaGuard("''=keep")).toBe("'=keep");
    });

    it.each([
        ['Plain', ',', 'Plain'],
        ['Gift, "special"', ',', '"Gift, ""special"""'],
        ['first\nsecond', ',', '"first\nsecond"'],
        ['a;b', ';', '"a;b"'],
        ['a;b', ',', 'a;b']
    ])('quotes %j only when it must with the delimiter %j', (text, delimiter, field) => {
        expect(csvField(text, delimiter)).toBe(field);
    });

    it('writes nothing for no value, ISO dates and lists joined with "; "', () => {
        expect(
            csvLine([null, undefined, new Date('2024-05-01T00:00:00Z'), ['Syrah', 'Grenache']])
        ).toBe(',,2024-05-01T00:00:00.000Z,Syrah; Grenache');
    });
});

describe('withoutFormulaGuard', () => {
    it('gives back the text that csvField guarded', () => {
        expect(withoutFormulaGuard("'=1+1")).toBe('=1+1');
        expect(withoutFormulaGuard("'-- best before 2030")).toBe('-- best before 2030');
    });

    it('leaves any other text as it is', () => {
        expect(withoutFormulaGuard("'Tis the season")).toBe("'Tis the season");
        expect(withoutFormulaGuard('=1+1')).toBe('=1+1');
    });
});
