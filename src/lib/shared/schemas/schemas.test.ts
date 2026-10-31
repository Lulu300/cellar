import { describe, expect, it } from 'vitest';
import { bottleChangesSchema, bottleFromForm, bottleSchema, newBottlesSchema } from './bottle';
import { newContainerSchema } from './storage';
import { wineDefinitionSchema, wineFromForm } from './wine';

const bottle = { definitionId: 'margaux', formatId: 'bottle' };

describe('bottleSchema', () => {
    it('reads what the bottle form sends: empty fields as null, dates as Date', () => {
        expect(
            bottleSchema.parse({
                ...bottle,
                originId: '',
                storageCaseId: null,
                notes: '  ',
                purchaseDate: '2026-10-12',
                currentValueDate: '',
                barcode: ' CV00000001 '
            })
        ).toMatchObject({
            originId: null,
            storageCaseId: null,
            notes: null,
            purchaseDate: new Date('2026-10-12'),
            currentValueDate: null,
            barcode: 'CV00000001',
            availability: 'available'
        });
    });

    it('stores a barcode that a scanner gave as a number as text', () => {
        expect(bottleSchema.parse({ ...bottle, barcode: 3760123456789 }).barcode).toBe(
            '3760123456789'
        );
    });

    it.each([
        ['a barcode that is neither text nor a number', { barcode: { code: 1 } }],
        ['a format given by name only', { formatId: undefined, format: 'Magnum' }],
        ['an unknown status', { availability: 'sold' }],
        ['a date that is not one', { purchaseDate: 'soon' }],
        ['a vintage that is not a whole number', { vintage: 2015.5 }],
        ['a price that is not a number', { purchasePrice: '12 €' }]
    ])('refuses %s', (_, fields) => {
        expect(bottleSchema.safeParse({ ...bottle, ...fields }).success).toBe(false);
    });

    it('creates from 1 to 100 bottles in one request', () => {
        expect(newBottlesSchema.parse(bottle).quantity).toBe(1);
        expect(newBottlesSchema.safeParse({ ...bottle, quantity: 100 }).success).toBe(true);
        expect(newBottlesSchema.safeParse({ ...bottle, quantity: 1_000_000 }).success).toBe(false);
    });
});

describe('wineDefinitionSchema', () => {
    const wine = { name: 'Château Margaux', appellationId: 'mgx', typeId: 'still', colorId: 'red' };

    it('reads what the wine form sends', () => {
        expect(
            wineDefinitionSchema.parse({
                ...wine,
                classificationId: '',
                imageId: '',
                website: '',
                rating: 4.5,
                grapeVarieties: ['Merlot']
            })
        ).toMatchObject({ classificationId: null, imageId: null, website: null, rating: 4.5 });
    });

    it.each([
        ['no appellation', { appellationId: undefined }],
        ['a type given by name only', { typeId: undefined, type: 'Still' }],
        ['a rating above 5', { rating: 7 }],
        ['a website that is not http(s)', { website: 'javascript:alert(1)' }]
    ])('refuses %s', (_, fields) => {
        expect(wineDefinitionSchema.safeParse({ ...wine, ...fields }).success).toBe(false);
    });

    it('drops the columns a client may not set', () => {
        const parsed = wineDefinitionSchema.parse({ ...wine, id: 'other', createdAt: 0 });

        expect(parsed).not.toHaveProperty('id');
        expect(parsed).not.toHaveProperty('createdAt');
    });
});

// A wine emoji is two UTF-16 units, the measure of the forms and the imports (API-13).
const emoji = (units: number) => '🍷'.repeat(units / 2);

describe('the length of a text', () => {
    const wine = { name: 'Margaux', appellationId: 'mgx', typeId: 'still', colorId: 'red' };
    const container = { name: 'Rack', cases: ['A'] };
    const lengths = [
        [
            'a wine name',
            500,
            (text: string) => wineDefinitionSchema.safeParse({ ...wine, name: text })
        ],
        [
            'a producer',
            500,
            (text: string) => wineDefinitionSchema.safeParse({ ...wine, producer: text })
        ],
        [
            'a grape variety',
            100,
            (text: string) => wineDefinitionSchema.safeParse({ ...wine, grapeVarieties: [text] })
        ],
        [
            'a container name',
            500,
            (text: string) => newContainerSchema.safeParse({ ...container, name: text })
        ],
        [
            'a case suffix',
            50,
            (text: string) => newContainerSchema.safeParse({ ...container, cases: [text] })
        ]
    ] as const;

    it.each(lengths)('takes %s of emoji up to its %i UTF-16 units', (_, max, parse) => {
        expect(parse(emoji(max)).success).toBe(true);
        expect(parse(`a${emoji(max - 2)}`).success).toBe(true);
    });

    it.each(lengths)('refuses %s one unit over its %i, as too long', (_, max, parse) => {
        expect(parse(`${emoji(max)}a`).error?.issues).toMatchObject([
            { code: 'too_big', origin: 'string', maximum: max }
        ]);
    });
});

describe('the readers of the forms', () => {
    const form = (fields: [string, string][]) => {
        const data = new FormData();
        for (const [name, value] of fields) data.append(name, value);
        return data;
    };

    it('read a wine form as the API reads a body, with its repeated fields as a list', () => {
        const read = wineFromForm(
            form([
                ['name', 'Margaux'],
                ['appellationId', 'mgx'],
                ['typeId', 'still'],
                ['colorId', 'red'],
                ['rating', '4.5'],
                ['targetQuantity', ''],
                ['grapeVarieties', 'Merlot'],
                ['grapeVarieties', 'Malbec']
            ])
        );

        expect(wineDefinitionSchema.parse(read)).toMatchObject({
            rating: 4.5,
            targetQuantity: null,
            grapeVarieties: ['Merlot', 'Malbec']
        });
    });

    it('leave out the fields a form lacks, for an edit that sends only those changed', () => {
        expect(bottleChangesSchema.parse(bottleFromForm(form([['vintage', '2016']])))).toEqual({
            vintage: 2016
        });
    });

    it('let the schema refuse a number field that holds text, rather than empty it', () => {
        const read = bottleFromForm(form([...Object.entries(bottle), ['vintage', '20x6']]));

        expect(bottleSchema.safeParse(read).success).toBe(false);
    });
});
