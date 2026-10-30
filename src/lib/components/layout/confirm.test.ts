import { describe, expect, it } from 'vitest';
import { confirm, confirmation } from './confirm.svelte';

describe('confirm', () => {
    it('shows the question and resolves to the answer', async () => {
        const answer = confirm({ message: 'Delete France?' });
        expect(confirmation.open).toBe(true);
        expect(confirmation.question?.message).toBe('Delete France?');

        confirmation.answer(true);

        expect(await answer).toBe(true);
        expect(confirmation.open).toBe(false);
    });

    it('cancels a question left open when another one comes', async () => {
        const first = confirm({ message: 'Delete France?' });
        const second = confirm({ message: 'Delete Italy?' });

        expect(await first).toBe(false);
        confirmation.answer(true);
        expect(await second).toBe(true);
    });
});
