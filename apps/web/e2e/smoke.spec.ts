import { expect, test, type Page } from '@playwright/test';

/**
 * we5.3 smoke: the web app, through its real server actions, against the fake Transmission daemon
 * started by `playwright.config.ts` (loopback only, enabled by SEEDORA_ALLOW_PRIVATE_HOSTS).
 */
const DAEMON_PORT = process.env.FAKE_DAEMON_PORT ?? '19091';

async function openAddServerDialog(page: Page) {
  const switcher = page.getByRole('button', { name: /No server/ });
  await switcher.click();
  await page.getByRole('button', { name: 'Add Server...' }).click();
  return page.getByRole('dialog', { name: 'Add Server' });
}

async function addServer(page: Page, name: string, port = DAEMON_PORT) {
  const dialog = await openAddServerDialog(page);
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Host', { exact: true }).fill('127.0.0.1');
  await dialog.getByLabel('Port', { exact: true }).fill(port);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
}

test('adds a server and lists its torrents', async ({ page }) => {
  await page.goto('/');
  await addServer(page, 'Fake NAS');
  await expect(page.getByText('ubuntu-24.04-desktop-amd64.iso').first()).toBeVisible();
  await expect(page.getByText('Sintel 2010 (4K) 🎬').first()).toBeVisible();
});

test('shows the connected status and the status of each torrent', async ({ page }) => {
  await page.goto('/');
  await addServer(page, 'Fake NAS');
  await expect(page.getByText('Connected').first()).toBeVisible();
  await expect(page.getByText('Downloading').first()).toBeVisible();
  await expect(page.getByText('Seeding').first()).toBeVisible();
});

test('opens the details of the selected torrent', async ({ page }) => {
  await page.goto('/');
  await addServer(page, 'Fake NAS');
  await page.getByText('ubuntu-24.04-desktop-amd64.iso').first().click();
  await expect(page.getByText('Hash:', { exact: true })).toBeVisible();
  await expect(page.getByText('0000000000000000000000000000000000000001')).toBeVisible();
});

test('remembers the server after a reload and reconnects to it', async ({ page }) => {
  await page.goto('/');
  await addServer(page, 'Fake NAS');
  await expect(page.getByText('ubuntu-24.04-desktop-amd64.iso').first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Fake NAS/ })).toBeVisible();
  await expect(page.getByText('ubuntu-24.04-desktop-amd64.iso').first()).toBeVisible();
});

test('adds a torrent from a magnet link', async ({ page }) => {
  await page.goto('/');
  await addServer(page, 'Fake NAS');
  await page.getByRole('button', { name: 'Add Torrent' }).click();
  await page
    .getByPlaceholder('magnet:?xt= or https://...')
    .fill('magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01&dn=Added%20By%20E2E');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Added By E2E').first()).toBeVisible();
});

test('reports a connection problem when the daemon is down, with no torrent listed', async ({ page }) => {
  await page.goto('/');
  await addServer(page, 'Dead NAS', '19999');
  await expect(page.getByText(/Connection error|Disconnected/).first()).toBeVisible();
  await expect(page.getByText('ubuntu-24.04-desktop-amd64.iso')).toHaveCount(0);
});

test.describe('keyboard', () => {
  test('Escape closes the dialog and focus returns to the control that opened it', async ({ page }) => {
    await page.goto('/');
    await addServer(page, 'Fake NAS');
    const addTorrent = page.getByRole('button', { name: 'Add Torrent' });
    await addTorrent.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Add Torrent' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(addTorrent).toBeFocused();
  });

  test('arrow keys move the selection in the torrent grid', async ({ page }) => {
    await page.goto('/');
    await addServer(page, 'Fake NAS');
    const grid = page.getByRole('grid', { name: 'Torrents' });
    const first = grid.getByRole('row', { name: /ubuntu-24\.04/ });
    const second = grid.getByRole('row', { name: /Sintel/ });
    await first.click();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(first).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('ArrowUp');
    await expect(first).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('mobile viewport (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the filter sidebar is closed by default and opens as a drawer from the toolbar toggle', async ({ page }) => {
    await page.goto('/');
    await addServer(page, 'Fake NAS');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Downloading' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Toggle Filter Panel' }).click();
    const drawer = page.getByRole('dialog', { name: 'Toggle Filter Panel' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: /^Downloading/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('details open in a full-screen sheet for the selected torrent', async ({ page }) => {
    await page.goto('/');
    await addServer(page, 'Fake NAS');
    await page
      .getByRole('grid', { name: 'Torrents' })
      .getByRole('row', { name: /ubuntu-24\.04/ })
      .click();
    await page.getByRole('button', { name: 'Toggle Details Panel' }).click();
    const sheet = page.getByRole('dialog', { name: 'Toggle Details Panel' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Hash:', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
  });
});
