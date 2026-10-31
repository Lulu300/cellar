<script lang="ts">
    import { RotateCcw, RotateCw } from '@lucide/svelte';
    import { m } from '#lib/paraglide/messages.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '#lib/components/ui/dialog/index.js';
    import { toasts } from '#lib/stores/toast.svelte.js';
    import {
        drawPhoto,
        FULL_CROP,
        moveCrop,
        photoFile,
        readPhoto,
        resizeCrop,
        turnCrop,
        type Corner,
        type Crop,
        type Turns
    } from './photo-edit.js';

    /**
     * Shows the photo of `file`, to turn and crop it, then gives the photo to send: shrunk, the
     * right way up and without its metadata. Open while `file` is set.
     */
    let {
        file,
        onDone,
        onCancel
    }: {
        file: File | null;
        onDone: (photo: File) => void;
        onCancel: () => void;
    } = $props();

    // The preview is drawn smaller than the photo sent: enough for any screen, quick to redraw.
    const PREVIEW_MAX_SIDE = 1024;
    // How far an arrow key moves or resizes the frame, in fractions of the photo.
    const KEY_STEP = 0.02;
    const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];

    let image = $state.raw<ImageBitmap | null>(null);
    let turns = $state<Turns>(0);
    let crop = $state.raw<Crop>(FULL_CROP);
    let saving = $state(false);
    let canvas = $state<HTMLCanvasElement>();
    let frame = $state<HTMLDivElement>();

    // Reads each file chosen; one the browser cannot decode, such as a HEIC photo outside Safari,
    // is refused here.
    $effect(() => {
        const chosen = file;
        if (!chosen) return;
        let current: ImageBitmap | null = null;
        let cancelled = false;
        [turns, crop] = [0, FULL_CROP];
        readPhoto(chosen).then(
            (read) => {
                if (cancelled) return read.close();
                image = current = read;
            },
            () => {
                if (cancelled) return;
                toasts.add(m['photos.unreadable'](), 'error');
                onCancel();
            }
        );
        return () => {
            cancelled = true;
            current?.close();
            image = null;
        };
    });

    $effect(() => {
        if (canvas && image) drawPhoto(canvas, image, turns, FULL_CROP, PREVIEW_MAX_SIDE);
    });

    function turn(quarters: 1 | 3) {
        turns = ((turns + quarters) % 4) as Turns;
        for (let i = 0; i < quarters; i++) crop = turnCrop(crop);
    }

    /** Follows a drag of the frame, which moves it, or of one of its corners, from `event` on. */
    function drag(event: PointerEvent) {
        if (!frame) return;
        event.preventDefault();
        const corner = (event.target as HTMLElement).closest<HTMLElement>('[data-corner]')?.dataset
            .corner as Corner | undefined;
        const target = event.currentTarget as HTMLElement;
        target.focus();
        target.setPointerCapture(event.pointerId);
        const start = { x: event.clientX, y: event.clientY, crop };
        const { width, height } = frame.getBoundingClientRect();
        const onMove = (move: PointerEvent) => {
            const dx = (move.clientX - start.x) / width;
            const dy = (move.clientY - start.y) / height;
            crop = corner ? resizeCrop(start.crop, corner, dx, dy) : moveCrop(start.crop, dx, dy);
        };
        const onEnd = () => {
            target.removeEventListener('pointermove', onMove);
            target.removeEventListener('pointerup', onEnd);
            target.removeEventListener('pointercancel', onEnd);
        };
        target.addEventListener('pointermove', onMove);
        target.addEventListener('pointerup', onEnd);
        target.addEventListener('pointercancel', onEnd);
    }

    const ARROWS: Record<string, [number, number]> = {
        ArrowLeft: [-KEY_STEP, 0],
        ArrowRight: [KEY_STEP, 0],
        ArrowUp: [0, -KEY_STEP],
        ArrowDown: [0, KEY_STEP]
    };

    /** The arrow keys move the frame; with Shift, they move its bottom right corner. */
    function keydown(event: KeyboardEvent) {
        const step = ARROWS[event.key];
        if (!step) return;
        event.preventDefault();
        crop = event.shiftKey ? resizeCrop(crop, 'se', ...step) : moveCrop(crop, ...step);
    }

    async function done() {
        const chosen = file;
        if (!image || !chosen) return;
        saving = true;
        try {
            const photo = await photoFile(image, turns, crop, chosen.name);
            // Cancelled while it was being prepared: not sent
            if (file === chosen) onDone(photo);
        } catch {
            toasts.add(m['photos.unreadable'](), 'error');
        } finally {
            saving = false;
        }
    }

    const percent = (fraction: number) => `${fraction * 100}%`;
</script>

<Dialog open={file !== null} onOpenChange={(open) => !open && onCancel()}>
    <DialogContent class="max-h-[95vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
            <DialogTitle>{m['photos.edit_title']()}</DialogTitle>
            <DialogDescription>{m['photos.edit_description']()}</DialogDescription>
        </DialogHeader>

        <div class="flex min-h-48 items-center justify-center rounded-md bg-muted p-2">
            {#if image}
                <!-- The frame is drawn over the preview, in fractions of it: the photo sent is
                     cropped the same way at its own size. -->
                <div bind:this={frame} class="relative touch-none select-none overflow-hidden">
                    <canvas
                        bind:this={canvas}
                        class="block h-auto max-h-[55vh] w-auto max-w-full"
                        aria-hidden="true"
                    ></canvas>
                    <button
                        type="button"
                        aria-label={m['photos.crop_frame']()}
                        class="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] outline-none focus-visible:border-primary"
                        style:left={percent(crop.x)}
                        style:top={percent(crop.y)}
                        style:width={percent(crop.width)}
                        style:height={percent(crop.height)}
                        onpointerdown={drag}
                        onkeydown={keydown}
                    >
                        {#each CORNERS as corner (corner)}
                            <!-- A 24 px target for a finger, inside the frame: the preview
                                 clips what goes past its edges, where a whole photo puts them. -->
                            <span
                                class="absolute flex size-6 {corner.includes('w')
                                    ? 'left-0 justify-start'
                                    : 'right-0 justify-end'} {corner.includes('n')
                                    ? 'top-0 items-start'
                                    : 'bottom-0 items-end'} {corner === 'nw' || corner === 'se'
                                    ? 'cursor-nwse-resize'
                                    : 'cursor-nesw-resize'}"
                                data-corner={corner}
                            >
                                <span class="size-3 border-2 border-black/40 bg-white"></span>
                            </span>
                        {/each}
                    </button>
                </div>
            {:else}
                <p class="text-sm text-muted-foreground">{m['photos.reading']()}</p>
            {/if}
        </div>

        <div class="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!image} onclick={() => turn(3)}>
                <RotateCcw class="mr-2 h-4 w-4" />
                {m['photos.rotate_left']()}
            </Button>
            <Button type="button" variant="outline" disabled={!image} onclick={() => turn(1)}>
                <RotateCw class="mr-2 h-4 w-4" />
                {m['photos.rotate_right']()}
            </Button>
            <Button
                type="button"
                variant="outline"
                disabled={!image}
                onclick={() => (crop = FULL_CROP)}
            >
                {m['photos.whole_photo']()}
            </Button>
        </div>

        <DialogFooter class="gap-2">
            <Button type="button" variant="outline" onclick={onCancel}>
                {m['common.cancel']()}
            </Button>
            <Button type="button" disabled={!image || saving} onclick={done}>
                {saving ? m['photos.preparing']() : m['photos.use']()}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
