/**
 * A logger for the details of a task, silent unless the DEBUG environment variable names its
 * namespace: `DEBUG=csv-import`, several separated by commas, or `*` for all, as with the debug
 * package. It is read once, at startup.
 */
export function debugLogger(namespace: string): (...values: unknown[]) => void {
    const enabled = (process.env.DEBUG ?? '').split(',').map((name) => name.trim());
    if (!enabled.includes(namespace) && !enabled.includes('*')) return () => {};
    return (...values) => console.debug(`[${namespace}]`, ...values);
}
