// Shared Playwright launcher with WebGL enabled in headless Chromium (SwiftShader fallback).
import { chromium } from 'playwright';

export async function launch() {
  return chromium.launch({
    headless: process.env.HEADED ? false : true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
}

// Opens a page that fails loudly on console errors, page errors and any request that leaves 127.0.0.1.
export async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  const external = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1' && u.protocol !== 'data:' && u.protocol !== 'blob:') external.push(r.url()); });
  await page.goto(url, { waitUntil: 'load' });
  return { page, errors, external };
}
