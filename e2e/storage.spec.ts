import { expect, test } from '@playwright/test';
import { addWine, logIn, openFromMenu, pick } from './helpers.js';

test('add a container on the storage page, put bottles in its cases, move three from the map, mark one to drink this month and see it on the map, in the banner and on its page, give it a drinking window and see it ready, find the wine in the cellar, then colour it from the admin', async ({
    page,
    browser
}) => {
    await logIn(page);
    await addWine(page, 'Cuvée Stored', 4);

    await openFromMenu(page, 'Cellar', 'Storage');
    await page.getByRole('button', { name: '+ Add Container' }).click();
    const containerDialog = page.getByRole('dialog', { name: 'Add New Storage Container' });
    // Save is greyed until the container has a name, and the field says so.
    await expect(containerDialog.getByRole('button', { name: 'Create Container' })).toBeDisabled();
    await expect(containerDialog.getByLabel('Container Name')).toHaveAccessibleDescription(
        'Enter a name to save the container.'
    );
    await containerDialog.getByLabel('Container Name').fill('Rack');
    await containerDialog.getByLabel('Number of Cases').fill('3');
    await containerDialog.getByLabel('Capacity:').nth(2).fill('2');
    await containerDialog.getByRole('button', { name: 'Create Container' }).click();
    await expect(containerDialog).toBeHidden();
    // A case is a button named after what it holds.
    await expect(page.getByRole('button', { name: 'Rack1: 0 of 5 bottles' })).toBeVisible();

    await page.getByRole('button', { name: 'View All Bottles' }).click();
    const bottles = page.getByRole('dialog', { name: 'All bottles' });
    await bottles
        .getByRole('row')
        .filter({ hasText: 'Cuvée Stored' })
        .first()
        .getByRole('button', { name: 'Edit' })
        .click();
    const bottleDialog = page.getByRole('dialog', { name: 'Edit Wine Bottle' });
    await pick(bottleDialog.getByPlaceholder('Search storage cases'), 'Rack1');
    await bottleDialog.getByRole('button', { name: 'Update Bottle' }).click();
    await expect(bottleDialog).toBeHidden();

    await expect(bottles.getByRole('row').filter({ hasText: 'Rack1' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Rack1: 1 of 5 bottles' })).toBeVisible();

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
    await expect(page.getByRole('button', { name: 'Rack1: 1 of 5 bottles' })).toBeVisible();
    await expect(confirmation).toBeHidden();

    // The wine's bottle dialog puts the three others in Rack1: the case picker lists each case
    // under its container with its room, and greys Rack3, which has no room for them (FEAT-04).
    await openFromMenu(page, 'Cellar', 'My Wines');
    await page.getByRole('button', { name: '4 bottles' }).click();
    const wineBottles = page.getByRole('dialog', { name: /Cuvée Stored/ });
    await wineBottles.getByRole('checkbox', { name: 'Select all' }).check();
    await wineBottles.getByRole('button', { name: 'Change location' }).click();
    const wineMove = page.getByRole('dialog', { name: /Change location/ });
    await wineMove.getByLabel('Storage Case').click();
    await expect(page.getByRole('option', { name: 'Rack3 2 free' })).toHaveAttribute(
        'aria-disabled',
        'true'
    );
    await page.getByRole('option', { name: 'Rack1 4 free' }).click();
    await wineMove.getByRole('button', { name: 'Confirm' }).click();
    await expect(wineMove).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(wineBottles).toBeHidden();

    // On the map, a case opens its bottles: three of them, ticked, move at once to Rack2.
    await openFromMenu(page, 'Cellar', 'Storage');
    await page.getByRole('button', { name: 'Rack1: 4 of 5 bottles' }).click();
    const caseDialog = page.getByRole('dialog', { name: 'Rack1' });
    const caseRows = caseDialog.getByRole('row').filter({ hasText: 'Cuvée Stored' });
    await expect(caseRows).toHaveCount(4);
    for (const row of [0, 1, 2]) {
        await caseRows.nth(row).getByRole('checkbox').check();
    }
    await caseDialog.getByRole('button', { name: 'Move to…' }).click();
    const caseMove = page.getByRole('dialog', { name: /Change location/ });
    await caseMove.getByLabel('Storage Case').click();
    await expect(page.getByRole('option', { name: 'Rack1 Current case' })).toHaveAttribute(
        'aria-disabled',
        'true'
    );
    await expect(page.getByRole('option', { name: 'Rack3 2 free' })).toHaveAttribute(
        'aria-disabled',
        'true'
    );
    await page.getByRole('option', { name: 'Rack2 5 free' }).click();
    await caseMove.getByRole('button', { name: 'Confirm' }).click();
    await expect(caseMove).toBeHidden();
    // The dialog and the map behind it follow, without a reload.
    await expect(caseRows).toHaveCount(1);
    await expect(caseDialog).toContainText('1 of 5 places used');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Rack2: 3 of 5 bottles' })).toBeVisible();

    // A bottle of a case is marked drunk from its menu, with the status dialog.
    await page.getByRole('button', { name: 'Rack2: 3 of 5 bottles' }).click();
    const rack2 = page.getByRole('dialog', { name: 'Rack2' });
    await rack2.getByRole('button', { name: 'Actions for Cuvée Stored 2018' }).first().click();
    await page.getByRole('menuitem', { name: 'Mark as drunk' }).click();
    const status = page.getByRole('dialog', { name: 'Change the status of 1 bottle' });
    await status.getByRole('button', { name: 'Confirm' }).click();
    await expect(status).toBeHidden();
    await expect(rack2.getByRole('row').filter({ hasText: 'Cuvée Stored' })).toHaveCount(2);

    // Another is to drink this month, in one click from its menu (FEAT-05).
    await rack2.getByRole('button', { name: 'Actions for Cuvée Stored 2018' }).first().click();
    await page.getByRole('menuitem', { name: 'Drinking window' }).click();
    const dating = page.getByRole('dialog', { name: 'Drinking window' });
    await dating.getByRole('button', { name: /^This month/ }).click();
    await expect(dating).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(rack2).toBeHidden();

    // The marker of the map, off at first, names it in its case.
    const marker = page.getByRole('button', { name: 'Bottles to drink' });
    await expect(marker).toHaveAttribute('aria-pressed', 'false');
    await marker.click();
    await expect(
        page.getByRole('button', { name: 'Rack2: 2 of 5 bottles. To drink: 1 this month' })
    ).toBeVisible();
    await marker.click();
    await page.getByRole('button', { name: 'Rack2: 2 of 5 bottles' }).click();

    // The name of the wine opens its page, whose "Show in the cellar" highlights its cases.
    await rack2.getByRole('link', { name: 'Cuvée Stored' }).first().click();
    await page.getByRole('link', { name: 'Show in the cellar' }).click();
    await expect(page.getByText('Cases holding Cuvée Stored: Rack1, Rack2')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Rack1: 1 of 5 bottles, holds the wine shown' })
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Rack2: 2 of 5 bottles, holds the wine shown' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rack3: 0 of 2 bottles' })).toBeVisible();
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(page).toHaveURL(/\/storage$/);
    await expect(page.getByRole('button', { name: 'Rack1: 1 of 5 bottles' })).toBeVisible();
    // The map takes the whole width of the screen; the header keeps the page width (UI-35).
    const screenWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect((await page.locator('main').boundingBox())!.width).toBe(screenWidth);
    expect((await page.locator('header > div').boundingBox())!.width).toBeLessThan(screenWidth);

    // The banner of the wine list counts it this month, and unfolds it under that rank.
    await openFromMenu(page, 'Cellar', 'My Wines');
    await expect(page.getByText('1 this month')).toBeVisible();
    await page.getByRole('button', { name: 'Show the list' }).click();
    await expect(
        page.getByRole('region', { name: 'This month' }).getByRole('link', { name: /Cuvée Stored/ })
    ).toBeVisible();

    // The banner leads to the page of every bottle to drink, which finds it among this month's
    // (FEAT-18).
    await page.getByRole('link', { name: /^See the/ }).click();
    await expect(page.getByRole('heading', { name: 'To drink', level: 1 })).toBeVisible();
    const thisMonth = page.getByRole('button', { name: '1 this month' });
    await thisMonth.click();
    await expect(thisMonth).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/rank=this_month/);
    const rows = page.getByRole('row').filter({ has: page.getByRole('link') });
    await expect(rows).toHaveCount(1);
    await expect(rows.getByRole('link', { name: 'Cuvée Stored' })).toBeVisible();

    // A window open since last year that ends next year makes it ready, a rank of this page only,
    // with its filter (FEAT-19).
    const year = new Date().getFullYear();
    await rows.getByRole('button', { name: 'Actions for Cuvée Stored 2018' }).click();
    await page.getByRole('menuitem', { name: 'Drinking window' }).click();
    await dating.getByRole('button', { name: /^Choose/ }).click();
    for (const [end, chosen] of [
        ['From', year - 1],
        ['Before the end of', year + 1]
    ] as const) {
        await dating
            .getByRole('group', { name: end })
            .getByRole('combobox', { name: 'Year' })
            .click();
        await page.getByRole('option', { name: String(chosen), exact: true }).click();
    }
    await dating.getByRole('button', { name: 'Confirm' }).click();
    await expect(dating).toBeHidden();
    const ready = page.getByRole('button', { name: '1 ready' });
    await ready.click();
    await expect(page).toHaveURL(/rank=ready/);
    await expect(rows).toHaveCount(1);
    await expect(rows.getByText('Ready', { exact: true })).toBeVisible();
    await expect(rows.getByText(`${year - 1}\u00a0– ${year + 1}`)).toBeVisible();

    // A visitor sees what a case holds; ticking a bottle asks to log in, and ticks nothing.
    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    await visitor.goto(new URL('/storage', page.url()).href);
    const visitorCase = visitor.getByRole('dialog', { name: 'Rack1' });
    // Opened once hydrated: a click before then does nothing.
    await expect(async () => {
        await visitor.getByRole('button', { name: 'Rack1: 1 of 5 bottles' }).click();
        await expect(visitorCase).toBeVisible({ timeout: 1000 });
    }).toPass();
    const box = visitorCase.getByRole('checkbox', { name: 'Select this bottle' });
    await box.click();
    await expect(visitor.getByText('Please log in to edit bottles')).toBeVisible();
    await expect(box).not.toBeChecked();
    await visitorContext.close();

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
    await expect(
        page.getByRole('button', { name: 'Rack1: 1 of 5 bottles' }).locator('svg.wine-color')
    ).toHaveCSS('fill', 'rgb(18, 52, 86)');
});
