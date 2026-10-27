/** Verify both explicit logout controls preserve submissions and unrelated keys. */
import { test, expect } from './fixtures.js';

for (const source of ['header', 'dashboard']) {
  test(`${source} Logout clears only auth and routes home; reload and revisit remain logged out`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('hirehub_submissions', JSON.stringify([{
        id: crypto.randomUUID(), fullName: 'Test Person', email: 'logout@example.com',
        mobile: '0123456789', department: 'Engineering', submittedAt: '2026-03-04T10:30:00.000Z',
      }]));
      localStorage.setItem('unrelated', 'keep-local');
      sessionStorage.setItem('unrelated', 'keep-session');
    });
    const raw = await page.evaluate(() => localStorage.getItem('hirehub_submissions'));
    await page.getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('admin');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'logout@example.com' })).toBeVisible();
    const scope = source === 'header' ? page.getByRole('banner') : page.getByRole('main');
    await scope.getByRole('button', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('hirehub_admin_auth'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('unrelated'))).toBe('keep-session');
    expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep-local');
    expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe(raw);
    await page.reload();
    await page.getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe(raw);
  });
}
