import { matchesEveryWord } from '#lib/shared/names.js';
import {
    parsePageQuery,
    type QueryParams,
    type SortDirection
} from '#lib/shared/schemas/bottle-list.js';
import { compareText, compareValues } from '#lib/utils/compare.js';

/** The columns that the list of the producers sorts on: by name by default. */
const PRODUCER_COLUMNS = ['name', 'wineCount', 'bottleCount', 'consumedCount'] as const;

export type ProducerColumn = (typeof PRODUCER_COLUMNS)[number];

type ListedProducer = {
    name: string;
    regionName: string | null;
    countryName: string | null;
} & Record<Exclude<ProducerColumn, 'name'>, number>;

/**
 * The search, sort and page of the list, as its URL holds them
 * (`?search=&sort=wineCount&dir=desc&page=2&perPage=50`). A missing or invalid value gives its
 * default.
 */
export function readProducerListQuery(params: QueryParams) {
    return {
        search: params.get('search') ?? '',
        ...parsePageQuery(params, PRODUCER_COLUMNS, 'name')
    };
}

/**
 * The producers whose name, region or country hold every word of `search`, capitals, accents and
 * the kind of apostrophe aside, in the order asked; by name within equal counts.
 */
export function shownProducers<Producer extends ListedProducer>(
    producers: Producer[],
    { search, sort, direction }: { search: string; sort: ProducerColumn; direction: SortDirection }
): Producer[] {
    const matches = matchesEveryWord(search);
    return producers
        .filter((producer) => matches([producer.name, producer.regionName, producer.countryName]))
        .toSorted(
            (a, b) => compareValues(a[sort], b[sort], direction) || compareText(a.name, b.name)
        );
}
