import { describe, expect, it } from 'vitest';
import { Jobs } from './jobs.svelte';

describe('Jobs', () => {
    it('shows the job while it runs', async () => {
        const jobs = new Jobs<'backup'>();
        let finish = () => {};
        const running = jobs.run(
            'backup',
            () => new Promise<void>((resolve) => (finish = resolve))
        );

        expect(jobs.running).toBe('backup');
        finish();
        await running;
        expect(jobs.running).toBeNull();
    });

    it('does not start a second job while one runs', async () => {
        const jobs = new Jobs<'backup' | 'wipe'>();
        let finish = () => {};
        const backup = jobs.run('backup', () => new Promise<void>((resolve) => (finish = resolve)));
        let wiped = false;

        await jobs.run('wipe', async () => {
            wiped = true;
        });

        expect(wiped).toBe(false);
        finish();
        await backup;
    });

    it('ends the job when it fails, and passes the error on', async () => {
        const jobs = new Jobs<'restore'>();

        await expect(
            jobs.run('restore', () => Promise.reject(new Error('refused')))
        ).rejects.toThrow('refused');
        expect(jobs.running).toBeNull();
    });
});
