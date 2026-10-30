<script lang="ts">
    import { untrack } from 'svelte';
    import type { BarcodeDetector } from 'barcode-detector/ponyfill';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogDescription
    } from '#lib/components/ui/dialog/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import OptionSelect from '#lib/components/forms/OptionSelect.svelte';
    import {
        createBarcodeDetector,
        readingArea,
        scannedValue
    } from '#lib/utils/barcode-scanner.js';
    import { m } from '#lib/paraglide/messages.js';
    import {
        cameraErrorMessage,
        cameraUnavailableMessage
    } from '#lib/components/barcode/camera-error.js';

    interface Props {
        open?: boolean;
        onScan: (value: string) => void;
        // Continuous mode keeps the camera running after each scan (bulk entry)
        continuous?: boolean;
    }

    let { open = $bindable(false), onScan, continuous = false }: Props = $props();

    const SCAN_INTERVAL_MS = 100;
    const DUPLICATE_SCAN_DELAY_MS = 2000;
    // A wide picture keeps a small barcode readable: each bar spans more pixels
    const VIDEO_SIZE = { width: { ideal: 1280 }, height: { ideal: 720 } };

    let video = $state<HTMLVideoElement>();
    let error = $state('');
    let isStarting = $state(false);
    let isScanning = $state(false);
    let cameras = $state<MediaDeviceInfo[]>([]);
    let selectedCameraId = $state('');
    // The reading area drawn over the video, in % of its size
    let frame = $state<{ left: number; top: number; width: number; height: number }>();

    // Continuous mode state
    let scanCount = $state(0);
    let lastScanned = $state('');
    let lastScannedAt = 0;

    // Only set once its camera is running, so stopping it always releases a camera
    let stream: MediaStream | null = null;
    // Bumped each time the dialog closes. A start-up still awaiting the camera when that happens
    // sees a newer generation and stops what it started, so the camera never stays on.
    let generation = 0;

    $effect(() => {
        // The video element mounts with the dialog content, after `open` turns true
        if (!open || !video) return;
        // Untracked: the start-up reads isStarting and isScanning, which must not restart this effect
        untrack(() => startScanner());
        return () => {
            generation++;
            stopScanner();
            resetState();
        };
    });

    async function startScanner(cameraId?: string) {
        if (isStarting || isScanning || !video) return;
        const element = video;
        const startedIn = generation;
        const cancelled = () => startedIn !== generation;

        isStarting = true;
        error = '';
        // Stopped in `finally` unless it is handed over to `stream`
        let started: MediaStream | null = null;
        try {
            const unavailable = cameraUnavailableMessage();
            if (unavailable) {
                error = unavailable;
                return;
            }
            const detector = await createBarcodeDetector();
            if (cancelled()) return;
            started = await navigator.mediaDevices.getUserMedia({
                video: cameraId
                    ? { deviceId: { exact: cameraId }, ...VIDEO_SIZE }
                    : { facingMode: 'environment', ...VIDEO_SIZE },
                audio: false
            });
            if (cancelled()) return;
            // Device labels are only known once the camera is allowed
            const devices = await navigator.mediaDevices.enumerateDevices();
            if (cancelled()) return;
            cameras = devices.filter((device) => device.kind === 'videoinput');
            selectedCameraId = started.getVideoTracks()[0]?.getSettings().deviceId ?? '';

            element.srcObject = started;
            await element.play();
            if (cancelled()) return;
            stream = started;
            started = null;
            isScanning = true;
            scan(detector, element, stream);
        } catch (err) {
            if (cancelled()) return;
            error = cameraErrorMessage(err);
        } finally {
            if (started) stopTracks(started);
            // A newer generation owns this state now
            if (!cancelled()) isStarting = false;
        }
    }

    /** Reads the reading area of each frame until `source` stops being the running stream. */
    async function scan(detector: BarcodeDetector, element: HTMLVideoElement, source: MediaStream) {
        const canvas = document.createElement('canvas');
        try {
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) throw new Error('No 2D canvas context');
            while (stream === source) {
                // An unplugged camera ends its track without any error: the picture just stops.
                if (!source.active) {
                    error = m['scanner.camera_lost']();
                    stopScanner();
                    return;
                }
                const area = readingArea(element.videoWidth, element.videoHeight);
                // Resizing a canvas reallocates it: only when the camera's picture changed size
                if (canvas.width !== area.width || canvas.height !== area.height) {
                    canvas.width = area.width;
                    canvas.height = area.height;
                }
                context.drawImage(
                    element,
                    area.x,
                    area.y,
                    area.width,
                    area.height,
                    0,
                    0,
                    area.width,
                    area.height
                );
                const [code] = await detector.detect(canvas);
                if (stream !== source) return;
                if (code) handleScanSuccess(scannedValue(code));
                await new Promise((resolve) => setTimeout(resolve, SCAN_INTERVAL_MS));
            }
        } catch {
            if (stream !== source) return;
            error = m['scanner.error_reading']();
            stopScanner();
        }
    }

    /** Places the reading area over the video, whose size is known once it plays. */
    function placeFrame() {
        if (!video?.videoWidth) return;
        const { videoWidth: width, videoHeight: height } = video;
        const area = readingArea(width, height);
        frame = {
            left: (100 * area.x) / width,
            top: (100 * area.y) / height,
            width: (100 * area.width) / width,
            height: (100 * area.height) / height
        };
    }

    function handleScanSuccess(decodedText: string) {
        if (!continuous) {
            open = false;
            onScan(decodedText);
            return;
        }

        // The camera keeps seeing the same code for a while: ignore repeats
        const now = Date.now();
        if (decodedText === lastScanned && now - lastScannedAt < DUPLICATE_SCAN_DELAY_MS) {
            lastScannedAt = now;
            return;
        }
        lastScanned = decodedText;
        lastScannedAt = now;
        scanCount += 1;
        navigator.vibrate?.(100);
        onScan(decodedText);
    }

    function stopScanner() {
        const current = stream;
        stream = null;
        isScanning = false;
        if (current) stopTracks(current);
        if (video) video.srcObject = null;
    }

    function stopTracks(source: MediaStream) {
        for (const track of source.getTracks()) track.stop();
    }

    function switchCamera(cameraId: string) {
        // Retry after a failed switch restarts the camera the select shows
        selectedCameraId = cameraId;
        stopScanner();
        startScanner(cameraId);
    }

    function resetState() {
        cameras = [];
        selectedCameraId = '';
        error = '';
        isStarting = false;
        isScanning = false;
        scanCount = 0;
        lastScanned = '';
        lastScannedAt = 0;
    }
