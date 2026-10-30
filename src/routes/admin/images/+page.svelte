<script lang="ts">
    import { pageTitle } from '#lib/components/layout/navigation.js';
    import { invalidateAll } from '$app/navigation';
    import {
        Archive,
        Download,
        FileArchive,
        Image,
        LoaderCircle,
        RefreshCw,
        Square,
        SquareCheckBig,
        SquarePen,
        Trash,
        Upload
    } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Badge } from '#lib/components/ui/badge/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import SearchField from '#lib/components/admin/SearchField.svelte';
    import ImageDeleteDialog from '#lib/components/admin/dialogs/ImageDeleteDialog.svelte';
    import ImageRenameDialog from '#lib/components/admin/dialogs/ImageRenameDialog.svelte';
    import ZipImportInfoDialog from '#lib/components/admin/dialogs/ZipImportInfoDialog.svelte';
    import ZipImportResultsDialog from '#lib/components/admin/dialogs/ZipImportResultsDialog.svelte';
    import { ImageSelection } from '#lib/components/admin/image-selection.svelte.js';
    import { Jobs } from '#lib/components/admin/jobs.svelte.js';
    import { downloadBlob, errorMessage, request } from '#lib/api/client.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import { formatDateTime, formatFileSize, today } from '#lib/utils/format.js';
    import type { AdminImageDTO, UploadedImagesDTO, ZipImportDTO } from '#lib/shared/dto.js';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    const selection = new ImageSelection(() => data.images);
    const jobs = new Jobs<'upload' | 'export' | 'download' | 'zip' | 'refresh'>();

    let uploadInput = $state<HTMLInputElement>();
    let zipInput = $state<HTMLInputElement>();
    let showZipInfo = $state(false);
    let zipResults = $state<ZipImportDTO | null>(null);
    let showZipResults = $state(false);
    let renaming = $state<AdminImageDTO | null>(null);
    let showRename = $state(false);
    let toDelete = $state<string[]>([]);
    let showDelete = $state(false);

    /** Makes the browser save the images as one zip. */
    function saveZip(imageIds: string[], fallbackName: string) {
        return downloadBlob('/api/admin/download-images', fallbackName, {
            method: 'POST',
            json: { imageIds }
        });
    }

    const downloadSelected = () =>
        jobs.run('download', async () => {
            const count = selection.ids.length;
            try {
                const filename = await saveZip(selection.ids, `wine-images-${today()}.zip`);
                toasts.add(m['toast.downloaded_images']({ count, filename }), 'success');
            } catch (error) {
                const message = errorMessage(error);
                toasts.add(m['toast.failed_to_download_images']({ error: message }));
            }
        });

    // Exports the images in view, which the search may narrow.
    const exportVisible = () =>
        jobs.run('export', async () => {
            const imageIds = selection.visible.map((image) => image.id);
            try {
                const filename = await saveZip(imageIds, `all-wine-images-${today()}.zip`);
                toasts.add(
                    m['toast.exported_images']({ count: imageIds.length, filename }),
                    'success'
                );
            } catch (error) {
                const message = errorMessage(error);
                toasts.add(m['toast.failed_to_export_images']({ error: message }));
            }
        });

    function upload(input: HTMLInputElement) {
        const files = Array.from(input.files ?? []);
        input.value = '';
        const images = files.filter((file) => file.type.startsWith('image/'));
        if (images.length < files.length) {
            toasts.add(
                m['toast.invalid_files_skipped']({ count: files.length - images.length }),
                'warning'
            );
        }
        if (images.length === 0) return;

        return jobs.run('upload', async () => {
            const form = new FormData();
            for (const image of images) form.append('images', image);
            try {
                const result = await request<UploadedImagesDTO>('/api/admin/upload-image', {
                    method: 'POST',
                    body: form
                });
                if (result.successful.length > 0) {
                    toasts.add(
                        m['toast.uploaded_images_success']({ count: result.successful.length }),
                        'success'
                    );
                }
                if (result.failed.length > 0) {
                    toasts.add(
                        m['toast.failed_to_upload_images']({ count: result.failed.length }),
                        'warning'
                    );
                }
                await invalidateAll();
            } catch (error) {
                toasts.add(m['toast.upload_failed']({ error: errorMessage(error) }));
            }
        });
    }

    function importZip(input: HTMLInputElement) {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.zip')) {
            toasts.add(m['toast.please_select_zip']());
            return;
        }

        return jobs.run('zip', async () => {
            const form = new FormData();
            form.append('zipFile', file);
            try {
                zipResults = await request<ZipImportDTO>('/api/admin/import-images-zip', {
                    method: 'POST',
                    body: form
                });
                showZipResults = true;
                await invalidateAll();
            } catch (error) {
                toasts.add(m['toast.zip_import_failed']({ error: errorMessage(error) }));
            }
        });
    }

    function startRename(image: AdminImageDTO) {
        renaming = image;
        showRename = true;
    }

    function startDelete(imageIds: string[]) {
        toDelete = imageIds;
        showDelete = true;
    }
</script>

<svelte:head>
    <title>{pageTitle(m['admin.images'](), m['admin.title']())}</title>
</svelte:head>

