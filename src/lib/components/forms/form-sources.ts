import { BottleAvailability } from '#lib/shared/bottle-availability.js';
import { formatInputNumber, isoDate } from '#lib/utils/format.js';

/** A wine that the wine form edits or duplicates, from whichever list it comes. */
export type WineFormSource = {
    id: string;
    name: string;
    producer: string | null;
    appellationId: string;
    classificationId: string | null;
    typeId: string;
    colorId: string;
    website?: string | null;
    description?: string | null;
    imageId?: string | null;
    rating: number | null;
    targetQuantity: number | null;
    grapeVarieties: string[] | null;
};

/** What a new wine starts from: the name and the photo of a wish of the wishlist. */
export type WineDraft = Pick<WineFormSource, 'name' | 'imageId'>;

type Day = string | Date | null;

/**
 * A bottle that the bottle form edits or duplicates, as the lists give it: the page data with
 * dates, the API with ISO strings.
 */
export type BottleFormSource = {
    id: string;
    definitionId: string;
    originId: string | null;
    formatId: string;
    vintage: number | null;
    optimum: number | null;
    purchasePrice: number | null;
    purchaseDate: Day;
    currentValue: number | null;
    currentValueDate: Day;
    storageCaseId: string | null;
    /** Its case, by name, when the screen has it. */
    storageCase?: { name: string } | null;
    notes: string | null;
    barcode: string | null;
    availability: BottleAvailability;
    consumedDate?: Day;
};

const text = (value: string | null | undefined) => value ?? '';
const day = (value: Day | undefined) => (value ? isoDate(value) : '');

/**
 * The fields of the bottle form, as the form holds them, for `bottle`: empty for a new bottle. A
 * copy is a new bottle in the cellar, which gets its own barcode. The copy of a drunk bottle starts
 * in no case, as before drunk bottles kept theirs: the case it left may have no room any more.
 */
export function bottleFormValues(
    bottle: BottleFormSource | null,
    { copy = false, definitionId = '' } = {}
): Record<string, string> {
    const fields = {
        definitionId: bottle?.definitionId ?? definitionId,
        originId: text(bottle?.originId),
        formatId: text(bottle?.formatId),
        vintage: formatInputNumber(bottle?.vintage),
        optimum: formatInputNumber(bottle?.optimum),
        purchasePrice: formatInputNumber(bottle?.purchasePrice),
        purchaseDate: day(bottle?.purchaseDate),
        currentValue: formatInputNumber(bottle?.currentValue),
        currentValueDate: day(bottle?.currentValueDate),
        storageCaseId: text(bottle?.storageCaseId),
        notes: text(bottle?.notes),
        barcode: text(bottle?.barcode),
        availability: bottle?.availability ?? BottleAvailability.AVAILABLE,
        consumedDate: day(bottle?.consumedDate)
    };
    if (!copy) return fields;
    return {
        ...fields,
        ...(bottle?.availability === BottleAvailability.CONSUMED && { storageCaseId: '' }),
        barcode: '',
        availability: BottleAvailability.AVAILABLE,
        consumedDate: ''
    };
}

/**
 * Drops from `form` the fields that still hold their value of `before`: an edit sends only the
 * fields changed, so that what the form cannot show exactly, such as the time of a date, stays.
 */
export function dropUnchanged(form: FormData, before: Record<string, string>): void {
    for (const [name, value] of Object.entries(before)) {
        if (form.get(name) === value) form.delete(name);
    }
}
