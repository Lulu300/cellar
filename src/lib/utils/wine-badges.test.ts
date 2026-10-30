import { describe, expect, it } from 'vitest';
import { colorBadgeClass, colorFill, typeBadgeClass, typeFill } from './wine-badges';

const GREY = 'bg-gray-100 text-gray-800';

describe('wine badges', () => {
    it('colours the seeded types and colours', () => {
        expect(typeBadgeClass('Vin')).toBe('bg-blue-100 text-blue-800');
        expect(typeBadgeClass('Champagne')).toBe('bg-yellow-100 text-yellow-800');
        expect(typeBadgeClass('Mousseux')).toBe('bg-green-100 text-green-800');
        expect(typeBadgeClass('Spiritueux')).toBe('bg-purple-100 text-purple-800');
        expect(colorBadgeClass('Rouge')).toBe('bg-red-100 text-red-800');
        expect(colorBadgeClass('Blanc')).toBe('bg-yellow-100 text-yellow-800');
        expect(colorBadgeClass('Jaune')).toBe('bg-orange-100 text-orange-800');
    });

    // BUG-06: the pie of the statistics page expected `Rose`, so seeded rosés were drawn grey.
    it('finds a name whatever its accents, case and spaces', () => {
        expect(colorFill('Rosé')).toBe('#be185d');
        expect(colorFill('rose')).toBe('#be185d');
        expect(colorBadgeClass(' ROSÉ ')).toBe('bg-pink-100 text-pink-800');
    });

    it('keeps grey for N/A and for a missing reference', () => {
        expect(typeBadgeClass('N/A')).toBe(GREY);
        expect(colorBadgeClass('Unknown')).toBe(GREY);
        expect(colorBadgeClass(null)).toBe(GREY);
    });

    it('gives a name the user created a colour of its own, the same each time', () => {
        const orange = colorBadgeClass('Orange');
        expect(orange).not.toBe(GREY);
        expect(colorBadgeClass('orange')).toBe(orange);
        expect(typeBadgeClass('Cidre')).not.toBe(GREY);
        expect(colorFill('Orange')).not.toBe('#6b7280');
    });

    // The type pie of the statistics page used to draw every type in shades of grey.
    it('fills a type in a chart with the hue of its badge, N/A in grey', () => {
        expect(typeFill('Vin')).toBe('#1d4ed8'); // blue, as its badge
        expect(typeFill('Mousseux')).toBe('#15803d'); // green
        expect(typeFill('N/A')).toBe('#6b7280');
        expect(typeFill('Cidre')).not.toBe('#6b7280');
    });
});
