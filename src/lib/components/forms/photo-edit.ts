/**
 * The part of a photo to keep, in fractions of its width and height as the preview shows it, once
 * turned.
 */
export interface Crop {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };

/**
 * The smallest crop, in fractions of each side: on a phone, its frame keeps room to be dragged
 * between the targets of its corners.
 */
const MIN_CROP = 0.2;

/** A corner of the crop frame. */
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** Quarter turns clockwise, 0 to 3. */
export type Turns = 0 | 1 | 2 | 3;

/**
 * The longest side of a photo once sent, in pixels: a label stays readable, and the file weighs a
 * few hundred KB instead of the several MB a phone writes.
 */
const PHOTO_MAX_SIDE = 1600;

const JPEG_QUALITY = 0.85;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** `crop` once the photo turns a quarter clockwise: it keeps the same part of the photo. */
export function turnCrop({ x, y, width, height }: Crop): Crop {
    return { x: 1 - y - height, y: x, width: height, height: width };
}

/** `crop` moved by `dx` and `dy`, within the photo. */
export function moveCrop(crop: Crop, dx: number, dy: number): Crop {
    return {
        ...crop,
        x: clamp(crop.x + dx, 0, 1 - crop.width),
        y: clamp(crop.y + dy, 0, 1 - crop.height)
    };
}

/** `crop` with `corner` moved by `dx` and `dy`, within the photo, and never below MIN_CROP. */
export function resizeCrop(crop: Crop, corner: Corner, dx: number, dy: number): Crop {
    let [left, top] = [crop.x, crop.y];
    let [right, bottom] = [crop.x + crop.width, crop.y + crop.height];
    if (corner.includes('w')) left = clamp(left + dx, 0, right - MIN_CROP);
    else right = clamp(right + dx, left + MIN_CROP, 1);
    if (corner.includes('n')) top = clamp(top + dy, 0, bottom - MIN_CROP);
    else bottom = clamp(bottom + dy, top + MIN_CROP, 1);
    return { x: left, y: top, width: right - left, height: bottom - top };
}

interface Size {
    width: number;
    height: number;
}

const turnedSize = ({ width, height }: Size, turns: Turns): Size =>
    turns % 2 ? { width: height, height: width } : { width, height };

/**
 * The size in pixels of the part `crop` of an image of `size` turned by `turns`, shrunk to
 * `maxSide` on its longest side, never enlarged.
 */
export function croppedSize(size: Size, turns: Turns, crop: Crop, maxSide: number): Size {
    const turned = turnedSize(size, turns);
    const [width, height] = [crop.width * turned.width, crop.height * turned.height];
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };
}

/**
 * Draws on `canvas`, resized to fit, the part `crop` of `image` turned by `turns`, at most
 * `maxSide` pixels on its longest side.
 */
export function drawPhoto(
    canvas: HTMLCanvasElement,
    image: ImageBitmap,
    turns: Turns,
    crop: Crop,
    maxSide: number
): void {
    const turned = turnedSize(image, turns);
    const size = croppedSize(image, turns, crop, maxSide);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d')!;
    // JPEG has no transparency: a PNG or GIF gets white rather than black behind it.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingQuality = 'high';
    context.scale(
        size.width / (crop.width * turned.width),
        size.height / (crop.height * turned.height)
    );
    context.translate(-crop.x * turned.width, -crop.y * turned.height);
    context.translate(turned.width / 2, turned.height / 2);
    context.rotate((turns * Math.PI) / 2);
    context.drawImage(image, -image.width / 2, -image.height / 2);
}

/**
 * The image of `file` the right way up: the browser applies the orientation that a phone records
 * in the EXIF data instead of turning the pixels.
 */
export const readPhoto = (file: Blob) =>
    createImageBitmap(file, { imageOrientation: 'from-image' });

/**
 * The photo as it will be sent: the part `crop` of `image` turned by `turns`, shrunk, in a new
 * JPEG file. Drawing it on a canvas leaves out every metadata of the original, its GPS position
 * included.
 */
export async function photoFile(image: ImageBitmap, turns: Turns, crop: Crop, name: string) {
    const canvas = document.createElement('canvas');
    drawPhoto(canvas, image, turns, crop, PHOTO_MAX_SIDE);
    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) throw new Error('The photo could not be encoded');
    return new File([blob], `${name.replace(/\.[^.]*$/, '') || 'photo'}.jpg`, {
        type: 'image/jpeg'
    });
}
