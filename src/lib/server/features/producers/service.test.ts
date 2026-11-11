import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import {
    countries,
    producers,
    regions,
    wineBottles,
    wineDefinitions,
    wineImages
} from '#lib/server/db/schema.js';
import { createDefinition, editDefinition } from '#lib/server/features/catalog/service.js';
import { ConflictError, ValidationError } from '#lib/server/http/errors.js';
import { MissingReferenceError } from '#lib/server/db-errors.js';
import { producerSchema } from '#lib/shared/schemas/producer.js';
import { wineDefinitionSchema } from '#lib/shared/schemas/wine.js';
import { insertBottles, insertProducer, insertWineDefinition } from '../../../../test/wine';
import {
    findOrCreateProducer,
    getProducerDetails,
    listProducers,
    mergeProducers,
    producerHandlers,
    updateProducer
} from './service';

const now = new Date();
const timestamps = { createdAt: now, updatedAt: now };
const wine = (name: string, fields: Record<string, unknown> = {}) =>
    wineDefinitionSchema.parse({
        name,
        appellationId: 'mgx',
        typeId: 'still',
        colorId: 'red',
        ...fields
    });
const producerNamed = (name: string) =>
    db.select().from(producers).where(eq(producers.name, name)).get();

beforeAll(async () => {
    await insertWineDefinition();
    await db.insert(countries).values({ id: 'it', name: 'Italie', ...timestamps });
    await db
        .insert(regions)
        .values({ id: 'piemont', name: 'Piémont', countryId: 'it', ...timestamps });
    await db.insert(wineImages).values([
        { id: 'photo-a', filename: 'a.jpg', ...timestamps },
        { id: 'photo-b', filename: 'b.jpg', ...timestamps }
    ]);
});

beforeEach(() => {
    db.delete(wineBottles).run();
    db.update(wineDefinitions).set({ producerId: null }).run();
    db.delete(wineDefinitions).where(eq(wineDefinitions.id, 'margaux')).run();
    db.delete(wineDefinitions).run();
    db.delete(producers).run();
});

describe('a new producer', () => {
    it('is the existing one of the same name, whatever its case, accents and blanks', () => {
        const { producer, created } = findOrCreateProducer(
            producerSchema.parse({ name: '  Château   Margaux ' })
        );
        expect(created).toBe(true);
        expect(producer.name).toBe('Château Margaux');

        for (const name of ['chateau margaux', 'CHÂTEAU MARGAUX']) {
            const again = findOrCreateProducer(producerSchema.parse({ name }));
            expect(again).toMatchObject({ created: false, producer: { id: producer.id } });
        }
        expect(listProducers()).toHaveLength(1);
    });

    it('takes the country of its region, and refuses a region of another country', () => {
        const { producer } = findOrCreateProducer(
            producerSchema.parse({ name: 'Mascarello', regionId: 'piemont' })
        );
        expect(producer).toMatchObject({
            countryId: 'it',
            countryName: 'Italie',
            regionName: 'Piémont'
        });

        expect(() =>
            findOrCreateProducer(
                producerSchema.parse({ name: 'Other', regionId: 'piemont', countryId: 'fr' })
            )
        ).toThrow(ValidationError);
        expect(() =>
            findOrCreateProducer(producerSchema.parse({ name: 'Ghost', regionId: 'nowhere' }))
        ).toThrow(MissingReferenceError);
    });
});

describe('a producer changed', () => {
    it('keeps the fields left out, and clears those sent empty', () => {
        const { producer } = findOrCreateProducer(
            producerSchema.parse({
                name: 'Mascarello',
                regionId: 'piemont',
                website: 'https://mascarello.example',
                contact: 'Monforte',
                imageId: 'photo-a'
            })
        );

        const renamed = updateProducer(
            producer.id,
            producerSchema.parse({ name: 'Giuseppe Mascarello', contact: '' })
        );

        expect(renamed).toMatchObject({
            name: 'Giuseppe Mascarello',
            regionId: 'piemont',
            countryId: 'it',
            website: 'https://mascarello.example',
            contact: null,
            imageId: 'photo-a'
        });
        // A country alone is a new place: the region of the other country goes.
        expect(
            updateProducer(producer.id, producerSchema.parse({ name: 'G.M.', countryId: 'fr' }))
        ).toMatchObject({ countryId: 'fr', regionId: null });
    });

    it('cannot take the name of another producer, in any spelling', async () => {
        await insertProducer('Guigal');
        const id = await insertProducer('E. Guigal');

        expect(() => updateProducer(id, producerSchema.parse({ name: 'GUIGAL' }))).toThrow(
            ConflictError
        );
    });
});

