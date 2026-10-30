/**
 * The long operation a page is running, such as a backup or an upload: one at a time, so that its
 * buttons can show it and the others wait for it.
 */
export class Jobs<Job extends string> {
    running = $state<Job | null>(null);

    /** Runs `work` as `job`, unless another job is running. Errors go to the caller. */
    async run(job: Job, work: () => Promise<void>): Promise<void> {
        if (this.running) return;
        this.running = job;
        try {
            await work();
        } finally {
            this.running = null;
        }
    }
}
