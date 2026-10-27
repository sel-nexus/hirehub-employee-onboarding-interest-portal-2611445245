/** Verify real form-to-review wiring and empty/populated mobile table states. */
import { test, expect } from './fixtures.js';

/** Sign in through visible links and the real demo form. */
async function login(page) {
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Submissions Dashboard' })).toBeVisible();
}

test('candidate form submission appears after demo login without review mutations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Express Your Interest' }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Test Person');
  await page.getByLabel('Email Address', { exact: true }).fill('journey@example.com');
  await page.getByLabel('Mobile Number', { exact: true }).fill('0123456789');
  await page.getByLabel('Department of Interest', { exact: true }).selectOption('Design');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByRole('status')).toHaveText('Thank you! Your interest has been submitted successfully.');
  const raw = await page.evaluate(() => localStorage.getItem('hirehub_submissions'));
  await login(page);
  await expect(page.getByRole('cell', { name: 'journey@example.com' })).toBeVisible();
  await expect(page.locator('.stat-total strong')).toHaveText('1');
  await expect(page.locator('.stat-departments strong')).toHaveText('1');
  await expect(page.getByRole('columnheader')).toHaveText(['#', 'Full Name', 'Email', 'Mobile', 'Department', 'Submitted On', 'Actions']);
  await page.reload();
  await expect(page.getByRole('cell', { name: 'journey@example.com' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe(raw);
});

test('empty dashboard displays exact state and stacked mobile metrics', async ({ page }, testInfo) => {
  await page.goto('/');
  await login(page);
  await expect(page.getByText('No submissions yet.')).toBeVisible();
  await expect(page.locator('.stat-total strong')).toHaveText('0');
  await expect(page.locator('.stat-departments strong')).toHaveText('0');
  await expect(page.locator('.stat-latest strong')).toHaveText('N/A');
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBeNull();
  if (testInfo.project.name === 'mobile') {
    const cards = await page.locator('.stat-card').all();
    const first = await cards[0].boundingBox();
    const second = await cards[1].boundingBox();
    expect(second.y).toBeGreaterThan(first.y + first.height);
    expect(second.x).toBe(first.x);
  }
});

test('all 200 synthetic valid rows render with metrics and mobile horizontal scrolling', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => {
    const records = Array.from({ length: 200 }, (_, index) => ({
      id: crypto.randomUUID(), fullName: 'Test Person', email: `test${index}@example.com`,
      mobile: '0123456789', department: index % 2 ? 'Design' : 'Engineering',
      submittedAt: index === 100 ? '2026-05-01T10:30:00.000Z' : '2026-03-04T10:30:00.000Z',
    }));
    localStorage.setItem('hirehub_submissions', JSON.stringify(records));
  });
  const raw = await page.evaluate(() => localStorage.getItem('hirehub_submissions'));
  await login(page);
  await expect(page.getByRole('row')).toHaveCount(201);
  await expect(page.locator('.stat-total strong')).toHaveText('200');
  await expect(page.locator('.stat-departments strong')).toHaveText('2');
  await expect(page.locator('.stat-latest strong')).toHaveText('May 1, 2026');
  await expect(page.getByRole('row').last().getByRole('cell').first()).toHaveText('200');
  await expect(page.getByRole('row').last()).toContainText('test199@example.com');
  if (testInfo.project.name === 'mobile') {
    const region = page.getByRole('region', { name: 'Submissions', exact: true });
    expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth && getComputedStyle(element).overflowX === 'auto')).toBe(true);
    await region.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    expect(await region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByRole('columnheader', { name: 'Actions', exact: true })).toBeInViewport();
  }
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe(raw);
});

test('malformed browser data recovers to the real empty dashboard', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hirehub_submissions', '{broken'));
  await login(page);
  await expect(page.getByText('No submissions yet.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe('[]');
});
