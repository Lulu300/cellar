import { expect, test } from '@playwright/test';
import { addWine, logIn, logInAgain, openFromMenu } from './helpers.js';

test('back up, wipe the cellar, then restore the backup from the list', async ({ page }) => {
    await logIn(page);
    await addWine(page, 'Domaine Saved', 1);
    const wine = page.getByRole('heading', { name: 'Domaine Saved' });

    await openFromMenu(page, 'Settings', 'Admin');
    await page.getByRole('link', { name: 'Backups' }).click();
    await page.getByRole('button', { name: 'Full backup', exact: true }).click();
    const backupDialog = page.getByRole('dialog', { name: 'Full backup' });
    await backupDialog.getByLabel('Custom filename (optional)').fill('e2e-journey');
    await backupDialog.getByRole('button', { name: 'Create backup' }).click();
    const backup = page.getByRole('listitem').filter({ hasText: 'e2e-journey' });
    await expect(backup).toBeVisible();

    // The kind filter of the list, chosen from the keyboard: the exports alone hide the backup.
    const manualList = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Manual backups and exports' }) });
    const kind = manualList.getByRole('combobox', { name: 'Show:' });
    await kind.focus();
    await kind.press('Enter');
    await expect(page.getByRole('option', { name: 'All (1)' })).toHaveAttribute('data-highlighted');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Full export (0)' })).toHaveAttribute(
        'data-highlighted'
    );
    await page.keyboard.press('Enter');
    await expect(backup).toBeHidden();
    await expect(manualList.getByText('None of this kind.')).toBeVisible();
    // A typed letter chooses on the closed list, as on a native select.
    await kind.press('a');
    await expect(kind).toHaveText('All (1)');
    await expect(backup).toBeVisible();
    // Tab passes over a list, closed or open, without choosing: here "Tab", one of the CSV
    // delimiters (BUG-23).
    await page.getByRole('button', { name: 'CSV export', exact: true }).click();
    const csvExportDialog = page.getByRole('dialog', { name: 'CSV export' });
    const delimiter = csvExportDialog.getByRole('combobox', { name: 'Delimiter' });
    await delimiter.focus();
    await delimiter.press('Tab');
    await expect(delimiter).not.toBeFocused();
    await expect(delimiter).toHaveText(',');
    await delimiter.focus();
    await delimiter.press('Enter');
    await expect(delimiter).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await expect(delimiter).toHaveAttribute('aria-expanded', 'false');
    await expect(delimiter).toHaveText(',');
    // On a small phone the dialog scrolls inside, and its title and buttons stay on the screen
    // (UI-21).
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(csvExportDialog.getByRole('heading', { name: 'CSV export' })).toBeInViewport({
        ratio: 1
    });
    await expect(csvExportDialog.getByRole('button', { name: 'Export CSV files' })).toBeInViewport({
        ratio: 1
    });
    if (viewport) await page.setViewportSize(viewport);
    await csvExportDialog.getByRole('button', { name: 'Cancel' }).click();

    // The session ends, as by a logout in another tab, while the browser downloads the backup that
    // the wipe made first: the login dialog opens over the page and keeps saying why (BUG-24).
    await page.route(
        '**/api/admin/download-backup?filename=cellar-backup-pre-reset-*',
        async (route) => {
            await page.request.delete('/api/session', {
                headers: { Origin: new URL(page.url()).origin }
            });
            await route.continue();
        },
        { times: 1 }
    );
    await page.getByRole('button', { name: 'Wipe all data' }).click();
    const wipeDialog = page.getByRole('dialog', { name: 'Complete database wipe' });
    await wipeDialog.getByRole('button', { name: 'Wipe all data' }).click();
    await expect(wipeDialog).toBeHidden();
    await expect(
        page.getByText(/could not download it because your session has expired/)
    ).toBeVisible();
    // Once the wipe has done all it does, which once included reloading the page: that left it for
    // /wines?login, and the dialog without its notice.
    await expect(page.getByRole('button', { name: 'Full backup', exact: true })).toBeEnabled();
    await expect(page).toHaveURL(/\/admin\/backups$/);
    await expect(
        page
            .getByRole('dialog', { name: 'Access code required' })
            .getByText('Your session has expired. Please log in again.')
    ).toBeVisible();
    await logInAgain(page);
    // The toasts of the wipe cover the pages of the menu for a few seconds, not the name of the
    // section, which opens its first page.
    const cellar = page.getByRole('navigation', { name: 'Menu' }).getByRole('link', {
        name: 'Cellar',
        exact: true
    });
    await cellar.click();
    await expect(page.getByText('0 wines (0 bottles in all)')).toBeVisible();

    // Back rather than the menu, which the toasts of the wipe cover for a few seconds.
    await page.goBack();
    await backup.getByRole('button', { name: 'Restore database from this backup' }).click();
    const restoreDialog = page.getByRole('dialog', { name: 'Database restore' });
    await restoreDialog.getByRole('button', { name: 'Restore database' }).click();
    await expect(restoreDialog).toBeHidden();
    await expect(page.getByText('Database restored.')).toBeVisible();

    await cellar.click();
    await expect(wine).toBeVisible();
});
