import { describe, expect, it } from 'vitest';
import { readProducerListQuery, shownProducers } from './producer-list';

const producer = (name: string, wineCount: number, regionName: string | null = null) => ({
    name,
    regionName,
    countryName: regionName ? 'France' : null,
    wineCount,
    bottleCount: wineCount * 2,
    consumedCount: 0
});
const PRODUCERS = [
    producer('Domaine Huet', 2, 'Vallée de la Loire'),
    producer('Château Margaux', 4, 'Bordeaux'),
    producer('Élise Dupont', 1),
    producer('Clos Rougeard', 1, 'Vallée de la Loire'),
    producer('Domaine de l’Arlot', 2)
];
const query = (params: string) => readProducerListQuery(new URLSearchParams(params));
const names = (params: string) => shownProducers(PRODUCERS, query(params)).map((p) => p.name);

describe('the list of the producers', () => {
    it('sorts by name by default, accents aside', () => {
        expect(names('')).toEqual([
            'Château Margaux',
            'Clos Rougeard',
            'Domaine de l’Arlot',
            'Domaine Huet',
            'Élise Dupont'
        ]);
    });

    it('finds every word in the name, region or country, capitals, accents and apostrophes aside', () => {
        expect(names('search=loire')).toEqual(['Clos Rougeard', 'Domaine Huet']);
        expect(names('search=CHATEAU%20france')).toEqual(['Château Margaux']);
        expect(names('search=elise')).toEqual(['Élise Dupont']);
        expect(names("search=l'arlot")).toEqual(['Domaine de l’Arlot']);
    });

    it('sorts on a count, by name within equal counts', () => {
        expect(names('sort=wineCount&dir=desc')).toEqual([
            'Château Margaux',
            'Domaine de l’Arlot',
            'Domaine Huet',
            'Clos Rougeard',
            'Élise Dupont'
        ]);
        expect(query('sort=other').sort).toBe('name');
    });
});