</script>

<Dialog bind:open>
    <DialogContent class="max-w-md">
        <DialogHeader>
            <DialogTitle>{m['scanner.title']()}</DialogTitle>
            <DialogDescription>{m['scanner.description']()}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col items-center gap-4 py-4">
            {#if error}
                <div class="w-full p-4 bg-destructive/10 border border-destructive/30 rounded-md">
                    <p class="text-sm text-destructive">{error}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        class="mt-2"
                        onclick={() => startScanner(selectedCameraId || undefined)}
                    >
                        {m['common.retry']()}
                    </Button>
                </div>
            {/if}

            <!-- The camera view stays dark in every theme, like the video it frames: its black,
                 grey and white are fixed. -->
            <div
                class="w-full min-h-[300px] relative flex items-center bg-black rounded-md overflow-hidden"
            >
                {#if isStarting}
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-md z-10"
                    >
                        <div class="text-center">
                            <div
                                class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"
                            ></div>
                            <p class="text-gray-300">{m['scanner.starting']()}</p>
                        </div>
                    </div>
                {/if}
                <div class="relative w-full">
                    <!-- resize: also when the phone turns, which changes the area's shape -->
                    <video
                        bind:this={video}
                        class="block w-full"
                        muted
                        playsinline
                        onloadedmetadata={placeFrame}
                        onresize={placeFrame}
                    ></video>
                    {#if isScanning && frame}
                        <!-- Darkens the picture around the reading area -->
                        <div
                            class="absolute rounded-md border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
                            style:left="{frame.left}%"
                            style:top="{frame.top}%"
                            style:width="{frame.width}%"
                            style:height="{frame.height}%"
                        ></div>
                    {/if}
                </div>
            </div>

            {#if cameras.length > 1}
                <div class="w-full">
                    <label for="camera-select" class="text-sm font-medium mb-2 block"
                        >{m['scanner.select_camera']()}</label
                    >
                    <OptionSelect
                        id="camera-select"
                        value={selectedCameraId}
                        placeholder={m['scanner.select_camera']()}
                        disabled={isStarting}
                        options={cameras.map((camera) => ({
                            value: camera.deviceId,
                            label:
                                camera.label ||
                                m['scanner.unnamed_camera']({ id: camera.deviceId.slice(0, 8) })
                        }))}
                        onValueChange={(newId) => {
                            if (newId !== selectedCameraId) {
                                switchCamera(newId);
                            }
                        }}
                    />
                </div>
            {/if}

            {#if continuous}
                <div class="w-full text-sm text-center">
                    <p class="font-medium">
                        {m['scanner.scanned_count']({ count: scanCount })}
                    </p>
                    {#if lastScanned}
                        <p class="text-muted-foreground font-mono">
                            {m['scanner.last_scanned']({ code: lastScanned })}
                        </p>
                    {/if}
                </div>
            {/if}

            <div class="w-full flex justify-end gap-2 mt-2">
                {#if continuous}
                    <Button onclick={() => (open = false)}>
                        {m['scanner.done']()}
                    </Button>
                {:else}
                    <Button variant="outline" onclick={() => (open = false)}>
                        {m['common.cancel']()}
                    </Button>
                {/if}
            </div>
        </div>
    </DialogContent>
</Dialog>
