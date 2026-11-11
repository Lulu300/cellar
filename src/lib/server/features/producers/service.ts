import type { Tx } from '#lib/server/db/connection.js';
import { db } from '#lib/server/db/index.js';
import { producers, wineDefinitions, type Producer } from '#lib/server/db/schema.js';
import { MissingReferenceError } from '#lib/server/db-errors.js';
import { regionHandlers } from '#lib/server/features/geography/service.js';
import { createLookupCrud, type Fields } from '#lib/server/features/shared/lookup-crud.js';
import { ConflictError, invalidField, NotFoundError } from '#lib/server/http/errors.js';
import { producerKey, tidyName } from '#lib/shared/names.js';
import {
    MERGED_FIELDS,
    producerSchema,
    type MergedField,
    type ProducerInput,
    type ProducerMerge
} from '#lib/shared/schemas/producer.js';
import {
    changeProducer,
    deleteProducer,
    getProducer,
    moveWines,
    producerRows,
    winesOfProducer,
    type ProducerRow
} from './repository';

/**
 * The place of a producer, given by either field: a region gives its country, which a countryId
 * given too must be; a body that gives one of them without the region clears the region.
 */
function placed(fields: Fields, tx: Tx): Fields {
    if (fields.countryId === undefined && fields.regionId === undefined) return fields;
    const regionId = fields.regionId ?? null;
    if (!regionId) return { ...fields, countryId: fields.countryId ?? null, regionId };
    const region = regionHandlers.get(regionId, tx);
    if (!region) throw new MissingReferenceError([{ field: 'regionId', id: regionId }]);
    if (fields.countryId && fields.countryId !== region.countryId) {
        throw invalidField('regionId', 'This region is not in the country given');
    }
    return { ...fields, countryId: region.countryId as string, regionId };
}

/**
 * The producers, as a reference table: a name that differs only in case, accents or blanks names
 * the same producer, which POST answers instead of creating another (FEAT-07).
 */
export const producerHandlers = createLookupCrud({
    table: producers,
    nameColumn: 'name',
    schema: producerSchema,
    rows: producerRows,
    key: producerKey,
    prepare: placed,
    usage: { column: wineDefinitions.producerId, usedBy: 'wine_definitions' }
});

/** The producers by name, with only their id and name, as the wine form offers them. */
export const producerNames = () =>
    db
        .select({ id: producers.id, name: producers.name })
        .from(producers)
        .orderBy(producers.name)
        .all();

/** The producers by name, with the names of their place and what they count. */
export const listProducers = () => producerHandlers.list() as ProducerRow[];

/** The producer with the names of its place and what it counts. */
const producerRow = (id: string, tx: Tx) => producerHandlers.get(id, tx) as ProducerRow | undefined;

/** A form's new producer, and whether it is new: one may have its name already. */
export const findOrCreateProducer = (fields: ProducerInput) => {
    const { row, created } = producerHandlers.findOrCreate(fields);
    return { producer: row as ProducerRow, created };
};

/** Saves the fields of a form on the producer. */
export const updateProducer = (id: string, fields: ProducerInput) =>
    producerHandlers.update(id, fields) as ProducerRow;

const producerNotFound = () => new NotFoundError('Producer not found');

/** The producer with its wines, each with its bottles in the cellar and drunk counted. */
export function getProducerDetails(id: string) {
    return db.transaction((tx) => {
        const producer = producerRow(id, tx);
        if (!producer) throw producerNotFound();
        return { ...producer, wines: winesOfProducer(id, tx) };
    });
}

/**
 * The producer that the fields of a wine give, by its id or by its name: the producer of that name
 * then, created when there is none. undefined when they give neither, as an edit that leaves the
 * producer as it is; null for none. Both must name the same producer.
 */
export function producerIdOf(
    { producerId, producer }: { producerId?: string | null; producer?: string | null },
    tx: Tx
): string | null | undefined {
    if (producerId === undefined && producer === undefined) return undefined;
    const name = tidyName(producer);
    if (!name) return producerId ?? null;
    if (!producerId) return producerHandlers.findOrCreate({ name }, tx).row.id;
    const row = producerHandlers.get(producerId, tx);
    if (!row) throw new MissingReferenceError([{ field: 'producerId', id: producerId }]);
    if (producerKey(row.name) !== producerKey(name)) {
        throw invalidField('producer', 'producer and producerId name two different producers');
    }
    return producerId;
}

/** The columns of a field of a merge, and their values for `producer`, null when all are empty. */
function mergedValues(producer: Producer, field: MergedField): Partial<Producer> | null {
    const values: Partial<Producer> =
        field === 'place'
            ? { countryId: producer.countryId, regionId: producer.regionId }
            : { [field]: producer[field] };
    return Object.values(values).some((value) => value != null) ? values : null;
}

/**
 * Merges producer `mergedId` into producer `keptId`: its wines move to the kept one, which takes
 * the fields it lacks, and those that `choices` says to take; then it is deleted. A field that both
 * fill differently without a choice refuses the merge (409 merge_choice_needed, with the fields),
 * so that no value goes unless the user chose so.
 */
export function mergeProducers({ keptId, mergedId, choices }: ProducerMerge) {
    return db.transaction((tx) => {
        const kept = getProducer(keptId, tx);
        const merged = getProducer(mergedId, tx);
        if (!kept || !merged) throw producerNotFound();

        const taken: Partial<Producer> = {};
        const unchosen: MergedField[] = [];
        for (const field of MERGED_FIELDS) {
            const keptValues = mergedValues(kept, field);
            const mergedValuesOf = mergedValues(merged, field);
            if (!mergedValuesOf) continue;
            if (JSON.stringify(keptValues) === JSON.stringify(mergedValuesOf)) continue;
            const choice = keptValues ? choices[field] : 'merged';
            if (!choice) unchosen.push(field);
            else if (choice === 'merged') Object.assign(taken, mergedValuesOf);
        }
        if (unchosen.length > 0) {
            throw new ConflictError(
                'merge_choice_needed',
                `Both producers have a different ${unchosen.join(', ')}: choose which to keep`,
                { fields: unchosen }
            );
        }
        moveWines(mergedId, keptId, tx);
        deleteProducer(mergedId, tx);
        if (Object.keys(taken).length > 0) changeProducer(keptId, taken, tx);
        return producerRow(keptId, tx)!;
    });
}
