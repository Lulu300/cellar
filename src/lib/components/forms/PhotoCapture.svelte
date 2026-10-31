<script lang="ts">
    import { Camera, ImageUp } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import PhotoEditDialog from './PhotoEditDialog.svelte';

    /**
     * « Take a photo » (on a touch screen) and « Choose a file », then the preview that turns and
     * crops it: `onPhoto` gets the photo ready to send, shrunk, the right way up and without its
     * metadata. The wine form and the wine page share it.
     */
    let { onPhoto, disabled = false }: { onPhoto: (photo: File) => void; disabled?: boolean } =
        $props();

    let cameraInput = $state<HTMLInputElement>();
    let fileInput = $state<HTMLInputElement>();
    let chosen = $state<File | null>(null);

    function choose(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        chosen = input.files?.[0] ?? null;
        // Emptied, so that choosing the same file again opens the preview again
        input.value = '';
    }

    function done(photo: File) {
        chosen = null;
        onPhoto(photo);
    }
</script>

<!-- capture opens the camera of a phone; it needs no HTTPS, unlike a camera in the page. -->
<input
    bind:this={cameraInput}
    type="file"
    accept="image/*"
    capture="environment"
    class="hidden"
    onchange={choose}
/>
<!-- Any image the browser can read: it is sent as JPEG. -->
<input bind:this={fileInput} type="file" accept="image/*" class="hidden" onchange={choose} />
<!-- Shown where a finger points: a computer would open the same file chooser twice. -->
<Button
    type="button"
    variant="outline"
    class="pointer-fine:hidden"
    {disabled}
    onclick={() => cameraInput?.click()}
>
    <Camera class="mr-2 h-4 w-4" />
    {m['photos.take']()}
</Button>
<Button type="button" variant="outline" {disabled} onclick={() => fileInput?.click()}>
    <ImageUp class="mr-2 h-4 w-4" />
    {m['photos.choose_file']()}
</Button>

<PhotoEditDialog file={chosen} onDone={done} onCancel={() => (chosen = null)} />
