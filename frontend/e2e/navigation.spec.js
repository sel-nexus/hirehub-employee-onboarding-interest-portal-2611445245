/** Specify header navigation, direct refresh, and unknown-route storage safety. */
import { test, expect, capturePreflight } from './fixtures.js';

/** Verify visible inline links, active styles, native keyboard activation, and sticky behavior. */
test('header links stay inline and indicate the activated route', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(3);
  const positions = await links.evaluateAll(
    /** Return link placement to verify the inline mobile navigation. */
    (elements) => elements.map(/** Read each link top edge. */ (element) => element.getBoundingClientRect().top),
  );
  expect(new Set(positions).size).toBe(1);
  await page.evaluate(/** Scroll to exercise the sticky header contract. */ () => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.locator('.site-header').evaluate(/** Read sticky header top edge. */ (element) => element.getBoundingClientRect().top)).toBe(0);
  await nav.getByRole('link', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/\/apply$/);
  await expect(nav.getByRole('link', { name: 'Apply', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole('link', { name: 'Apply', exact: true })).toHaveCSS('border-bottom-color', 'rgb(255, 255, 255)');
  await nav.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(nav.getByRole('link', { name: 'Admin', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'HireHub', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await nav.getByRole('link', { name: 'Home', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
});

for (const [path, name] of [['/', 'Home'], ['/apply', 'Apply'], ['/admin', 'Admin']]) {
  /** Verify static preview fallback serves the shell on direct navigation and reload. */
  test(`direct navigation and refresh preserve ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('navigation').getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
    await page.reload();
    await expect(page.getByRole('navigation').getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  });
}

/** Verify unknown deep routes never repair, clear, or otherwise mutate browser data. */
test('unknown route and refresh preserve all local and session data', async ({ page }, testInfo) => {
  await page.goto('/');
  const before = await page.evaluate(
    /** Seed synthetic malformed and unrelated values, then retain a full storage snapshot. */
    () => {
      localStorage.setItem('hirehub_submissions', '{synthetic malformed');
      localStorage.setItem('unrelated', 'preserve-local');
      sessionStorage.setItem('hirehub_admin_auth', 'true');
      sessionStorage.setItem('unrelated', 'preserve-session');
      return { local: { ...localStorage }, session: { ...sessionStorage } };
    },
  );
  await page.goto('/unknown/deep');
  await expect(page.getByRole('heading', { name: 'Not Found', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').locator('[aria-current]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Not Found', exact: true })).toBeVisible();
  const after = await page.evaluate(/** Read both storage areas without modifying them. */ () => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(after).toEqual(before);
  await capturePreflight(page, testInfo, `not-found-${testInfo.project.name}`);
  await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
});
