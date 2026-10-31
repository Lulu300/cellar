import { expect, type Locator, type Page } from '@playwright/test';

const ACCESS_CODE = 'e2e-access-code';

/**
 * Logs in through the login dialog. Each journey starts logged out, in a new browser context; the
 * first one on the fresh install chooses the access code, with the setup token of the server logs.
 *
 * The dialog opens once the page is hydrated. From there the journeys move through the app's own
 * links: after a page.goto, a click could land before hydration and do nothing.
 */
export async function logIn(page: Page) {
    const response = await page.request.get('/api/access-code');
    const { exists } = await response.json();

    await page.goto('/wines?login');
    if (exists) return logInAgain(page);

    // Set by playwright.config.ts from the server logs.
    const setupToken = process.env.SETUP_TOKEN;
    if (!setupToken) throw new Error('No SETUP_TOKEN');
    const dialog = page.getByRole('dialog', { name: 'Choose an Access Code' });
    await dialog.getByLabel('New Access Code').fill(ACCESS_CODE);
    await dialog.getByLabel('Confirm Access Code').fill(ACCESS_CODE);
    await dialog.getByLabel('Setup token').fill(setupToken);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expectLoggedIn(page);
}

/** Logs in with the login dialog already open, as after a session that ended. */
export async function logInAgain(page: Page) {
    const dialog = page.getByRole('dialog', { name: 'Access Code Required' });
    await dialog.getByLabel('Access Code', { exact: true }).fill(ACCESS_CODE);
    await dialog.getByRole('button', { name: 'Login' }).click();
    await expectLoggedIn(page);
}

/** The menu of the top bar, which shows at Desktop Chrome's width (playwright.config.ts). */
const menu = (page: Page) => page.getByRole('navigation', { name: 'Menu' });

/** Waits for the menu of a session: the tools are only in it with one. */
export async function expectLoggedIn(page: Page) {
    await expect(menu(page).getByRole('link', { name: 'Tools', exact: true })).toBeVisible();
}

/**
 * Opens a page of the menu as a mouse does: hovers its section, a link or the gear (Settings),
 * which shows the section's pages, then clicks the page.
 */
export async function openFromMenu(page: Page, section: string, name: string) {
    const nav = menu(page);
    await nav
        .getByRole('link', { name: section, exact: true })
        .or(nav.getByRole('button', { name: section, exact: true }))
        .hover();
    await nav.getByRole('link', { name, exact: true }).click();
}

/**
 * Picks an option of a searchable select by typing its exact name, then Enter. A name that matches
 * no option creates one where the field allows it: the journeys type only seeded names.
 */
export async function pick(input: Locator, option: string) {
    await input.fill(option);
    await input.press('Enter');
}

/**
 * Adds a wine from the wine list with "Save & Add Bottle", as a user does, and returns the bottle
 * dialog that opens for it.
 */
export async function addWineThenBottle(page: Page, name: string): Promise<Locator> {
    await openFromMenu(page, 'Cellar', 'My Wines');
    await page.getByRole('button', { name: 'Add wine' }).click();
    const wineDialog = page.getByRole('dialog', { name: 'Add wine' });
    await wineDialog.getByLabel('Wine Name').fill(name);
    await pick(wineDialog.getByPlaceholder('Search appellations'), 'Margaux');
    await pick(wineDialog.getByPlaceholder('Search wine types'), 'Vin');
    await pick(wineDialog.getByPlaceholder('Search wine colors'), 'Rouge');
    await wineDialog.getByRole('button', { name: 'Save & Add Bottle' }).click();

    const bottleDialog = page.getByRole('dialog', { name: 'Add Wine Bottle' });
    await expect(bottleDialog.getByPlaceholder('Search wines')).toHaveValue(name);
    return bottleDialog;
}

/** Adds a wine and its bottles from the wine list, as a user does. */
export async function addWine(page: Page, name: string, bottles: number) {
    const bottleDialog = await addWineThenBottle(page, name);
    await pick(bottleDialog.getByPlaceholder('Search wine formats'), '75 cl');
    await bottleDialog.getByLabel('Vintage (Year)').fill('2018');
    await bottleDialog.getByLabel('Number of Bottles').fill(String(bottles));
    await bottleDialog.getByRole('button', { name: 'Save Bottle' }).click();
    await expect(bottleDialog).toBeHidden();
}

/** An APP1 segment of EXIF data: the photo is to be turned a quarter clockwise, and a GPS block. */
function exifSegment(): Buffer {
    const tiff = Buffer.alloc(56);
    tiff.write('II', 0, 'latin1');
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    // The first block, of two entries: Orientation 6, then where the GPS block starts
    tiff.writeUInt16LE(2, 8);
    tiff.writeUInt16LE(0x0112, 10);
    tiff.writeUInt16LE(3, 12);
    tiff.writeUInt32LE(1, 14);
    tiff.writeUInt16LE(6, 18);
    tiff.writeUInt16LE(0x8825, 22);
    tiff.writeUInt16LE(4, 24);
    tiff.writeUInt32LE(1, 26);
    tiff.writeUInt32LE(38, 30);
    // The GPS block, of one entry: GPSLatitudeRef "N"
    tiff.writeUInt16LE(1, 38);
    tiff.writeUInt16LE(1, 40);
    tiff.writeUInt16LE(2, 42);
    tiff.writeUInt32LE(2, 44);
    tiff.write('N', 48, 'latin1');
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
    const header = Buffer.from([0xff, 0xe1, 0, 0]);
    header.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([header, body]);
}

/**
 * A JPEG of 2000 × 1000 pixels as a phone held upright writes it: its EXIF data say to turn it a
 * quarter clockwise, and where it was taken.
 */
export async function phonePhoto(page: Page): Promise<Buffer> {
    const bytes = await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 2000;
        canvas.height = 1000;
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#8b1a1a';
        context.fillRect(0, 0, 2000, 1000);
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg')
        );
        return Array.from(new Uint8Array(await blob!.arrayBuffer()));
    });
    const jpeg = Buffer.from(bytes);
    return Buffer.concat([jpeg.subarray(0, 2), exifSegment(), jpeg.subarray(2)]);
}

/** The size of a JPEG in pixels, and whether it holds EXIF data, read from its segments. */
export function jpegInfo(jpeg: Buffer) {
    let exif = false;
    // The segments before the image data (FFDA), each with its length
    for (let at = 2; jpeg[at] === 0xff && jpeg[at + 1] !== 0xda;) {
        const marker = jpeg[at + 1];
        if (marker === 0xe1 && jpeg.toString('latin1', at + 4, at + 10) === 'Exif\0\0') exif = true;
        if (marker === 0xc0 || marker === 0xc2) {
            return { width: jpeg.readUInt16BE(at + 7), height: jpeg.readUInt16BE(at + 5), exif };
        }
        at += 2 + jpeg.readUInt16BE(at + 2);
    }
    return { exif };
}
