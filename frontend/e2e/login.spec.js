/** Verify real demo sign-in, reload persistence and independent tab sessions. */
import { test, expect } from './fixtures.js';

test('rejects nonexact credentials then signs in on the same route and persists on reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('Admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials. Please try again.');
  expect(await page.evaluate(() => sessionStorage.getItem('hirehub_admin_auth'))).toBeNull();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Submissions Dashboard' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('hirehub_admin_auth'))).toBe('true');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Submissions Dashboard' })).toBeVisible();
});

test('separate no-opener tab remains logged out when the authenticated tab closes', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Submissions Dashboard' })).toBeVisible();
  const other = await context.newPage();
  const errors = [];
  other.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  other.on('pageerror', (error) => errors.push(error.message));
  try {
    await other.goto('/');
    await other.getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(other.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    expect(await other.evaluate(() => sessionStorage.getItem('hirehub_admin_auth'))).toBeNull();
    await page.close();
    await other.reload();
    await expect(other.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  } finally {
    await other.close();
    expect(errors).toEqual([]);
  }
});

test('wrong session values cannot bypass the route gate', async ({ page }) => {
  await page.goto('/');
  for (const value of ['TRUE', '1', 'true ', 'false']) {
    await page.evaluate((flag) => sessionStorage.setItem('hirehub_admin_auth', flag), value);
    await page.getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await page.getByRole('link', { name: 'Home', exact: true }).click();
  }
});
