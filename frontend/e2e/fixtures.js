/** Enforce clean browser diagnostics and provide reusable preflight evidence. */
import { test as base, expect } from '@playwright/test';

/** Capture accessibility, rendered structure, source styles, and a human-review screenshot.
 * @param {import('@playwright/test').Page} page - Rendered state to capture.
 * @param {import('@playwright/test').TestInfo} testInfo - Test-local attachment destination.
 * @param {string} name - Meaningful state label for the evidence.
 * @returns {Promise<void>} Resolve after all evidence is attached.
 */
export async function capturePreflight(page, testInfo, name) {
  const tree = await page.locator('body').ariaSnapshot();
  await testInfo.attach(`${name}-accessibility`, {
    body: JSON.stringify(tree, null, 2), contentType: 'application/json',
  });
  const styles = await page.evaluate(
    /** Collect representative computed styles for the current page and meaningful state. */
    () => {
      const selectors = ['body', '.site-header', '.header-inner', '.main-nav', '.main-nav a.active', '.hero', '.hero h1', '.hero p', '.cta-link', '.features h2', '.feature-grid', '.feature-card', '.feature-icon', '.feature-card h3', '.feature-card p', '.bottom-cta', '.demo-notice', '.interest-card', '.field-error', '.dashboard-stats', '.table-scroll', '.edit-modal'];
      const properties = ['color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight', 'opacity', 'position', 'top', 'display', 'gridTemplateColumns', 'gap', 'padding', 'borderTop', 'borderBottom', 'borderRadius', 'boxShadow', 'height', 'minHeight', 'minWidth'];
      return Object.fromEntries(selectors.map(
        /** Read resolved CSS without imposing a subjective style score. */
        (selector) => {
          const element = document.querySelector(selector);
          if (!element) return [selector, null];
          const style = getComputedStyle(element);
          return [selector, Object.fromEntries(properties.map(
            /** Preserve each property by its readable name. */
            (property) => [property, style[property]],
          ))];
        },
      ));
    },
  );
  await testInfo.attach(`${name}-styles`, { body: JSON.stringify(styles, null, 2), contentType: 'application/json' });
  await testInfo.attach(`${name}-html`, { body: await page.content(), contentType: 'text/html' });
  await testInfo.attach(`${name}-screenshot`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

export const test = base.extend({
  page:
    /** Attach error listeners before any test navigation and assert after every test. */
    async ({ page }, use) => {
      const errors = [];
      /** Retain browser errors without allowing quiet test success. */
      const onConsole = (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          errors.push(`console ${message.type()}: ${message.text()}`);
        }
      };
      /** Retain uncaught browser exceptions for teardown enforcement. */
      const onPageError = (error) => errors.push(`pageerror: ${error.message}`);
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      try {
        await use(page);
      } finally {
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
        expect(errors, 'Browser console and uncaught errors must be empty').toEqual([]);
      }
    },
});

export { expect };
