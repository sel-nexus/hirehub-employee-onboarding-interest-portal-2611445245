/** Verify real submissions survive reload and reopened tabs in the same browser context. */
import { test, expect } from './fixtures.js';

/** Enter a complete draft and activate the real submit handler. */
async function submit(page, email = 'jordan@example.com') {
  await page.getByLabel('Full Name').fill('Jordan Lee');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Mobile Number').fill('9876543210');
  await page.getByLabel('Department of Interest').selectOption('Data Science');
  await page.getByRole('button', { name: 'Submit Application' }).click();
}

test('full submission survives reload and closing/reopening a tab in the same browser', async ({ page, context, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Apply Now' }).click();
  await submit(page);
  await expect(page.getByRole('status')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('hirehub_submissions'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Join Our Team' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe(saved);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.close();
  const reopened = await context.newPage();
  const errors = [];
  reopened.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  reopened.on('pageerror', (error) => errors.push(error.message));
  try {
    await reopened.goto(baseURL);
    await reopened.getByRole('link', { name: 'Apply', exact: true }).click();
    expect(await reopened.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe(saved);
    await submit(reopened, 'JORDAN@example.com');
    await expect(reopened.getByRole('alert')).toHaveText('This email has already been submitted.');
    await expect(reopened.getByRole('status')).toHaveCount(0);
    expect(await reopened.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe(saved);
  } finally {
    await reopened.close();
    expect(errors).toEqual([]);
  }
});

test('explicit submit recovers corruption and persists a usable new record', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hirehub_submissions', '{corrupted'));
  await page.getByRole('link', { name: 'Apply', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBe('{corrupted');
  await submit(page);
  await expect(page.getByRole('status')).toBeVisible();
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ fullName: 'Jordan Lee', email: 'jordan@example.com', mobile: '9876543210', department: 'Data Science' });
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')))).toEqual(rows);
});