describe('a producer deleted', () => {
    it('is refused while a wine uses it, with their number', async () => {
        const producerId = await insertProducer('Taylor’s');
        createDefinition(wine('Vintage Port', { producerId }));

        expect(() => producerHandlers.remove(producerId)).toThrow(
            expect.objectContaining({
                code: 'in_use',
                details: { count: 1, usedBy: 'wine_definitions' }
            })
        );

        db.delete(wineDefinitions).run();
        producerHandlers.remove(producerId);
        expect(producerNamed('Taylor’s')).toBeUndefined();
    });
});

describe('the producer of a wine', () => {
    // Scripts written before producers were a list send its name (FEAT-07).
    it('is given by its name, found in any spelling or created', () => {
        const first = createDefinition(wine('Bin 1', { producer: 'Domaine de l’Arlot' }));
        const second = createDefinition(wine('Bin 2', { producer: "DOMAINE DE L'ARLOT" }));

        expect(second.producerId).toBe(first.producerId);
        expect(second.producer).toBe('Domaine de l’Arlot');
        expect(listProducers()).toHaveLength(1);
    });

    it('is given by its id, which its name must not contradict', async () => {
        const producerId = await insertProducer('Clos Rougeard');
        const saved = createDefinition(wine('Le Bourg', { producerId, producer: 'clos rougeard' }));
        expect(saved).toMatchObject({ producerId, producer: 'Clos Rougeard' });

        expect(() =>
            createDefinition(wine('Les Poyeux', { producerId, producer: 'Guigal' }))
        ).toThrow(ValidationError);
        expect(() => createDefinition(wine('Lost', { producerId: 'nobody' }))).toThrow(
            MissingReferenceError
        );
    });

    it('stays as it is when an edit leaves it out, and goes with null', () => {
        const saved = createDefinition(wine('Bin 3', { producer: 'Huet' }));

        expect(editDefinition(saved.id, { description: 'Sec' }).producer).toBe('Huet');
        expect(editDefinition(saved.id, { producer: null })).toMatchObject({
            producerId: null,
            producer: null
        });
    });
});

describe('a producer page', () => {
    it('lists its wines with their bottles in the cellar and drunk', async () => {
        const producerId = await insertProducer('Huet');
        const { id } = createDefinition(wine('Le Mont', { producerId }));
        await insertBottles(id, [
            { availability: 'available' },
            { availability: 'available' },
            { availability: 'consumed' },
            { availability: 'out_of_cellar' }
        ]);

        expect(getProducerDetails(producerId)).toMatchObject({
            name: 'Huet',
            wineCount: 1,
            bottleCount: 2,
            consumedCount: 1,
            wines: [{ id, name: 'Le Mont', bottleCount: 2, consumedCount: 1 }]
        });
    });
});

describe('a merge', () => {
    async function twoProducers() {
        const kept = findOrCreateProducer(
            producerSchema.parse({
                name: 'E. Guigal',
                regionId: 'piemont',
                website: 'https://guigal.example',
                imageId: 'photo-a'
            })
        ).producer;
        const merged = findOrCreateProducer(
            producerSchema.parse({
                name: 'Guigal',
                website: 'https://guigal.example/fr',
                contact: 'Ampuis',
                imageId: 'photo-b'
            })
        ).producer;
        const keptWine = createDefinition(wine('Côte-Rôtie', { producerId: kept.id }));
        const mergedWine = createDefinition(wine('Côtes du Rhône', { producerId: merged.id }));
        return { kept, merged, wines: [keptWine.id, mergedWine.id] };
    }

    it('is refused, changing nothing, while a field both fill differently has no choice', async () => {
        const { kept, merged } = await twoProducers();

        expect(() => mergeProducers({ keptId: kept.id, mergedId: merged.id, choices: {} })).toThrow(
            expect.objectContaining({
                code: 'merge_choice_needed',
                details: { fields: ['website', 'imageId'] }
            })
        );
        expect(listProducers()).toHaveLength(2);
    });

    it('moves the wines, takes what the kept one lacks and what was chosen, then deletes the other', async () => {
        const { kept, merged, wines } = await twoProducers();

        const result = mergeProducers({
            keptId: kept.id,
            mergedId: merged.id,
            choices: { website: 'merged', imageId: 'kept' }
        });

        expect(result).toMatchObject({
            id: kept.id,
            name: 'E. Guigal',
            regionId: 'piemont',
            website: 'https://guigal.example/fr',
            contact: 'Ampuis',
            imageId: 'photo-a',
            wineCount: 2
        });
        expect(listProducers().map((producer) => producer.name)).toEqual(['E. Guigal']);
        for (const id of wines) {
            expect(
                db.select().from(wineDefinitions).where(eq(wineDefinitions.id, id)).get()
                    ?.producerId
            ).toBe(kept.id);
        }
        // The photo not taken stays among the images, for the admin to delete.
        expect(
            db
                .select()
                .from(wineImages)
                .all()
                .map((image) => image.id)
        ).toContain('photo-b');
    });
});
