/** Verify confirmation and the Apply-to-admin-to-edit-to-delete cross-feature state flow. */
import { test, expect } from './fixtures.js';

/** Submit a complete synthetic candidate through visible form controls. */
async function apply(page, email, name) {
  await page.getByRole('link', { name: 'Apply', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill(name);
  await page.getByLabel('Email Address', { exact: true }).fill(email);
  await page.getByLabel('Mobile Number', { exact: true }).fill('0123456789');
  await page.getByLabel('Department of Interest', { exact: true }).selectOption('Engineering');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByRole('status')).toContainText('submitted successfully');
}

/** Sign in only through navigation and the actual demo form. */
async function login(page) {
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

test('Apply to admin to edit to delete preserves identity and unrelated records; decline never writes', async ({ page }) => {
  await page.goto('/');
  await apply(page, 'target@example.com', 'Target Person');
  await apply(page, 'keep@example.com', 'Keep Person');
  const created = await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')));
  expect(created).toHaveLength(2);
  await login(page);
  const target = page.getByRole('row').filter({ hasText: 'target@example.com' });
  await target.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Full Name', { exact: true }).fill('Edited Person');
  await page.getByRole('dialog').getByLabel('Department of Interest', { exact: true }).selectOption('Design');
  await page.getByRole('dialog').getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const edited = await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')));
  expect(edited).toEqual([{ ...created[0], fullName: 'Edited Person', department: 'Design' }, created[1]]);
  const decline = page.waitForEvent('dialog');
  const declineClick = target.getByRole('button', { name: 'Delete', exact: true }).click();
  const prompt = await decline;
  expect(prompt.type()).toBe('confirm');
  expect(prompt.message()).toBe('Are you sure you want to delete this submission?');
  await prompt.dismiss();
  await declineClick;
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')))).toEqual(edited);
  await expect(page.locator('.stat-total strong')).toHaveText('2');
  const accept = page.waitForEvent('dialog');
  const acceptClick = target.getByRole('button', { name: 'Delete', exact: true }).click();
  const confirmed = await accept;
  expect(confirmed.message()).toBe('Are you sure you want to delete this submission?');
  await confirmed.accept();
  await acceptClick;
  await expect(target).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'keep@example.com', exact: true })).toBeVisible();
  await expect(page.locator('.stat-total strong')).toHaveText('1');
  await expect(page.locator('.stat-departments strong')).toHaveText('1');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')))).toEqual([created[1]]);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'keep@example.com', exact: true })).toBeVisible();
  const finalPrompt = page.waitForEvent('dialog');
  const finalClick = page.getByRole('button', { name: 'Delete', exact: true }).click();
  await (await finalPrompt).accept();
  await finalClick;
  await expect(page.getByText('No submissions yet.')).toBeVisible();
  await expect(page.locator('.stat-latest strong')).toHaveText('N/A');
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe('[]');
});

test('a missing delete target refreshes current records and retains the warning', async ({ page }) => {
  await page.goto('/');
  await apply(page, 'missing@example.com', 'Missing Person');
  await login(page);
  await page.evaluate(() => localStorage.setItem('hirehub_submissions', '[]'));
  const prompt = page.waitForEvent('dialog');
  const click = page.getByRole('button', { name: 'Delete', exact: true }).click();
  await (await prompt).accept();
  await click;
  await expect(page.getByRole('alert')).toHaveText('The selected submission is no longer available.');
  await expect(page.getByText('No submissions yet.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe('[]');
});
