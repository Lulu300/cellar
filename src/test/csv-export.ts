import { expect } from 'vitest';
import { POST } from '../routes/api/admin/export-csv/+server';
import { fakeEvent } from './event';

/** The CSV files of `tables`, as the admin page exports them. */
export async function exportCsvFiles(tables: readonly string[]): Promise<File[]> {
    const response = await POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/export-csv',
            routeId: '/api/admin/export-csv',
            body: { tables }
        })
    );
    expect(response.status).toBe(200);
    const { files } = (await response.json()) as { files: { filename: string; csv: string }[] };
    return files.map(({ filename, csv }) => new File([csv], filename, { type: 'text/csv' }));
}
