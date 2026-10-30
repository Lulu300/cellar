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
    if (exists) {
        const dialog = page.getByRole('dialog', { name: 'Access Code Required' });
        await dialog.getByLabel('Access Code', { exact: true }).fill(ACCESS_CODE);
        await dialog.getByRole('button', { name: 'Login' }).click();
    } else {
        // Set by playwright.config.ts from the server logs.
        const setupToken = process.env.SETUP_TOKEN;
        if (!setupToken) throw new Error('No SETUP_TOKEN');
        const dialog = page.getByRole('dialog', { name: 'Choose an Access Code' });
        await dialog.getByLabel('New Access Code').fill(ACCESS_CODE);
        await dialog.getByLabel('Confirm Access Code').fill(ACCESS_CODE);
        await dialog.getByLabel('Setup token').fill(setupToken);
        await dialog.getByRole('button', { name: 'Save' }).click();
    }
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
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
    await page.getByRole('link', { name: 'My Wines' }).click();
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
