import { beforeEach, describe, expect, it } from 'vitest';
import { LabelOptions } from '#lib/components/barcode/label-options.svelte.js';
import type { LabelLayout } from '#lib/shared/schemas/label.js';
import { db } from '#lib/server/db/index.js';
import { labelPresets } from '#lib/server/db/schema.js';
import { fakeEvent } from '../../../../test/event';
import { GET as list, POST } from './+server';
import { DELETE, GET, PUT } from './[id]/+server';

const preset = {
    name: 'Shelf labels',
    description: '',
    pageFormat: 'A4',
    labelWidth: 90,
    labelHeight: 30,
    marginTop: 10,
    marginLeft: 10,
    marginBottom: 10,
    marginRight: 10,
    labelPadding: 2,
    horizontalSpacing: 2,
    verticalSpacing: 2,
    codeType: 'barcode',
    showCodeValue: true
};

const post = (body: unknown) =>
    POST(
        fakeEvent<Parameters<typeof POST>[0]>({
            method: 'POST',
            path: '/api/admin/label-presets',
            routeId: '/api/admin/label-presets',
            body
        })
    );

/** The event of /api/admin/label-presets/{id}, which GET, PUT and DELETE share. */
const presetEvent = (method: string, id: string, body?: unknown) =>
    fakeEvent<Parameters<typeof PUT>[0]>({
        method,
        path: `/api/admin/label-presets/${id}`,
        routeId: '/api/admin/label-presets/[id]',
        params: { id },
        body
    });

const put = (id: string, body: unknown) => PUT(presetEvent('PUT', id, body));

describe('label presets', () => {
    beforeEach(async () => {
        await db.delete(labelPresets);
    });

    it('saves a preset, with labelPadding in the older padding column too', async () => {
        const response = await post(preset);

        expect(response.status).toBe(201);
        expect(await response.json()).toMatchObject({ ...preset, description: null, padding: 2 });
    });

    it('saves the label border, off for a client that does not send it', async () => {
        const bordered = await (await post({ ...preset, showBorder: true })).json();
        expect(bordered.showBorder).toBe(true);

        const response = await put(bordered.id, preset);

        expect(await response.json()).toMatchObject({ id: bordered.id, showBorder: false });
        expect(await db.select().from(labelPresets)).toEqual([
            expect.objectContaining({ showBorder: false })
        ]);
    });

    it('answers 422 to a border that is not a boolean', async () => {
        expect((await post({ ...preset, showBorder: 'yes' })).status).toBe(422);
    });

    // parseFloat used to store NaN, read back as NULL, which nothing repairs since migration 0005.
    it.each([
        ['a spacing that is not a number', { horizontalSpacing: 'wide' }],
        ['a spacing sent as text', { verticalSpacing: '2' }],
        ['a missing padding', { labelPadding: undefined }]
    ])('answers 422 to %s, and saves nothing', async (_, fields) => {
        const response = await post({ ...preset, ...fields });

        expect(response.status).toBe(422);
        expect(await db.select().from(labelPresets)).toEqual([]);
    });

    it('answers 409 to the name of another preset', async () => {
        await post(preset);
        const { id } = await (await post({ ...preset, name: 'Other' })).json();

        const response = await put(id, preset);

        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('duplicate_name');
    });

    // The PDF would refuse these labels: a preset of them could never print.
    it.each([
        ['labels wider than the page', { labelWidth: 400 }, 'labels_do_not_fit', undefined],
        [
            'a QR code under 10 mm',
            { codeType: 'qrcode', labelWidth: 8, labelHeight: 8, showCodeValue: false },
            'label_too_small',
            { issues: [expect.objectContaining({ code: 'qr_size_below_minimum' })] }
        ]
    ])('answers 422 to %s, and saves nothing', async (_, fields, code, details) => {
        const { id } = await (await post(preset)).json();

        const created = await post({ ...preset, ...fields, name: 'Unprintable' });
        const updated = await put(id, { ...preset, ...fields });

        for (const response of [created, updated]) {
            expect(response.status).toBe(422);
            expect((await response.json()).error).toEqual({
                code,
                message: expect.any(String),
                ...(details && { details })
            });
        }
        expect(await db.select().from(labelPresets)).toEqual([
            expect.objectContaining({ id, ...preset, description: null })
        ]);
    });

    it('lists the presets by name', async () => {
        await post(preset);
        await post({ ...preset, name: 'Bottle labels', codeType: 'qrcode' });

        const response = await list(
            fakeEvent<Parameters<typeof list>[0]>({ path: '/api/admin/label-presets' })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([
            expect.objectContaining({ name: 'Bottle labels', codeType: 'qrcode' }),
            expect.objectContaining({ name: 'Shelf labels', codeType: 'barcode' })
        ]);
    });

    it('gives one preset by its id', async () => {
        const created = await (await post(preset)).json();

        const response = await GET(presetEvent('GET', created.id));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(created);
    });

    it('deletes a preset', async () => {
        const { id } = await (await post(preset)).json();

        const response = await DELETE(presetEvent('DELETE', id));

        expect(response.status).toBe(204);
        expect(await db.select().from(labelPresets)).toEqual([]);
    });

    it.each([
        ['GET', GET],
        ['DELETE', DELETE]
    ])('answers 404 to the %s of a preset that does not exist', async (method, handler) => {
        const response = await handler(presetEvent(method, 'no-such-preset'));

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('not_found');
    });

    it('answers 404 to a preset that does not exist, instead of a 500 on the missing row', async () => {
        const response = await put('no-such-preset', preset);

        expect(response.status).toBe(404);
        expect(await db.select().from(labelPresets)).toEqual([]);
    });

    it('answers 404 to a preset that does not exist before it checks the body', async () => {
        for (const body of [{ ...preset, labelWidth: 1 }, { name: 42 }, 'not json']) {
            const response = await put('no-such-preset', body);

            expect(response.status).toBe(404);
            expect((await response.json()).error.code).toBe('not_found');
        }
    });

    // The barcode page disables saving the presets that the server refuses. The fields as the
    // form holds them: an emptied number field holds null, a text that is not a number its text.
    it.each<[string, Partial<LabelLayout>]>([
        ['the default form', {}],
        ['labels too narrow for the bars', { labelWidth: 50 }],
        ['a large barcode label', { labelWidth: 90 }],
        ['labels larger than the page', { labelWidth: 300 }],
        [
            'a QR code too small under its value',
            { codeType: 'qrcode', labelWidth: 18, labelHeight: 18 }
        ],
        ['a square QR code label', { codeType: 'qrcode', labelWidth: 30 }],
        ['an emptied width', { labelWidth: null as unknown as number }],
        [
            'a padding that is not a number',
            { labelWidth: 90, labelPadding: '1e' as unknown as number }
        ]
    ])('agree with the barcode page on %s, whatever the range of codes', async (_, layout) => {
        const options = new LabelOptions(() => 'CV');
        Object.assign(options.layout, layout);
        options.count = null as unknown as number;
        const { id } = await (await post(preset)).json();
        const body = (name: string) => ({ ...options.layout, name, description: '' });

        for (const response of [await post(body('Saved')), await put(id, body('Updated'))]) {
            expect(response.ok).toBe(options.layoutPrintable);
        }
    });
});
