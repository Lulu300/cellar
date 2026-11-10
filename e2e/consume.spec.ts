import { expect, test } from '@playwright/test';
import { addWine, logIn, openFromMenu } from './helpers.js';

test('consume a bottle with a note from the wine page, then find it in the history', async ({
    page
}) => {
    await logIn(page);
    await addWine(page, 'Clos Consumed', 2);

    await page.getByRole('heading', { name: 'Clos Consumed' }).click();
    await page.getByRole('button', { name: 'Available', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Change the status of 1 bottle' });
    await expect(dialog.getByLabel('Change status to:')).toHaveText('Consumed');
    await dialog.getByLabel('Notes (optional)').fill('Shared with friends');
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Available bottles (1)')).toBeVisible();
    await expect(page.getByText('Consumed bottles (1)')).toBeVisible();

    await openFromMenu(page, 'Cellar', 'History');
    // The history lists every bottle: the one still available has no note.
    const consumed = page
        .getByRole('row')
        .filter({ hasText: 'Clos Consumed' })
        .filter({ hasText: 'Shared with friends' });
    await expect(consumed).toHaveCount(1);
    await expect(consumed.getByRole('cell', { name: 'Consumed', exact: true })).toBeVisible();
});
