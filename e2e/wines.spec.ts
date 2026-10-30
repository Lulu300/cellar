import { expect, test } from '@playwright/test';
import { addWine, addWineThenBottle, logIn } from './helpers.js';

test('log in, then add a wine and two bottles from the wine list', async ({ page }) => {
    await logIn(page);
    // Back to a ?login page while logged in: the page asks the server, and still shows the session.
    // Once hydrated, so that the link and Back are navigations within the page. Not /wines, whose
    // filters rewrite its URL.
    await page.goto('/preferences?login', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Statistics' }).click();
    await expect(page).toHaveURL(/\/statistics$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/preferences\?login$/);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();

    await addWine(page, 'Château Journey', 2);

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
