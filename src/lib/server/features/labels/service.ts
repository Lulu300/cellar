import type { LabelPreset } from '#lib/server/db/schema.js';
import { NotFoundError, ValidationError } from '#lib/server/http/errors.js';
import { blockingIssues } from '#lib/shared/labels.js';
import type { LabelLayout, LabelPresetInput } from '#lib/shared/schemas/label.js';
import {
    deletePreset,
    getPreset,
    insertPreset,
    listPresets,
    updatePreset,
    type PresetLayout
} from './repository';

export { listPresets };

const notFound = () => new NotFoundError('Label preset not found');

/**
 * Throws the ValidationError of the first issue that prevents printing `layout`, the one the
 * barcode page shows before it lets the user ask for the PDF.
 */
export function assertPrintable(layout: LabelLayout) {
    const blocking = blockingIssues(layout);
    if (blocking.length === 0) return;
    if (blocking[0].code === 'labels_do_not_fit') {
        throw new ValidationError(
            'labels_do_not_fit',
            'Label dimensions are too large for the selected page format with current spacing'
        );
    }
    throw new ValidationError(
        'label_too_small',
        `The labels are too small for their code: ${blocking.map((issue) => issue.code).join(', ')}`,
        { issues: blocking }
    );
}

/**
 * The row of a preset, from the fields that the API reads. Throws the ValidationError of the PDF
 * for labels that it would refuse to print: a preset must print as it is saved.
 */
function presetRow(preset: LabelPresetInput): PresetLayout {
    assertPrintable(preset);
    // The column that labelPadding replaced, still NOT NULL
    return { ...preset, padding: preset.labelPadding };
}

export function getLabelPreset(id: string): LabelPreset {
    const preset = getPreset(id);
    if (!preset) throw notFound();
    return preset;
}

/**
 * Throws a ConflictError (duplicate_name) for a name that another preset has, and a
 * ValidationError for labels that the PDF would refuse.
 */
export function createLabelPreset(preset: LabelPresetInput): LabelPreset {
    return insertPreset(presetRow(preset));
}

/**
 * Replaces every field; throws a ConflictError (duplicate_name) for a name that another has, and a
 * ValidationError for labels that the PDF would refuse.
 */
export function updateLabelPreset(id: string, preset: LabelPresetInput): LabelPreset {
    const updated = updatePreset(id, presetRow(preset));
    if (!updated) throw notFound();
    return updated;
}

export function deleteLabelPreset(id: string): void {
    if (!deletePreset(id)) throw notFound();
}
