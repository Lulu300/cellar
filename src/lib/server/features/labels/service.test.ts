import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db/index.js';
import { labelPresets } from '#lib/server/db/schema.js';
import { labelPresetSchema } from '#lib/shared/schemas/label.js';
import { createLabelPreset, deleteLabelPreset, updateLabelPreset } from './service';

const preset = (name: string) =>
    labelPresetSchema.parse({
        name,
        pageFormat: 'A4',
        labelWidth: 60,
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
    });

beforeEach(() => {
    db.delete(labelPresets).run();
});

describe('label presets', () => {
    it('keep the padding in the column that labelPadding replaced', () => {
        expect(createLabelPreset(preset('Shelf'))).toMatchObject({ padding: 2, labelPadding: 2 });
    });

    it('answer 404 for a preset that does not exist', () => {
        const notFound = expect.objectContaining({ status: 404 });
        expect(() => updateLabelPreset('nowhere', preset('Ghost'))).toThrow(notFound);
        expect(() => deleteLabelPreset('nowhere')).toThrow(notFound);
    });
});
