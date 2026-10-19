// Captures the Play screenshots (1080x1920) from the Expo web build on MOCK data.
// 1. Start Expo web on mock data: EXPO_PUBLIC_API_MODE=mock npx expo start --web --port 8095 --clear
// 2. In a folder with puppeteer-core@23 installed: node play-screenshots.mjs <outDir>
// Uses the installed Microsoft Edge (headless, its own profile). Sample data only.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const OUT = process.argv[2];
const BASE = 'http://localhost:8095';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  userDataDir: path.join(OUT, '..', 'edge-profile'),
  args: ['--hide-scrollbars', '--no-first-run'],
});
const page = await browser.newPage();
// 405x720 CSS px at 8/3 = exactly 1080x1920, closer to a modern phone's width than 360.
await page.setViewport({ width: 405, height: 720, deviceScaleFactor: 8 / 3, isMobile: true, hasTouch: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(ms = 1200) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await sleep(ms);
}
async function shot(name, { blur = true } = {}) {
  await settle();
  // Drop focus rings and the mock-only "Offline demo" hints, which the real app never shows.
  await page.evaluate((blur) => {
    if (blur && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    for (const e of [...document.querySelectorAll('div')]) {
      if (/^Offline demo/.test((e.innerText || '').trim()) && e.children.length <= 3 && e.innerText.length < 120) e.style.visibility = 'hidden';
    }
  }, blur);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name);
}
/** Clicks the smallest visible element whose text or aria-label equals/starts with `text`. */
async function click(text, { starts = false } = {}) {
  const box = await page.evaluate((text, starts) => {
    const els = [...document.querySelectorAll('div,button,a,span,input')].filter((e) => {
      const t = (e.getAttribute('aria-label') || e.innerText || '').trim();
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (starts ? t.startsWith(text) : t === text);
    });
    els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    const e = els[0];
    if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, text, starts);
  if (!box) throw new Error(`not found: ${text}`);
  await page.mouse.click(box.x, box.y);
  await sleep(500);
}
async function typeInto(labelOrPlaceholder, value) {
  const sel = `input[aria-label="${labelOrPlaceholder}"], input[placeholder="${labelOrPlaceholder}"]`;
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.click(sel, { clickCount: 3 });
  await page.type(sel, value, { delay: 15 });
}
async function go(url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 120000 });
  await settle(2500);
}
const scrollTop = () => page.evaluate(() => document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }));

// 1 Gateway
await go('/');
await shot('01-gateway');

// 2-3 Clearance (public lookup: status and QR only)
await go('/d/devdept/clearance');
await typeInto('Student ID or email', 'DEV-2026-0001');
await page.keyboard.press('Enter');
await sleep(1500);
await shot('02-cleared');
await typeInto('Student ID or email', 'DEV-2026-0002');
await page.keyboard.press('Enter');
await sleep(1500);
await shot('03-on-hold');

// 4 Send receipt
await go('/d/devdept/submit-proof?studentId=DEV-2026-0002');
await click('Org Shirt', { starts: true });
await typeInto('Reference number', '7731 0042 1188');
await scrollTop();
await shot('04-send-receipt');

// 5 Officer sign-in code (mock officer; the demo code is not a credential)
await go('/d/devdept/sign-in');
await typeInto('Your officer email', 'treasurer@devdept.local');
await page.keyboard.press('Enter');
await sleep(1500);
await page.focus('input[autocomplete="one-time-code"]').catch(() => {});
await page.keyboard.type('325', { delay: 40 });
await sleep(400);
await shot('05-sign-in-code', { blur: false });
await page.focus('input[autocomplete="one-time-code"]');
for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
await page.keyboard.type('123456', { delay: 40 });
await sleep(3000);

// 6 Officer home
await shot('06-officer-home');

// 7 Review a proof
await click('Verify', { starts: true });
await sleep(1500);
await click('Ben Santos', { starts: true });
await sleep(1500);
await typeInto('OR number you’re issuing', 'OR-2026-000185');
await scrollTop();
await shot('07-review-proof');

// 8 Verified
await click('Verify & send OR');
await sleep(2500);
await shot('08-verified');

await browser.close();