<section class="space-y-4 rounded-lg border p-4">
    <h2 class="text-lg font-semibold">{m['admin.wine_images']()}</h2>

    <SearchField
        value={selection.query}
        placeholder={m['admin.search_images']()}
        onSearch={(query) => selection.search(query)}
    />

    <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                onclick={() => selection.toggleAll()}
                disabled={selection.visible.length === 0}
            >
                {#if selection.allSelected}
                    <Square class="h-4 w-4 mr-1" />
                    {m['admin.select_none']()}
                {:else}
                    <SquareCheckBig class="h-4 w-4 mr-1" />
                    {m['common.select_all']()}
                {/if}
            </Button>
            {#if selection.ids.length > 0}
                <Badge variant="secondary"
                    >{m['common.selected_count']({ count: selection.ids.length })}</Badge
                >
                <Button size="sm" onclick={downloadSelected} disabled={jobs.running !== null}>
                    {#if jobs.running === 'download'}
                        <LoaderCircle class="h-4 w-4 mr-1 animate-spin" />
                    {:else}
                        <Download class="h-4 w-4 mr-1" />
                    {/if}
                    {m['admin.download_zip']()}
                </Button>
                <Button size="sm" variant="destructive" onclick={() => startDelete(selection.ids)}>
                    <Trash class="h-4 w-4 mr-1" />
                    {m['admin.delete_selected']()}
                </Button>
            {/if}
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                onclick={() => uploadInput?.click()}
                disabled={jobs.running !== null}
            >
                {#if jobs.running === 'upload'}
                    <LoaderCircle class="h-4 w-4 mr-1 animate-spin" />
                {:else}
                    <Upload class="h-4 w-4 mr-1" />
                {/if}
                {m['admin.upload_images']()}
            </Button>
            <input
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                bind:this={uploadInput}
                onchange={(event) => upload(event.currentTarget)}
            />
            <Button
                size="sm"
                variant="outline"
                onclick={exportVisible}
                disabled={jobs.running !== null || selection.visible.length === 0}
            >
                {#if jobs.running === 'export'}
                    <LoaderCircle class="h-4 w-4 mr-1 animate-spin" />
                {:else}
                    <Archive class="h-4 w-4 mr-1" />
                {/if}
                {m['admin.export_zip']()}
            </Button>
            <Button
                size="sm"
                variant="outline"
                onclick={() => (showZipInfo = true)}
                disabled={jobs.running !== null}
            >
                {#if jobs.running === 'zip'}
                    <LoaderCircle class="h-4 w-4 mr-1 animate-spin" />
                {:else}
                    <FileArchive class="h-4 w-4 mr-1" />
                {/if}
                {m['admin.import_zip']()}
            </Button>
            <input
                type="file"
                accept=".zip"
                class="hidden"
                bind:this={zipInput}
                onchange={(event) => importZip(event.currentTarget)}
            />
            <Button
                size="sm"
                variant="outline"
                onclick={() => jobs.run('refresh', invalidateAll)}
                disabled={jobs.running !== null}
            >
                <RefreshCw
                    class="h-4 w-4 mr-1 {jobs.running === 'refresh' ? 'animate-spin' : ''}"
                />
                {m['admin.refresh']()}
            </Button>
        </div>
    </div>

    {#if selection.visible.length === 0}
        <div class="py-8 text-center">
            <Image class="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p class="text-lg font-medium mb-2">{m['admin.no_wine_images_found']()}</p>
            <p class="text-muted-foreground">
                {selection.query
                    ? m['admin.no_images_match_search']()
                    : m['admin.upload_images_instruction']()}
            </p>
        </div>
    {:else}
        <ul class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {#each selection.visible as image (image.id)}
                {@const wineNames = image.wines.map((wine) => wine.name).join(', ')}
                <li
                    class="border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow"
                >
                    <div class="aspect-square bg-muted relative">
                        <img
                            src={image.url}
                            alt={image.filename}
                            class="w-full h-full object-cover"
                            loading="lazy"
                        />
                        <input
                            type="checkbox"
                            class="absolute top-2 left-2 w-4 h-4 rounded shadow"
                            aria-label={image.filename}
                            checked={selection.has(image.id)}
                            onchange={(event) =>
                                selection.toggle(image.id, event.currentTarget.checked)}
                        />
                    </div>
                    <div class="p-3">
                        <p class="text-sm font-medium truncate mb-1" title={image.filename}>
                            {image.filename}
                        </p>
                        <p class="text-xs truncate mb-1" title={wineNames}>
                            {wineNames || m['admin.image_unused']()}
                        </p>
                        <p class="text-xs text-muted-foreground mb-2">
                            {formatFileSize(image.size)} • {formatDateTime(image.lastModified)}
                        </p>
                        <div class="flex gap-1">
                            <Button
                                size="sm"
                                variant="outline"
                                class="flex-1 text-xs h-7"
                                onclick={() => startRename(image)}
                            >
                                <SquarePen class="h-3 w-3 mr-1" />
                                {m['admin.rename']()}
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                class="h-7 w-7 p-0"
                                aria-label={m['admin.delete_image']()}
                                onclick={() => startDelete([image.id])}
                            >
                                <Trash class="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<ImageRenameDialog bind:open={showRename} image={renaming} />
<ImageDeleteDialog bind:open={showDelete} imagesToDelete={toDelete} images={data.images} />
<ZipImportInfoDialog bind:open={showZipInfo} onProceedWithImport={() => zipInput?.click()} />
<ZipImportResultsDialog bind:open={showZipResults} bind:zipImportResults={zipResults} />
