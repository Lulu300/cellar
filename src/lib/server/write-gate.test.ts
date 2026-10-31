import { describe, expect, it } from 'vitest';
import { holdWrites, runAsWrite, runWrite } from './write-gate';

/** A promise and the function that resolves it. */
function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((done) => (resolve = done));
    return { promise, resolve };
}

describe('holdWrites', () => {
    it('waits for the writes under way, then refuses new ones until it ends', async () => {
        const write = deferred<Response>();
        const writing = runWrite(() => write.promise);
        const steps: string[] = [];

        const holding = holdWrites(async () => {
            steps.push('task');
            expect((await runWrite(async () => new Response('late write'))).status).toBe(503);
        });
        await Promise.resolve();
        expect(steps).toEqual([]);

        write.resolve(new Response('write'));
        expect(await (await writing).text()).toBe('write');
        await holding;
        expect(steps).toEqual(['task']);
        expect(await (await runWrite(async () => new Response('next write'))).text()).toBe(
            'next write'
        );
    });

    it('refuses a second holder', async () => {
        const task = deferred<void>();
        const first = holdWrites(() => task.promise);

        await expect(holdWrites(async () => {})).rejects.toMatchObject({
            status: 503,
            code: 'writes_held'
        });

        task.resolve();
        await first;
    });

    it('releases the writes when its task fails', async () => {
        await expect(
            holdWrites(async () => {
                throw new Error('restore failed');
            })
        ).rejects.toThrow('restore failed');

        expect((await runWrite(async () => new Response('write'))).status).toBe(200);
    });
});

describe('runAsWrite', () => {
    it('runs a write, which a hold waits for, and is refused while the writes are held', async () => {
        const write = deferred<string>();
        const writing = runAsWrite(() => write.promise);
        const steps: string[] = [];

        const holding = holdWrites(async () => {
            steps.push('task');
            await expect(runAsWrite(() => 'late write')).rejects.toMatchObject({
                status: 503,
                code: 'writes_held'
            });
        });
        await Promise.resolve();
        expect(steps).toEqual([]);

        write.resolve('written');
        expect(await writing).toBe('written');
        await holding;
        expect(steps).toEqual(['task']);
        expect(await runAsWrite(() => 'next write')).toBe('next write');
    });

    it('ends its write when it fails, so that a hold does not wait for it', async () => {
        await expect(
            runAsWrite(() => {
                throw new Error('write failed');
            })
        ).rejects.toThrow('write failed');

        expect(await holdWrites(async () => 'held')).toBe('held');
    });
});
