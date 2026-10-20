import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.VEDOY_VERIFY_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('tmp/room-check', { recursive: true });
try {
  for (const width of [320, 375, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/#quickstart', { waitUntil: 'networkidle' });
    for (let repeat = 0; repeat < 3; repeat++) {
      await page.locator('#mobile-menu').click();
      await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().x >= -1);
      assert.equal(await page.locator('#mobile-menu').getAttribute('aria-expanded'), 'true');
      await page.locator('.sidebar-close').click();
      await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().right <= 0);
      assert.equal(await page.locator('#mobile-menu').getAttribute('aria-expanded'), 'false');
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
    console.log('Drawer open/close passed:', width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/#quickstart', { waitUntil: 'networkidle' });
  await page.locator('#mobile-menu').click();
  assert(await page.locator('.app-shell').evaluate(element => element.classList.contains('sidebar-collapsed')));
  await page.locator('#mobile-menu').click();
  assert(!(await page.locator('.app-shell').evaluate(element => element.classList.contains('sidebar-collapsed'))));
  await page.goto(base + '/#missions', { waitUntil: 'networkidle' });
  await page.locator('#entry-nav-toggle').click();
  await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().x >= -1);
  await page.locator('.sidebar-close').click();
  console.log('Desktop collapse and entry drawer passed');
  await page.goto(base + '/#landing', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-room-status]')?.textContent === 'Workspace ready · scroll to explore', { timeout: 30000 });
  assert.equal(await page.locator('.nav-link[data-page="room"]').count(), 0);
  assert.equal(await page.locator('.developer-room-landing > .room-heading, .room-landing-nav').count(), 0);
  await page.evaluate(() => scrollTo(0, innerHeight));
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.room-canvas canvas').count(), 1);
  await page.screenshot({ path: 'tmp/room-check/desktop.png' });
  await page.locator('[data-room-jump="2"]').click();
  await page.waitForFunction(() => document.querySelector('[data-room-caption]')?.textContent === 'Your API workspace');
  await page.waitForTimeout(700);
  assert(await page.locator('.room-stage').evaluate(element=>element.getBoundingClientRect().top >= 0), 'Room must remain visible during chapter navigation');
  await page.screenshot({ path: 'tmp/room-check/api.png' });
  await page.locator('[data-room-jump="0"]').click();
  await page.waitForFunction(() => document.querySelector('[data-room-counter]')?.textContent === '01 / 04');
  console.log('Room models, forward and backward camera navigation passed');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base + '/#landing', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-room-status]')?.textContent === 'Workspace ready · scroll to explore');
  await page.evaluate(() => scrollTo(0, innerHeight));
  await page.waitForTimeout(500);
  await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().right <= 0);
  await page.screenshot({ path: 'tmp/room-check/mobile.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-room-jump="3"]').click();
  await page.waitForFunction(() => document.querySelector('[data-room-counter]')?.textContent === '04 / 04');
  console.log('Mobile and reduced-motion chapter navigation passed');
  await page.goto(base + '/#public-apis', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.external-api-card').count(), 8);
  await page.locator('[data-public-get="dog"]').click();
  await page.waitForFunction(() => document.querySelector('[data-public-example="dog"] .external-api-result')?.textContent.includes('HTTP 200'), { timeout: 15000 });
  assert.equal(await page.locator('[data-public-example="dog"] .external-api-result img').count(), 1);
  console.log('Public dog API returned real HTTP 200 and image');
  assert.equal(errors.length, 0, errors.join('\n'));
} catch (error) {
  console.log('Failure diagnostics:', await page.locator('[data-room-status]').allTextContents().catch(()=>[]), errors, error.message);
  await page.screenshot({ path: 'tmp/room-check/failure.png' });
  throw error;
} finally {
  await browser.close();
}
