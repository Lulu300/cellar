<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import ScrollRegion from '#lib/components/admin/ScrollRegion.svelte';
    import { FileArchive, CircleAlert } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';

    let {
        open = $bindable(false),
        onProceedWithImport = () => {}
    }: {
        open: boolean;
        onProceedWithImport: () => void;
    } = $props();

    function closeDialog() {
        open = false;
    }

    function proceedWithZipImport() {
        open = false;
        onProceedWithImport();
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader class="flex-shrink-0">
            <DialogTitle class="flex items-center gap-2">
                <FileArchive class="h-5 w-5 text-primary" />
                {m['admin.import_images_from_zip']()}
            </DialogTitle>
        </DialogHeader>

        <ScrollRegion label={m['admin.import_images_from_zip']()} class="space-y-4 flex-1">
            <div class="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <h4 class="font-semibold text-foreground mb-2">
                    {m['admin.what_does_this_feature_do']()}
                </h4>
                <p class="text-sm text-foreground">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files, no user data -->
                    {@html m['admin.zip_import_feature_description']({
                        strong: '<strong>',
                        strongEnd: '</strong>',
                        imageName: '<code>imageName</code>'
                    })}
                </p>
            </div>

            <div class="space-y-3">
                <h4 class="font-semibold">{m['admin.how_it_works']()}</h4>
                <ol class="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>{m['admin.zip_import_step_1']()}</li>
                    <li>{m['admin.zip_import_step_2']()}</li>
                    <li>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files, no user data -->
                        {@html m['admin.zip_import_step_3']({
                            strong: '<strong>',
                            strongEnd: '</strong>'
                        })}
                    </li>
                    <li>{m['admin.zip_import_step_4']()}</li>
                    <li>{m['admin.zip_import_step_5']()}</li>
                </ol>
            </div>

            <div class="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <div class="flex items-start gap-2">
                    <CircleAlert class="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <div class="text-sm">
                        <p class="font-medium text-warning">{m['admin.important']()}</p>
                        <p class="text-foreground">
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files, no user data -->
                            {@html m['admin.zip_import_filename_warning']({
                                imageName: '<code>imageName</code>'
                            })}
                        </p>
                    </div>
                </div>
            </div>

            <div class="text-xs text-muted-foreground">
                <p>
                    <strong>{m['admin.supported_formats']()}</strong>
                    {m['admin.supported_formats_list']()}
                </p>
                <p>
                    <strong>{m['admin.use_case']()}</strong>
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -- markup from our own locale files, no user data -->
                    {@html m['admin.zip_import_use_case']({ imageName: '<code>imageName</code>' })}
                </p>
            </div>
        </ScrollRegion>

        <div class="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
            <Button variant="outline" onclick={closeDialog}>{m['common.cancel']()}</Button>
            <Button onclick={proceedWithZipImport} class="bg-primary">
                <FileArchive class="h-4 w-4 mr-2" />
                {m['admin.choose_zip_file']()}
            </Button>
        </div>
    </DialogContent>
</Dialog>
