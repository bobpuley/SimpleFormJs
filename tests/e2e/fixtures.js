import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handlebars = readFileSync(require.resolve('handlebars/dist/handlebars.min.js'), 'utf8');

/**
 * Serves the Handlebars CDN script from node_modules (tests run offline and deterministically),
 * fails on any uncaught page error and grants clipboard access.
 */
export const test = base.extend({
  page: async ({ page, context }, use) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.route('https://cdn.jsdelivr.net/npm/handlebars@*/**', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: handlebars }),
    );
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    page.on('console', (msg) => msg.type() === 'error' && errors.push(new Error(msg.text())));
    await use(page);
    expect(errors, `page errors: ${errors.map((e) => e.message).join('\n')}`).toEqual([]);
  },
});

export { expect };

export const openTour = async (page, hash = '') => {
  await page.goto(`/showcases/example/${hash}`);
  await expect(page.locator('#demo-remote .sf-root')).toBeVisible(); // auto-init finished
};

export const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText());
