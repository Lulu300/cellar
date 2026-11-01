import { describe, expect, it } from 'vitest';
import { typeBadgeClass, typeFill } from './wine-badges';

const GREY = 'bg-gray-100 text-gray-800';

describe('wine badges', () => {
    it('colours the seeded types', () => {
        expect(typeBadgeClass('Vin')).toBe('bg-blue-100 text-blue-800');
        expect(typeBadgeClass('Champagne')).toBe('bg-yellow-100 text-yellow-800');
        expect(typeBadgeClass('Mousseux')).toBe('bg-green-100 text-green-800');
        expect(typeBadgeClass('Spiritueux')).toBe('bg-purple-100 text-purple-800');
    });

    // BUG-06: the pie of the statistics page compared names with their accents.
    it('finds a name whatever its accents, case and spaces', () => {
        expect(typeBadgeClass(' SPARKLING ')).toBe('bg-green-100 text-green-800');
        expect(typeFill('vín')).toBe(typeFill('Vin'));
    });

    it('keeps grey for N/A and for a missing reference', () => {
        expect(typeBadgeClass('N/A')).toBe(GREY);
        expect(typeBadgeClass('Unknown')).toBe(GREY);
        expect(typeBadgeClass(null)).toBe(GREY);
    });

    it('gives a name the user created a colour of its own, the same each time', () => {
        const cidre = typeBadgeClass('Cidre');
        expect(cidre).not.toBe(GREY);
        expect(typeBadgeClass('cidre')).toBe(cidre);
    });

    // The type pie of the statistics page used to draw every type in shades of grey.
    it('fills a type in a chart with the hue of its badge, N/A in grey', () => {
        expect(typeFill('Vin')).toBe('#1d4ed8'); // blue, as its badge
        expect(typeFill('Mousseux')).toBe('#15803d'); // green
        expect(typeFill('N/A')).toBe('#6b7280');
        expect(typeFill('Cidre')).not.toBe('#6b7280');
    });
});
