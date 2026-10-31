import { expect, test } from '@playwright/test';
import {
    addWine,
    addWineThenBottle,
    expectLoggedIn,
    jpegInfo,
    logIn,
    openFromMenu,
    phonePhoto,
    pick
} from './helpers.js';

test('log in, add a wine and two bottles from the wine list, and buy a wine of the wishlist', async ({
    page
}) => {
    await logIn(page);
    // Back to a ?login page while logged in: the page asks the server, and still shows the session.
    // Once hydrated, so that the link and Back are navigations within the page. Not /wines, whose
    // filters rewrite its URL.
    await page.goto('/preferences?login', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Statistics' }).click();
    await expect(page).toHaveURL(/\/statistics$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/preferences\?login$/);
    await expectLoggedIn(page);
    await expect(page.getByRole('dialog')).toBeHidden();

    await addWine(page, 'Château Journey', 2);

    // A name typed on the wishlist, with a photo of its label, becomes a wine, then a bottle; the
    // wine leaves the wishlist only when the user says so (FEAT-02).
    await openFromMenu(page, 'Purchases', 'Wishlist');
    await page.getByLabel('Add a wish').fill('Clos Wished');
    const wishPhoto = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose a file' }).click();
    await (
        await wishPhoto
    ).setFiles({ name: 'wish.jpg', mimeType: 'image/jpeg', buffer: await phonePhoto(page) });
    await page
        .getByRole('dialog', { name: 'Rotate and crop the photo' })
        .getByRole('button', { name: 'Use this photo' })
        .click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const wish = page
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { name: 'Clos Wished' }) });
    await expect(wish).toBeVisible();
    // Without a wine in shortage, Purchases shows a dot, named by the number of wishes.
    await expect(
        page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: /^Purchases/ })
    ).toHaveAccessibleName('Purchases 1 wish');

    await wish.getByRole('button', { name: 'Create the wine' }).click();
    const wishWine = page.getByRole('dialog', { name: 'Add wine' });
    await expect(wishWine.getByLabel('Wine Name')).toHaveValue('Clos Wished');
    const wishLabel = wishWine.getByRole('img', { name: 'Wine preview' });
    await expect(wishLabel).toHaveAttribute('src', /^\/uploads\/wines\/wine-/);
    const labelUrl = await wishLabel.getAttribute('src');
    await pick(wishWine.getByPlaceholder('Search appellations'), 'Margaux');
    await pick(wishWine.getByPlaceholder('Search wine types'), 'Vin');
    await pick(wishWine.getByPlaceholder('Search wine colors'), 'Rouge');
    await wishWine.getByRole('button', { name: 'Save & Add Bottle' }).click();
    const wishBottle = page.getByRole('dialog', { name: 'Add Wine Bottle' });
    await expect(wishBottle.getByPlaceholder('Search wines')).toHaveValue('Clos Wished');
    await pick(wishBottle.getByPlaceholder('Search wine formats'), '75 cl');
    await wishBottle.getByRole('button', { name: 'Save Bottle' }).click();
    // The wish, linked to its wine, waits for the user's answer.
    const offer = page.getByRole('dialog', { name: 'Confirm' });
    await expect(offer).toContainText('This wine is on your wishlist');
    await expect(wish.getByRole('img', { name: 'Clos Wished' })).toHaveAttribute('src', labelUrl!);
    await offer.getByRole('button', { name: 'Remove from the list' }).click();
    await expect(page.getByText('Your wishlist is empty')).toBeVisible();
    await openFromMenu(page, 'Cellar', 'My Wines');

    // The other journeys add wines too.
    await page.getByLabel('Search', { exact: true }).fill('Château Journey');
    await expect(page.getByText('1 wine (2 bottles in all)')).toBeVisible();
    await expect(page.getByRole('button', { name: '2 bottles' })).toBeVisible();
    await page.getByRole('button', { name: 'Ascending order' }).click();
    // The search and the sort are in the URL, which keeps them for the way back from the wine
    const query = () => new URL(page.url()).searchParams;
    await expect.poll(() => query().get('search')).toBe('Château Journey');
    await expect.poll(() => query().get('dir')).toBe('desc');

    // A filter chosen with the keyboard alone: two colours match "Ro", the arrows reach Rouge.
    const color = page.getByRole('combobox', { name: 'Color' });
    await color.focus();
    await page.keyboard.type('Ro');
    const options = page.getByRole('listbox').getByRole('option');
    await expect(options).toHaveCount(2);
    const presses = (await options.allTextContents()).indexOf('Rouge') + 1;
    for (let i = 0; i < presses; i++) await page.keyboard.press('ArrowDown');
    await expect(options.filter({ hasText: 'Rouge' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(color).toHaveValue('Rouge');
    await expect.poll(() => query().get('color')).toBeTruthy();
    await expect(page.getByText('1 wine (2 bottles in all)')).toBeVisible();

    await page.getByRole('heading', { name: 'Château Journey' }).click();
    await expect(page.getByText('Available Bottles (2)')).toBeVisible();

    // A photo of the label as a phone writes it, through the preview that turns and crops it. It
    // is stored the right way up (portrait), shrunk, without its EXIF data and GPS position.
    const photo = await phonePhoto(page);
    expect(jpegInfo(photo)).toEqual({ width: 2000, height: 1000, exif: true });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose a file' }).click();
    await (await chooser).setFiles({ name: 'label.jpg', mimeType: 'image/jpeg', buffer: photo });
    const preview = page.getByRole('dialog', { name: 'Rotate and crop the photo' });
    // Half a turn keeps the photo upright: both buttons turn it
    await preview.getByRole('button', { name: 'Rotate right' }).click();
    await preview.getByRole('button', { name: 'Rotate right' }).click();
    await preview.getByRole('button', { name: 'Use this photo' }).click();
    await expect(preview).toBeHidden();
    const shown = page.getByRole('img', { name: 'Château Journey' });
    await expect(shown).toHaveAttribute('src', /^\/uploads\/wines\/wine-.*\.jpg$/);
    const stored = await page.request.get((await shown.getAttribute('src'))!);
    expect(jpegInfo(await stored.body())).toEqual({ width: 800, height: 1600, exif: false });
    await expect(page.getByText('Main photo', { exact: true })).toBeVisible();

    await page.goBack();
    await expect(page.getByLabel('Search', { exact: true })).toHaveValue('Château Journey');
    await expect(page.getByRole('button', { name: 'Descending order' })).toBeVisible();
    await expect(page.getByText('1 wine (2 bottles in all)')).toBeVisible();

    // A bottle added to a new wine, then cancelled, leaves no wine chosen for the next one.
    const bottleDialog = await addWineThenBottle(page, 'Château Cancelled');
    await bottleDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(bottleDialog).toBeHidden();
    await page.getByRole('button', { name: 'Add bottle', exact: true }).click();
    const wine = bottleDialog.getByPlaceholder('Search wines');
    await expect(wine).toHaveValue('');

    // A refused save brings the first field in error into view and focuses it, with its message,
    // on a phone too, where the save button is a whole screen below the first field.
    await page.setViewportSize({ width: 390, height: 844 });
    await bottleDialog.getByRole('button', { name: 'Save Bottle' }).click();
    await expect(wine).toBeFocused();
    await expect(wine).toBeInViewport();
    await expect(wine).toHaveAttribute('aria-invalid', 'true');
    await expect(wine).toHaveAccessibleDescription(/Required/);
});
