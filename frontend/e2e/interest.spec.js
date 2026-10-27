/** Verify candidate navigation, validation, persisted success, and failed-save feedback. */
import { test, expect, capturePreflight } from './fixtures.js';

/** Enter a complete draft through the visible controls. */
async function fill(page, email = 'jane@example.com') {
  await page.getByLabel('Full Name').fill('Jane Doe');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Mobile Number').fill('0123456789');
  await page.getByLabel('Department of Interest').selectOption('Engineering');
}

test('Home to Apply validates, commits, dismisses confirmation and rejects duplicates', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Express Your Interest' }).click();
  await expect(page).toHaveURL(/\/apply$/);
  await expect(page.getByRole('heading', { name: 'Join Our Team' })).toBeVisible();
  await capturePreflight(page, testInfo, 'interest-empty');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBeNull();
  await capturePreflight(page, testInfo, 'interest-invalid');
  await fill(page);
  await page.getByLabel('Mobile Number').fill('12345abcde');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByLabel('Mobile Number')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBeNull();
  await page.getByLabel('Mobile Number').fill('0123456789');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByRole('status')).toHaveText('Thank you! Your interest has been submitted successfully.');
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')));
  expect(rows).toHaveLength(1);
  expect(Object.keys(rows[0])).toEqual(['id', 'fullName', 'email', 'mobile', 'department', 'submittedAt']);
  expect(rows[0]).toMatchObject({ fullName: 'Jane Doe', email: 'jane@example.com', mobile: '0123456789', department: 'Engineering' });
  expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(rows[0].submittedAt).toISOString()).toBe(rows[0].submittedAt);
  for (const label of ['Full Name', 'Email Address', 'Mobile Number', 'Department of Interest']) await expect(page.getByLabel(label)).toHaveValue('');
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 5000 });
  await fill(page, 'JANE@EXAMPLE.COM');
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByRole('alert')).toHaveText('This email has already been submitted.');
  await expect(page.getByLabel('Email Address')).toHaveValue('JANE@EXAMPLE.COM');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hirehub_submissions')))).toEqual(rows);
  await page.getByRole('link', { name: '← Back to Home' }).click();
  await expect(page.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
});

test('storage quota exhaustion never reports success and retains the complete draft', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Apply', exact: true }).click();
  await fill(page);
  // Fill real browser storage with synthetic non-PII data; the test context owns cleanup.
  const quotaError = await page.evaluate(() => {
    let index = 0;
    let errorName;
    // Reduce chunk size after each refusal so a small application record cannot fit.
    for (let size = 1024 * 1024; size >= 1; size = Math.floor(size / 2)) {
      const value = 'x'.repeat(size);
      while (true) {
        if (index >= 128) throw new Error('Browser storage quota was not reached within the fixture limit.');
        try {
          localStorage.setItem(`quota-fixture-${index}`, value);
          index += 1;
        } catch (error) {
          if (error.name !== 'QuotaExceededError' && error.name !== 'NS_ERROR_DOM_QUOTA_REACHED') throw error;
          errorName = error.name;
          break;
        }
      }
    }
    return errorName;
  });
  expect(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']).toContain(quotaError);
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await expect(page.getByRole('alert')).toContainText('Browser storage is full.');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByLabel('Full Name')).toHaveValue('Jane Doe');
  await expect(page.getByLabel('Email Address')).toHaveValue('jane@example.com');
  await expect(page.getByLabel('Mobile Number')).toHaveValue('0123456789');
  await expect(page.getByLabel('Department of Interest')).toHaveValue('Engineering');
  expect(await page.evaluate(() => localStorage.getItem('hirehub_submissions'))).toBeNull();
  await capturePreflight(page, testInfo, 'interest-storage-full');
});
