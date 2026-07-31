import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..', 'src');
const PORT = 8971;

let failures = 0;
let checks = 0;

function check(name, actual, expected) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${e}\n      actual   ${a}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALL = 'explicit=1&is_best_seller=true&instant_download=true';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><title>stub</title><body>${req.url}</body>`);
});

async function launch(extraArgs = []) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--host-resolver-rules=MAP www.etsy.com 127.0.0.1:${PORT}, MAP etsy.com 127.0.0.1:${PORT}, MAP notetsy.com 127.0.0.1:${PORT}`,
      '--no-sandbox',
      ...extraArgs,
    ],
  });
  const target = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 20000 });
  const worker = await target.worker();

  const workerErrors = [];
  const session = await target.createCDPSession();
  await session.send('Runtime.enable');
  session.on('Runtime.exceptionThrown', (event) => workerErrors.push(event.exceptionDetails.text));
  session.on('Runtime.consoleAPICalled', (event) => {
    if (event.type === 'error') workerErrors.push(event.args.map((arg) => arg.value).join(' '));
  });

  await sleep(400);
  return { browser, worker, workerErrors, popupUrl: target.url().replace('background.js', 'popup.html') };
}

function watchPage(page, sink) {
  page.on('pageerror', (error) => sink.push(String(error.message)));
  page.on('console', (message) => {
    if (message.type() === 'error') sink.push(message.text());
  });
}

async function settledUrl(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (err) {
    if (!String(err.message).includes('ERR_ABORTED')) throw err;
  }
  let seen = page.url();
  for (let i = 0; i < 12; i++) {
    await sleep(150);
    const now = page.url();
    if (now === seen && i > 3) break;
    seen = now;
  }
  return seen;
}

await new Promise((r) => server.listen(PORT, r));

const { browser, worker, workerErrors, popupUrl } = await launch();
const pageErrors = [];

console.log('--- manifest ---');
const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
check('the localized name resolves', manifest.name, 'Filter Boost for Etsy');
check('the localized description resolves', manifest.description.startsWith('Applies your preferred Etsy'), true);
check('description fits the store limit', manifest.description.length <= 132, true);
check('permissions stay minimal', manifest.permissions.sort(), ['storage', 'webNavigation']);
check('host access is Etsy only', manifest.host_permissions, ['*://*.etsy.com/*']);
check('the toggle command is registered', Object.keys(manifest.commands), ['toggle-filters']);

console.log('\n--- navigation ---');
const page = await browser.newPage();

check(
  'a new search gets every filter',
  await settledUrl(page, 'http://www.etsy.com/search?q=mugs'),
  `http://www.etsy.com/search?q=mugs&${ALL}`
);
check(
  'the same search after unticking is left alone',
  await settledUrl(page, 'http://www.etsy.com/search?q=mugs&explicit=1'),
  'http://www.etsy.com/search?q=mugs&explicit=1'
);
check(
  'a new term is filtered again',
  await settledUrl(page, 'http://www.etsy.com/search?q=stickers'),
  `http://www.etsy.com/search?q=stickers&${ALL}`
);
check(
  'listing pages are untouched',
  await settledUrl(page, 'http://www.etsy.com/listing/12345/thing'),
  'http://www.etsy.com/listing/12345/thing'
);
check(
  'other hosts are untouched',
  await settledUrl(page, 'http://notetsy.com/search?q=mugs'),
  'http://notetsy.com/search?q=mugs'
);

console.log('\n--- permissions ---');
await settledUrl(page, 'http://www.etsy.com/search?q=lamps');
const seenUrl = await worker.evaluate(async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.url ?? null;
});
check('the extension can read the URL of an Etsy tab without the tabs permission', String(seenUrl).includes('/search?q=lamps'), true);

console.log('\n--- per filter control ---');
await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: true, filters: { explicit: false, bestSeller: true, instantDownload: false } } })
);
await sleep(400);
check(
  'only the enabled filter is injected',
  await settledUrl(page, 'http://www.etsy.com/search?q=candles'),
  'http://www.etsy.com/search?q=candles&is_best_seller=true'
);

await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: false, filters: { explicit: true, bestSeller: true, instantDownload: true } } })
);
await sleep(400);
check(
  'the master switch off leaves searches alone',
  await settledUrl(page, 'http://www.etsy.com/search?q=posters'),
  'http://www.etsy.com/search?q=posters'
);
check('the badge reads OFF', await worker.evaluate(() => chrome.action.getBadgeText({})), 'OFF');

