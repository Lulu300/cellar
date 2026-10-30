import { m } from '#lib/paraglide/messages.js';
import type { ReferenceRow, ReferenceSlug } from '#lib/shared/reference-tables.js';

interface EntityLabels {
    /** The list's title, in the plural. */
    title: string;
    add: string;
    edit: string;
    name: string;
    namePlaceholder: string;
    search: string;
    added: string;
    updated: string;
    deleted: string;
    /** The error of a POST whose name exists already: the API then answers that entry. */
    duplicate: string;
    confirmDelete: (name: string) => string;
    /** The field of the parent, for an entity that has one. */
    parent?: { label: string; placeholder: string };
}

export interface ReferenceEntity {
    /** The table's name in `/api/<table>` and in `/admin/data/<table>`. */
    slug: ReferenceSlug;
    /** The field holding the id of the parent row, chosen in the form among `parents`. */
    parent?: 'countryId' | 'regionId';
    /**
     * Its texts in the current language. Read once by a page: the language only changes on the
     * preferences page, which the admin is left for.
     */
    labels: () => EntityLabels;
}

/** The reference tables the admin edits, all served by `/api/<table>`. */
export const REFERENCE_ENTITIES: Record<ReferenceSlug, ReferenceEntity> = {
    countries: {
        slug: 'countries',
        labels: () => ({
            title: m['admin.countries'](),
            add: m['admin.add_country'](),
            edit: m['admin.edit_country'](),
            name: m['admin.country_name'](),
            namePlaceholder: m['placeholders.country_example'](),
            search: m['placeholders.search_countries'](),
            added: m['toast.country_added'](),
            updated: m['toast.country_updated'](),
            deleted: m['toast.country_deleted'](),
            duplicate: m['errors.duplicate_name'](),
            confirmDelete: (name) => m['admin.confirm_delete_country']({ name })
        })
    },
    regions: {
        slug: 'regions',
        parent: 'countryId',
        labels: () => ({
            title: m['admin.regions'](),
            add: m['admin.add_region'](),
            edit: m['admin.edit_region'](),
            name: m['admin.region_name'](),
            namePlaceholder: m['placeholders.region_example'](),
            search: m['placeholders.search_regions'](),
            added: m['toast.region_added'](),
            updated: m['toast.region_updated'](),
            deleted: m['toast.region_deleted'](),
            duplicate: m['errors.duplicate_region'](),
            confirmDelete: (name) => m['admin.confirm_delete_region']({ name }),
            parent: { label: m['common.country'](), placeholder: m['admin.select_country']() }
        })
    },
    appellations: {
        slug: 'appellations',
        parent: 'regionId',
        labels: () => ({
            title: m['admin.appellations'](),
            add: m['admin.add_appellation'](),
            edit: m['admin.edit_appellation'](),
            name: m['admin.appellation_name'](),
            namePlaceholder: m['placeholders.appellation_example'](),
            search: m['placeholders.search_appellations'](),
            added: m['toast.appellation_added'](),
            updated: m['toast.appellation_updated'](),
            deleted: m['toast.appellation_deleted'](),
            duplicate: m['errors.duplicate_appellation'](),
            confirmDelete: (name) => m['admin.confirm_delete_appellation']({ name }),
            parent: { label: m['common.region'](), placeholder: m['admin.select_region']() }
        })
    },
    'wine-types': {
        slug: 'wine-types',
        labels: () => ({
            title: m['admin.wine_types'](),
            add: m['admin.add_wine_type'](),
            edit: m['admin.edit_wine_type'](),
            name: m['admin.type_name'](),
            namePlaceholder: m['placeholders.wine_type_example'](),
            search: m['placeholders.search_wine_types'](),
            added: m['toast.wine_type_added'](),
            updated: m['toast.wine_type_updated'](),
            deleted: m['toast.wine_type_deleted'](),
            duplicate: m['errors.duplicate_name'](),
            confirmDelete: (name) => m['admin.confirm_delete_wine_type']({ name })
        })
    },
    'wine-colors': {
        slug: 'wine-colors',
        labels: () => ({
            title: m['admin.wine_colors'](),
            add: m['admin.add_wine_color'](),
            edit: m['admin.edit_wine_color'](),
            name: m['admin.color_name'](),
            namePlaceholder: m['placeholders.wine_color_example'](),
            search: m['placeholders.search_wine_colors'](),
            added: m['toast.wine_color_added'](),
            updated: m['toast.wine_color_updated'](),
            deleted: m['toast.wine_color_deleted'](),
            duplicate: m['errors.duplicate_name'](),
            confirmDelete: (name) => m['admin.confirm_delete_wine_color']({ name })
        })
    },
    'wine-classifications': {
        slug: 'wine-classifications',
        labels: () => ({
            title: m['admin.wine_classifications'](),
            add: m['admin.add_wine_classification'](),
            edit: m['admin.edit_wine_classification'](),
            name: m['admin.classification_name'](),
            namePlaceholder: m['placeholders.classification_example'](),
            search: m['placeholders.search_classifications'](),
            added: m['toast.wine_classification_added'](),
            updated: m['toast.wine_classification_updated'](),
            deleted: m['toast.wine_classification_deleted'](),
            duplicate: m['errors.duplicate_name'](),
            confirmDelete: (name) => m['admin.confirm_delete_wine_classification']({ name })
        })
    },
    'wine-formats': {
        slug: 'wine-formats',
        labels: () => ({
            title: m['admin.bottle_formats'](),
            add: m['admin.add_bottle_format'](),
            edit: m['admin.edit_bottle_format'](),
            name: m['admin.format_name'](),
            namePlaceholder: m['placeholders.bottle_format_example'](),
            search: m['placeholders.search_formats'](),
            added: m['toast.wine_format_added'](),
            updated: m['toast.wine_format_updated'](),
            deleted: m['toast.bottle_format_deleted'](),
            duplicate: m['errors.duplicate_name'](),
            confirmDelete: (name) => m['admin.confirm_delete_bottle_format']({ name })
        })
    },
    origins: {
        slug: 'origins',
        labels: () => ({
            title: m['admin.origins'](),
            add: m['admin.add_origin'](),
            edit: m['admin.edit_origin'](),
            name: m['admin.origin_name'](),
            namePlaceholder: m['placeholders.origin_example'](),
            search: m['placeholders.search_origins'](),
            added: m['toast.origin_added'](),
            updated: m['toast.origin_updated'](),
            deleted: m['toast.origin_deleted'](),
            duplicate: m['errors.duplicate_name'](),
            confirmDelete: (name) => m['admin.confirm_delete_origin']({ name })
        })
    }
};

/** The second line of an entry: where it is. */
export const referenceDetail = (row: ReferenceRow) =>
    [row.regionName, row.countryName].filter(Boolean).join(', ');

/** Whether the entry's name, or the name of its region or country, holds `query` (lower case). */
export const matchesReference = (row: ReferenceRow, query: string) =>
    [row.name, row.regionName, row.countryName].some((text) => text?.toLowerCase().includes(query));
