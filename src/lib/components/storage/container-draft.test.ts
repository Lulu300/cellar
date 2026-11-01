import { describe, expect, it } from 'vitest';
import type { StorageContainerDTO } from '#lib/shared/dto.js';
import { caseKey, ContainerDraft, isValidCapacity } from './container-draft.svelte';

const now = new Date();

function container(name: string, cases: [id: string, name: string][]): StorageContainerDTO {
    return {
        id: 'rack',
        name,
        parentContainerId: null,
        createdAt: now,
        updatedAt: now,
        cases: cases.map(([id, caseName]) => ({
            id,
            name: caseName,
            capacity: 6,
            containerId: 'rack',
            bottles: 0,
            colors: []
        }))
    };
}

describe('ContainerDraft', () => {
    it('proposes ten cases of five places for a new container, and sends no id', () => {
        const draft = ContainerDraft.create();
        draft.name = ' Fridge ';
        draft.count = 3;

        expect(draft.body()).toEqual({
            name: 'Fridge',
            cases: ['1', '2', '3'],
            caseCapacities: [5, 5, 5]
        });
    });

    it('sends every case of an edited container, by id, in the order of the draft', () => {
        const draft = ContainerDraft.edit(
            container('A', [
                ['a1', 'A1'],
                ['a2', 'A2'],
                ['a3', 'A3']
            ])
        );

        draft.remove(1);
        draft.add();
        draft.cases[0].capacity = 4;

        expect(draft.body()).toEqual({
            name: 'A',
            cases: ['1', '3', '4'],
            caseCapacities: [4, 6, 5],
            caseIds: ['a1', 'a3', null],
            updatedAt: now.toISOString()
        });
    });

    // An import may name the cases of a container as it likes: the number that ends them is not
    // their suffix, or the save would give two cases the same name and be refused.
    it('gives a case not named after its container its whole name as its suffix', () => {
        const draft = ContainerDraft.edit(
            container('Fridge', [
                ['top', 'Top1'],
                ['bottom', 'Bottom1']
            ])
        );

        expect(draft.body()).toMatchObject({
            name: 'Fridge',
            cases: ['Top1', 'Bottom1'],
            caseIds: ['top', 'bottom']
        });
    });

    it('proposes a first case for a container that has none', () => {
        const draft = ContainerDraft.edit(container('Fridge', []));

        expect(draft.body()).toMatchObject({ cases: ['1'], caseIds: [null] });
    });

    // Found in the audit: saving "Wine Column X" renamed it "Wine X".
    it('keeps "Column" inside a name, and leaves out only the "Column " of the first versions', () => {
        expect(ContainerDraft.edit(container('Wine Column X', [])).name).toBe('Wine Column X');
        expect(ContainerDraft.edit(container('Column C', [])).name).toBe('C');
    });

    // Up to 0.7.0, the dialog turned an empty suffix into the number of the case, and renamed
    // case "Box Z" to "Box Z1" when the container was saved.
    it('takes the suffix of each case from its name', () => {
        const draft = ContainerDraft.edit(
            container('Column C', [
                ['c', 'Column C'],
                ['c1', 'C1'],
                ['top', 'Top shelf'],
                ['x3', 'X3']
            ])
        );

        expect(draft.name).toBe('C');
        expect(draft.cases.map(({ suffix }) => suffix)).toEqual(['', '1', 'Top shelf', 'X3']);
    });
});

describe('ContainerDraft errors', () => {
    it('says under each field what the rules of the server and the capacities refuse', () => {
        const draft = ContainerDraft.create();
        draft.name = 'Fridge';
        draft.count = 3;
        draft.cases[0].suffix = 'x'.repeat(51);
        draft.cases[2].capacity = null;

        expect(draft.check()).toBe(false);
        expect(draft.errors).toEqual({
            [caseKey(0)]: '50 characters at most.',
            [caseKey(2)]: 'Enter a whole number of bottles between 1 and 1,000.'
        });
    });

    // Found during BUG-14: a refusal of the server only showed in a toast.
    it.each([
        [
            'a taken name under the name',
            { code: 'duplicate_container', details: { name: 'Fridge' } },
            'name'
        ],
        [
            'a repeated case under it',
            { code: 'duplicate_case', details: { caseName: 'Fridge top', position: 1 } },
            caseKey(1)
        ],
        [
            'a case too small for its bottles under it, found by its name',
            { code: 'case_full', details: { caseName: 'Fridge top', capacity: 1, bottles: 2 } },
            caseKey(1)
        ],
        [
            'an invalid suffix under its case',
            { code: 'invalid_body', details: [{ path: 'cases.1', message: 'Too big' }] },
            caseKey(1)
        ]
    ])('shows %s', (_, error, key) => {
        const draft = ContainerDraft.create();
        draft.name = 'Fridge ';
        draft.count = 2;
        draft.cases[1].suffix = ' top  ';

        expect(draft.showRefusal({ error: { message: '', ...error } })).toBe(true);
        expect(Object.keys(draft.errors)).toEqual([key]);
    });

    it('forgets the errors of the cases it drops', () => {
        const draft = ContainerDraft.create();
        draft.count = 3;
        draft.cases[2].capacity = null;
        draft.check();

        draft.count = 2;
        draft.count = 3;

        expect(draft.errors).toEqual({});
    });

    it('leaves a refusal about no field to the dialog', () => {
        const draft = ContainerDraft.create();

        expect(draft.showRefusal({ error: { code: 'container_changed', message: '' } })).toBe(
            false
        );
        expect(draft.errors).toEqual({});
    });
});

// Found after BUG-14: an emptied capacity was saved as the default of the API, 5.
describe('isValidCapacity', () => {
    it('accepts a whole number of bottles from 1 to 1000', () => {
        expect([1, 6, 1000].map(isValidCapacity)).toEqual([true, true, true]);
    });

    it.each([null, '', '1e', 0, 2.5, 1001])('refuses %j', (capacity) => {
        expect(isValidCapacity(capacity)).toBe(false);
    });
});
