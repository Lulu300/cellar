import { expect, test } from '@playwright/test';
import { addWine, logIn, openFromMenu, pick } from './helpers.js';

test('add a container on the storage page, put a bottle in one of its cases, then colour it from the admin', async ({
    page
}) => {
    await logIn(page);
    await addWine(page, 'Cuvée Stored', 1);

    await openFromMenu(page, 'Cellar', 'Storage');
    await page.getByRole('button', { name: '+ Add Container' }).click();
    const containerDialog = page.getByRole('dialog', { name: 'Add New Storage Container' });
    // Save is greyed until the container has a name, and the field says so.
    await expect(containerDialog.getByRole('button', { name: 'Create Container' })).toBeDisabled();
    await expect(containerDialog.getByLabel('Container Name')).toHaveAccessibleDescription(
        'Enter a name to save the container.'
    );
    await containerDialog.getByLabel('Container Name').fill('Rack');
    await containerDialog.getByLabel('Number of Cases').fill('2');
    await containerDialog.getByRole('button', { name: 'Create Container' }).click();
    await expect(containerDialog).toBeHidden();
    await expect(page.getByRole('cell', { name: 'Rack1 0/5' })).toBeVisible();

    await page.getByRole('button', { name: 'View All Bottles' }).click();
    const bottles = page.getByRole('dialog', { name: 'All bottles' });
    await bottles
        .getByRole('row')
        .filter({ hasText: 'Cuvée Stored' })
        .getByRole('button', { name: 'Edit' })
        .click();
    const bottleDialog = page.getByRole('dialog', { name: 'Edit Wine Bottle' });
    await pick(bottleDialog.getByPlaceholder('Search storage cases'), 'Rack1');
    await bottleDialog.getByRole('button', { name: 'Update Bottle' }).click();
    await expect(bottleDialog).toBeHidden();

    await expect(bottles.getByRole('row').filter({ hasText: 'Cuvée Stored' })).toContainText(
        'Rack1'
    );
    await expect(page.getByRole('cell', { name: 'Rack1 1/5' })).toBeVisible();

    // Deleting the container asks in Cellar's confirmation, over the container dialog.
    await page.keyboard.press('Escape');
    await expect(bottles).toBeHidden();
    await page.getByRole('button', { name: 'Edit the container Rack' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit Storage Container' });
    await editDialog.getByRole('button', { name: 'Delete Container' }).click();
    const confirmation = page.getByRole('dialog', { name: 'Confirm' });
    await expect(confirmation).toContainText('delete the container "Rack"');
    await confirmation.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirmation).toBeHidden();
    await expect(editDialog).toBeVisible();

    // Leaving the page, by the browser's back button too, cancels the question.
    await editDialog.getByRole('button', { name: 'Delete Container' }).click();
    await expect(confirmation).toBeVisible();
    await page.goBack();
    await expect(confirmation).toBeHidden();
    await page.goForward();
    await expect(page.getByRole('cell', { name: 'Rack1 1/5' })).toBeVisible();
    await expect(confirmation).toBeHidden();

    // A colour picked in the admin fills the place of the wine's bottle (FEAT-03).
    await openFromMenu(page, 'Settings', 'Admin');
    await page.getByRole('link', { name: 'Data', exact: true }).click();
    await page.getByRole('link', { name: 'Wine Colors' }).click();
    // A new colour's picker starts on the colour of its name, as the API gives it.
    await page.getByRole('button', { name: 'Add Wine Color' }).click();
    const addDialog = page.getByRole('dialog', { name: 'Add Wine Color' });
    await addDialog.getByLabel('Color Name').fill('Red');
    await expect(addDialog.getByLabel('Shade')).toHaveValue('#7b1e2b');
    await addDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(addDialog).toBeHidden();
    await page
        .getByRole('listitem')
        .filter({ hasText: 'Rouge' })
        .getByRole('button', { name: 'Edit' })
        .click();
    const colorDialog = page.getByRole('dialog', { name: 'Edit Wine Color' });
    await colorDialog.getByLabel('Shade').fill('#123456');
    await colorDialog.getByRole('button', { name: 'Save' }).click();
    await expect(colorDialog).toBeHidden();
    await openFromMenu(page, 'Cellar', 'Storage');
    await expect(page.getByRole('cell', { name: 'Rack1 1/5' }).locator('svg.wine-color')).toHaveCSS(
        'fill',
        'rgb(18, 52, 86)'
    );
});
