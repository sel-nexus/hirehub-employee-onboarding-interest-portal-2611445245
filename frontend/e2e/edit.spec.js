/** Exercise real edit navigation and storage with the shared console enforcement fixture. */
import { test, expect, capturePreflight } from './fixtures.js';

/** Create a candidate through Apply, then sign in through the visible navigation. */
async function enterAdmin(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Express Your Interest' }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Jane Doe');
  await page.getByLabel('Email Address', { exact: true }).fill('edit@example.com');
  await page.getByLabel('Mobile Number', { exact: true }).fill('0123456789');
  await page.getByLabel('Department of Interest', { exact: true }).selectOption('Engineering');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByRole('status')).toContainText('submitted successfully');
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')));
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Submissions Dashboard' })).toBeVisible();
  return rows;
}

test('Apply to admin edits only editable fields, validates and supports accessible mobile dialog evidence', async ({ page }, testInfo) => {
  const before = await enterAdmin(page);
  const trigger = page.getByRole('row').filter({ hasText: 'edit@example.com' }).getByRole('button', { name: 'Edit', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Edit Submission' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Full Name', { exact: true })).toHaveValue('Jane Doe');
  await expect(dialog.getByLabel('Full Name', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('Email Address', { exact: true })).toHaveAttribute('readonly', '');
  await expect(dialog.getByLabel('Mobile Number', { exact: true })).toHaveValue('0123456789');
  await expect(dialog.getByLabel('Department of Interest', { exact: true })).toHaveValue('Engineering');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Save Changes' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Full Name', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await capturePreflight(page, testInfo, `${testInfo.project.name}-edit-dialog`);
  // The shared fixture captures page evidence; attach the new dialog's computed styles too.
  await testInfo.attach('edit-dialog-styles', {
    body: JSON.stringify(await dialog.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.width, maxHeight: style.maxHeight, overflowY: style.overflowY, padding: getComputedStyle(element.firstElementChild).padding, borderRadius: style.borderRadius };
    }), null, 2), contentType: 'application/json',
  });
  if (testInfo.project.name === 'mobile') await expect(dialog).toBeInViewport();
  await dialog.getByLabel('Full Name', { exact: true }).fill('Jane!');
  await dialog.getByLabel('Mobile Number', { exact: true }).fill('123');
  await dialog.getByLabel('Department of Interest', { exact: true }).selectOption('');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')))).toEqual(before);
  await dialog.getByLabel('Full Name', { exact: true }).fill('Jane Lee');
  await dialog.getByLabel('Mobile Number', { exact: true }).fill('9876543210');
  await dialog.getByLabel('Department of Interest', { exact: true }).selectOption('Design');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')));
  expect(after).toEqual([{ ...before[0], fullName: 'Jane Lee', mobile: '9876543210', department: 'Design' }]);
  await expect(page.getByRole('cell', { name: 'Jane Lee', exact: true })).toBeVisible();
  await expect(page.locator('.stat-departments strong')).toHaveText('1');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Jane Lee', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')))).toEqual(after);
});

test('Cancel, Escape and overlay dismiss changed drafts without writes and restore focus', async ({ page }) => {
  const before = await enterAdmin(page);
  const trigger = page.getByRole('button', { name: 'Edit', exact: true });
  for (const mode of ['cancel', 'escape', 'overlay']) {
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Full Name', { exact: true })).toHaveValue('Jane Doe');
    await dialog.getByLabel('Full Name', { exact: true }).fill('Discard Person');
    if (mode === 'cancel') await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    if (mode === 'escape') await page.keyboard.press('Escape');
    if (mode === 'overlay') await page.mouse.click(4, 4);
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')))).toEqual(before);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  }
});

test('a concurrently removed edit target refreshes the list and keeps the error/draft', async ({ page }) => {
  await enterAdmin(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('hirehub_submissions', '[]'));
  await page.getByRole('dialog').getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('The selected submission is no longer available.');
  await expect(page.getByText('No submissions yet.')).toBeAttached();
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe('[]');
});
