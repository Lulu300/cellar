import { describe, expect, it } from 'vitest';
import { bottlesComingIn, caseLeft, type MovedBottle } from './case-move';

const bottle = (fields: Partial<MovedBottle>): MovedBottle => ({
    caseId: 'a1',
    inCellar: true,
    inCellarAfter: true,
    ...fields
});

// The case picker greys a case without room for what comes in (FEAT-04 review): it must count
// as the server does, the bottles in the cellar only.
describe('bottlesComingIn', () => {
    it('counts the bottles in the cellar after the move that the case does not hold yet', () => {
        const bottles = [bottle({}), bottle({ caseId: 'b2' }), bottle({ caseId: null })];

        expect(bottlesComingIn(bottles, 'a1')).toBe(2);
        expect(bottlesComingIn(bottles, 'c3')).toBe(3);
    });

    it('leaves out a bottle out of the cellar, which takes no place in its new case', () => {
        expect(bottlesComingIn([bottle({ inCellar: false, inCellarAfter: false })], 'b2')).toBe(0);
    });

    it('counts a bottle put back in the case it kept out of the cellar, which was not in it', () => {
        expect(bottlesComingIn([bottle({ inCellar: false })], 'a1')).toBe(1);
    });
});

describe('caseLeft', () => {
    it('gives the case all the bottles share, with the places of those in the cellar', () => {
        expect(caseLeft([bottle({}), bottle({}), bottle({ inCellar: false })])).toEqual({
            caseId: 'a1',
            count: 2
        });
    });

    it('gives nothing for bottles of several cases or of none', () => {
        expect(caseLeft([bottle({}), bottle({ caseId: 'b2' })])).toBeUndefined();
        expect(caseLeft([bottle({ caseId: null })])).toBeUndefined();
        expect(caseLeft([])).toBeUndefined();
    });
});
