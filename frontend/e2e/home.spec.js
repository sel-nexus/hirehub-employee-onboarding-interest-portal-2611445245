/** Specify exact Home content, native CTAs, and responsive source visuals. */
import { test, expect, capturePreflight } from './fixtures.js';

/** Verify the complete source copy on desktop and mobile with preflight evidence. */
test('Home presents exact copy and the responsive feature grid', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Build Your Future With Us');
  await expect(page.getByText("Join a team that values innovation, collaboration, and growth. We're looking for talented people like you.")).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why Join Us?', exact: true })).toBeVisible();
  const cards = page.getByRole('article');
  const expected = [
    ['💡', 'Innovation', 'Work on cutting-edge projects that push boundaries and shape the future of technology.'],
    ['📈', 'Career Growth', 'Clear career paths, mentorship programs, and continuous learning opportunities for every team member.'],
    ['🤝', 'Great Culture', 'A diverse, inclusive workplace where collaboration and creativity thrive every day.'],
    ['🌍', 'Global Impact', "Your work reaches millions of users worldwide, making a real difference in people's lives."],
  ];
  await expect(cards).toHaveCount(4);
  for (const [index, [icon, title, description]] of expected.entries()) {
    await expect(cards.nth(index).locator('.feature-icon')).toHaveText(icon);
    await expect(cards.nth(index).getByRole('heading', { level: 3 })).toHaveText(title);
    await expect(cards.nth(index).locator('p')).toHaveText(description);
  }
  await expect(page.getByRole('heading', { name: 'Ready to take the next step?', exact: true })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('Browser-only demo. Data stays in this browser and is not sent to a centralized hiring system.');
  await expect(page.locator('.site-header')).toHaveCSS('position', 'sticky');
  await expect(page.locator('.site-header')).toHaveCSS('background-color', 'rgb(37, 99, 235)');
  await expect(page.locator('.hero')).toHaveCSS('background-color', 'rgb(37, 99, 235)');
  await expect(page.locator('.feature-card').first()).toHaveCSS('border-radius', '12px');
  await expect(page.locator('.feature-card').first()).toHaveCSS('padding', '24px');
  const boxes = await cards.evaluateAll(
    /** Measure grid placement without relying on screenshot interpretation. */
    (elements) => elements.map(
      /** Return layout coordinates of each card. */
      (element) => {
        const { x, y } = element.getBoundingClientRect();
        return { x, y };
      },
    ),
  );
  if (page.viewportSize().width < 768) {
    expect(new Set(boxes.map(/** Compare left edges of mobile cards. */ (box) => box.x)).size).toBe(1);
    await expect(page.locator('.hero h1')).toHaveCSS('font-size', '28px');
    await expect(page.locator('.hero')).toHaveCSS('padding', '40px 20px');
  } else {
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[2].y).toBe(boxes[3].y);
    expect(boxes[0].x).toBe(boxes[2].x);
    expect(boxes[0].x).not.toBe(boxes[1].x);
    await expect(page.locator('.hero h1')).toHaveCSS('font-size', '42px');
  }
  await capturePreflight(page, testInfo, `home-${testInfo.project.name}`);
});

for (const label of ['Express Your Interest', 'Apply Now']) {
  /** Verify each CTA is a native link and only activation changes the URL. */
  test(`${label} activates Apply without changing browser data`, async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(
      /** Seed synthetic values to prove CTA navigation preserves browser state. */
      () => {
        localStorage.setItem('hirehub_submissions', '[]');
        sessionStorage.setItem('unrelated', 'preserve-session');
        return { local: { ...localStorage }, session: { ...sessionStorage } };
      },
    );
    const cta = page.getByRole('link', { name: label, exact: true });
    await expect(cta).toHaveAttribute('href', '/apply');
    await expect(cta).toHaveCSS('height', '50px');
    await expect(cta).toHaveCSS('min-width', '220px');
    await expect(page).toHaveURL(/\/$/);
    await cta.click();
    await expect(page).toHaveURL(/\/apply$/);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Apply', exact: true })).toHaveAttribute('aria-current', 'page');
    const after = await page.evaluate(
      /** Read browser state after navigation without introducing a write. */
      () => ({ local: { ...localStorage }, session: { ...sessionStorage } }),
    );
    expect(after).toEqual(before);
  });
}
