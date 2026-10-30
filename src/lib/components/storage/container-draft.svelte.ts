import { m } from '#lib/paraglide/messages.js';
import { issueErrors, type FieldErrors } from '#lib/components/forms/field-errors.js';
import type { ApiErrorBody, ApiErrorIssue } from '#lib/shared/api-error.js';
import type { StorageContainerDTO } from '#lib/shared/dto.js';
import {
    caseCapacitySchema,
    containerSchema,
    DEFAULT_CASE_CAPACITY,
    newContainerSchema
} from '#lib/shared/schemas/storage.js';
import { containerLabel } from '#lib/shared/storage.js';
import { apiErrorCode, apiErrorMessage } from '#lib/utils/api-error.js';
import { formatNumber } from '#lib/utils/format.js';
import { caseSuffix } from './storage.js';

interface DraftCase {
    /** Null for a case to create. */
    id: string | null;
    suffix: string;
    /** As its field reads it: null when emptied, the text when it is not a number. */
    capacity: number | string | null;
}

/**
 * Whether a case may hold `capacity` bottles. The API reads a missing capacity as the default, for
 * scripts; the dialog asks for one rather than save a capacity the user did not choose.
 */
export const isValidCapacity = (capacity: DraftCase['capacity']) =>
    caseCapacitySchema.safeParse(capacity).success;

/** The key of the errors of the case at `index`, in ContainerDraft.errors. */
export const caseKey = (index: number) => `case.${index}`;

/** The field that a path of the body names: the name, or a case by its suffix or capacity. */
function fieldKey(path: PropertyKey[]): string {
    const [field, index] = path;
    return typeof index === 'number' && (field === 'cases' || field === 'caseCapacities')
        ? caseKey(index)
        : String(field);
}

/** The cases of a new container, as the dialog proposes them at first. */
const NEW_CONTAINER_CASES = 10;

/** A new container has 1 to 50 cases. */
export const MAX_NEW_CASES = 50;

/**
 * A container being created or edited in the container dialog. Nothing reaches the server before
 * `body()` is sent: cancelling the dialog drops the draft.
 */
export class ContainerDraft {
    name = $state('');
    cases = $state<DraftCase[]>([]);
    /** The message under each field that a check refused: `name`, or caseKey(index) for a case. */
    errors = $state<FieldErrors>({});

    private constructor(
        /** Null for a container to create. */
        readonly container: StorageContainerDTO | null,
        name: string,
        cases: DraftCase[]
    ) {
        this.name = name;
        this.cases = cases;
    }

    static create(): ContainerDraft {
        const draft = new ContainerDraft(null, '', []);
        draft.count = NEW_CONTAINER_CASES;
        return draft;
    }

    /** A draft of `container`; one without a case gets one to add, which the user may remove. */
    static edit(container: StorageContainerDTO): ContainerDraft {
        const draft = new ContainerDraft(
            container,
            containerLabel(container.name),
            container.cases.map(({ id, name, capacity }) => ({
                id,
                suffix: caseSuffix(name, container.name),
                capacity
            }))
        );
        if (draft.count === 0) draft.add();
        return draft;
    }

    /** The number of cases. A larger one adds cases after the last, a smaller one drops the last. */
    get count(): number {
        return this.cases.length;
    }

    set count(count: number) {
        const target = Math.max(1, Math.min(MAX_NEW_CASES, Math.trunc(count) || 1));
        // The errors of the cases dropped would show again on the cases added in their place.
        if (target < this.cases.length) this.errors = {};
        this.cases = this.cases.slice(0, target);
        while (this.cases.length < target) this.add();
    }

    /** Adds a case after the last, numbered after the highest number of the others. */
    add() {
        const numbers = this.cases.map(({ suffix }) => Number(suffix)).filter(Number.isInteger);
        const next = Math.max(0, ...numbers) + 1;
        this.cases.push({ id: null, suffix: String(next), capacity: DEFAULT_CASE_CAPACITY });
    }

    remove(index: number) {
        this.cases.splice(index, 1);
        // The errors of the cases are kept by index, which the removal shifts.
        this.errors = {};
    }

    /**
     * The body of POST /api/storage-containers, or of PUT /api/storage-containers/{id}: with the
     * time of the container it was made from, so that the server refuses it once another draft
     * changed the container.
     */
    body() {
        return {
            name: this.name.trim(),
            cases: this.cases.map(({ suffix }) => suffix),
            caseCapacities: this.cases.map(({ capacity }) => capacity),
            ...(this.container && {
                caseIds: this.cases.map(({ id }) => id),
                updatedAt: this.container.updatedAt.toISOString()
            })
        };
    }

    /** Whether an error shows under a field of the dialog: the name, or a case. */
    get showsErrors(): boolean {
        return Object.keys(this.errors).some((key) => key === 'name' || key.startsWith('case.'));
    }

    /**
     * Checks the draft with the rules of the server, and asks for every capacity, which the API
     * reads as the default when missing. Keeps each refusal for its field; true when none.
     */
    check(): boolean {
        const schema = this.container ? containerSchema : newContainerSchema;
        const checked = schema.safeParse(this.body());
        const errors = checked.success ? {} : issueErrors(checked.error.issues, schema, fieldKey);
        const capacityError = m['storage.capacity_between']({
            min: formatNumber(Number(caseCapacitySchema.minValue)),
            max: formatNumber(Number(caseCapacitySchema.maxValue))
        });
        this.cases.forEach(({ capacity }, index) => {
            if (!isValidCapacity(capacity)) errors[caseKey(index)] ??= capacityError;
        });
        this.errors = errors;
        return Object.keys(errors).length === 0;
    }

    /**
     * Shows a refusal of the server under the fields it is about: the name, or cases. False when
     * it is about none, such as a container changed elsewhere.
     */
    showRefusal(body: unknown): boolean {
        this.errors = this.refusalErrors(body);
        return this.showsErrors;
    }

    private refusalErrors(body: unknown): FieldErrors {
        const code = apiErrorCode(body);
        const details = (body as Partial<ApiErrorBody> | null)?.error?.details;
        if (code === 'invalid_body' && Array.isArray(details)) {
            // The issues of the server are in English: each field gets the general message.
            const pathOf = (path: string) =>
                path.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part));
            return Object.fromEntries(
                (details as ApiErrorIssue[]).map(({ path }) => [
                    fieldKey(pathOf(path)),
                    m['form_errors.invalid']()
                ])
            );
        }
        const { position, caseName } = (details ?? {}) as Record<string, unknown>;
        const message = apiErrorMessage(body);
        const onCase = (index: number) => (index >= 0 ? { [caseKey(index)]: message } : {});
        switch (code) {
            case 'duplicate_container':
                return { name: message };
            case 'duplicate_case':
                return onCase(Number(position));
            case 'case_full':
                // The server names the case as it saves it: the name, then the suffix.
                return onCase(
                    this.cases.findIndex(
                        ({ suffix }) => `${this.name.trim()}${suffix.trimEnd()}` === caseName
                    )
                );
            default:
                return {};
        }
    }

    /** Forgets the error of a field once the user changes it. */
    forget(key: string) {
        delete this.errors[key];
    }
}