await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: true, filters: { explicit: true, bestSeller: true, instantDownload: true } } })
);
await sleep(400);
check('the badge clears when re-enabled', await worker.evaluate(() => chrome.action.getBadgeText({})), '');
check(
  're-enabling filters the very next search',
  await settledUrl(page, 'http://www.etsy.com/search?q=posters'),
  `http://www.etsy.com/search?q=posters&${ALL}`
);

console.log('\n--- popup ---');
const popup = await browser.newPage();
watchPage(popup, pageErrors);
await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
await sleep(400);

check('the popup title is localized', await popup.$eval('h1', (el) => el.textContent), 'Filter Boost for Etsy');
check('every filter has its own row', await popup.$$eval('#filters li', (rows) => rows.length), 3);
check(
  'the rows are labelled and show their param',
  await popup.$$eval('#filters li', (rows) => rows.map((row) => `${row.querySelector('.row-title').textContent}|${row.querySelector('code').textContent}`)),
  ['Explicit results|explicit=1', 'Bestseller|is_best_seller=true', 'Instant download|instant_download=true']
);
check(
  'all switches start on',
  await popup.$$eval('.switch-input', (inputs) => inputs.every((input) => input.checked)),
  true
);
check('the status line renders', await popup.$eval('#statusText', (el) => el.textContent.length > 0), true);
check('the disclaimer is present', await popup.$eval('.disclaimer', (el) => el.textContent), 'Not affiliated with Etsy, Inc. Etsy is a trademark of Etsy, Inc.');
check('no string is left untranslated', await popup.$$eval('[data-i18n]', (els) => els.every((el) => el.textContent.trim().length > 0)), true);

await popup.click('label[for="filter-explicit"]');
await sleep(300);
check(
  'toggling a filter row writes it to sync storage',
  await worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings.filters.explicit),
  false
);
check(
  'the other filters are untouched',
  await worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings.filters.bestSeller),
  true
);

await popup.click('label[for="master"]');
await sleep(300);
check(
  'toggling the master switch writes it to sync storage',
  await worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings.enabled),
  false
);
check(
  'the filter rows are disabled while the master switch is off',
  await popup.$$eval('#filters .switch-input', (inputs) => inputs.every((input) => input.disabled)),
  true
);
check('the status reports the off state', await popup.$eval('#statusText', (el) => el.textContent), 'Filters are turned off');

console.log('\n--- live status and apply ---');
await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: true, filters: { explicit: true, bestSeller: true, instantDownload: true } } })
);
await sleep(300);
await settledUrl(page, 'http://www.etsy.com/search?q=frames');
await page.bringToFront();
await popup.reload({ waitUntil: 'domcontentloaded' });
await sleep(400);
check('the popup sees the filtered search in the active tab', await popup.$eval('#statusText', (el) => el.textContent), 'Filters are active on this search');
check('no apply button is offered when nothing is missing', await popup.$eval('#apply', (el) => el.hidden), true);

await settledUrl(page, 'http://www.etsy.com/search?q=frames&explicit=1');
await page.bringToFront();
await popup.reload({ waitUntil: 'domcontentloaded' });
await sleep(400);
check('the popup reports a search that is missing filters', await popup.$eval('#statusText', (el) => el.textContent), 'This search is missing your filters');
check('the apply button is offered', await popup.$eval('#apply', (el) => el.hidden), false);

const clickOutcome = await popup
  .evaluate(() => {
    document.getElementById('apply').click();
    return 'clicked';
  })
  .catch((error) => String(error.message));
check('the apply button accepts a click', clickOutcome, 'clicked');
await sleep(1200);
check(
  'apply adds the missing filters to the current tab',
  page.url(),
  'http://www.etsy.com/search?q=frames&explicit=1&is_best_seller=true&instant_download=true'
);

console.log('\n--- runtime health ---');
check('the service worker logged no errors', workerErrors, []);
check('the popup logged no errors', pageErrors, []);

await browser.close();
server.close();
console.log(failures ? `\n${failures} of ${checks} failing` : `\nall green (${checks} checks)`);
process.exit(failures ? 1 : 0);
