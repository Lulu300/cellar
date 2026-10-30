import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { wineBottles, wineDefinitions } from '#lib/server/db/schema.js';
import { createBottles } from '#lib/server/features/bottles/service.js';
import { wineDefinitionSchema } from '#lib/shared/schemas/wine.js';
import { bottleData, insertWineDefinition } from '../../../../test/wine';
import {
    createDefinition,
    deleteDefinitionAndBottles,
    getDefinitionDetails,
    listWines,
    replaceDefinition
} from './service';

let margaux: string;
const definition = (name: string) =>
    wineDefinitionSchema.parse({ name, appellationId: 'mgx', typeId: 'still', colorId: 'red' });

beforeAll(async () => {
    margaux = await insertWineDefinition();
});

beforeEach(() => {
    db.delete(wineBottles).run();
});

describe('wine definitions', () => {
    it('come with their nested location only', () => {
        const wine = getDefinitionDetails(margaux);

        expect(wine).toMatchObject({
            appellation: { name: 'Margaux', region: { name: 'Bordeaux', country: { id: 'fr' } } },
            type: 'Still',
            grapeVarieties: []
        });
        for (const flat of ['appellations', 'regions', 'countries']) {
            expect(wine).not.toHaveProperty(flat);
        }
    });

    it('answer 404 for a wine that does not exist', () => {
        const notFound = expect.objectContaining({ status: 404 });
        expect(() => getDefinitionDetails('nowhere')).toThrow(notFound);
        expect(() => replaceDefinition('nowhere', definition('Ghost'))).toThrow(notFound);
        expect(() => deleteDefinitionAndBottles('nowhere', true)).toThrow(notFound);
    });

    it('are deleted with their bottles only when asked, all or nothing', () => {
        const { id } = createDefinition(definition('Pauillac'));
        createBottles(bottleData(id), 2);

        expect(() => deleteDefinitionAndBottles(id, false)).toThrow(
            expect.objectContaining({ code: 'in_use', details: { bottleCount: 2 } })
        );
        deleteDefinitionAndBottles(id, true);
        expect(db.select().from(wineBottles).all()).toEqual([]);
        expect(
            db
                .select()
                .from(wineDefinitions)
                .all()
                .map((row) => row.id)
        ).toEqual([margaux]);
    });
});

describe('listWines', () => {
    it('lists each wine with its bottles, which do not repeat the wine, and a wine without bottles', () => {
        createBottles(bottleData(margaux, { vintage: 2015 }), 2);
        const { id: empty } = createDefinition(definition('Pauillac'));

        const wines = listWines();

        expect(wines).toHaveLength(2);
        const withBottles = wines.find((entry) => entry.definition.id === margaux)!;
        // Nothing but the wine and its bottles: no fields of a first bottle beside them
        expect(Object.keys(withBottles).sort()).toEqual(['bottles', 'definition']);
        expect(withBottles.bottles).toHaveLength(2);
        expect(withBottles.bottles[0]).not.toHaveProperty('definition');
        expect(withBottles.bottles[0]).toMatchObject({ vintage: 2015, format: 'Bottle' });
        expect(withBottles.definition).toMatchObject({ region: 'Bordeaux', country: 'France' });
        expect(wines.find((entry) => entry.definition.id === empty)!.bottles).toEqual([]);
    });

    it('leaves the consumed bottles out only for the wine list', () => {
        createBottles(bottleData(margaux, { availability: 'available' }), 1);
        createBottles(bottleData(margaux, { availability: 'out_of_cellar' }), 1);
        createBottles(bottleData(margaux, { availability: 'consumed' }), 1);
        const availabilities = (wines: ReturnType<typeof listWines>) =>
            wines
                .find((entry) => entry.definition.id === margaux)!
                .bottles.map((bottle) => bottle.availability)
                .sort();

        expect(availabilities(listWines())).toEqual(['available', 'consumed', 'out_of_cellar']);
        expect(availabilities(listWines({ ownedOnly: true }))).toEqual([
            'available',
            'out_of_cellar'
        ]);
    });
});
