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
const ALL = 'explicit=1&is_best_seller=true&instant_download=true&order=date_desc';

const SEARCH_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?search(?:\/|$)/;

function card(id, promoted) {
  const href = promoted
    ? `https://www.etsy.com/listing/${id}/thing?ls=a&ref=search_grid-1&bes=1`
    : `https://www.etsy.com/listing/${id}/thing?ls=s&ref=search_grid-1&content_source=abc`;
  const shopUrl = promoted ? `https://www.etsy.com/shop/Shop${id}?plkey=k${id}` : `https://www.etsy.com/shop/Shop${id}`;
  const titleId = `${promoted ? 'ad-' : ''}listing-title-${id}`;
  const group = promoted ? `data-logger-id="log${id}"` : 'data-appears-component-name="search2_organic_listings_group"';
  const source = promoted ? 'ads' : 'search';
  return `<li class="wt-list-unstyled wt-grid__item-xs-6">
  <div ${group} class="wt-height-full">
    <div class="v2-listing-card" data-listing-id="${id}" data-shop-id="90${id}">
      <a class="v2-listing-card__img" data-listing-id="${id}" href="${href}"><img alt="thing ${id}" /></a>
      <div class="v2-listing-card__info">
        <h3 id="${titleId}">Thing ${id}</h3>
        <p><span aria-hidden="true"><button type="button">${promoted ? 'Ad<strong>・</strong>By ' : 'By '}<span data-shop-url="${shopUrl}">Shop${id}</span></button></span><span class="wt-screen-reader-only">${promoted ? 'Ad from shop' : 'From shop'} Shop${id}</span></p>
      </div>
      <form action="/cart/listing.php" method="post">
        <input type="hidden" name="listing_id" value="${id}" />
        <input type="hidden" name="is_pl" value="${promoted}" />
        <input type="hidden" name="listing_source" value="${source}" />
        <button type="submit" aria-describedby="${titleId}">Add to cart</button>
      </form>
      <button data-ui="favorite-listing-button" data-listing-id="${id}" data-listing-source="${source}">Fav</button>
    </div>
  </div>
</li>`;
}

function conflictedCard(id) {
  return `<li class="wt-list-unstyled wt-grid__item-xs-6">
  <div class="v2-listing-card" data-listing-id="${id}">
    <a data-listing-id="${id}" href="https://www.etsy.com/listing/${id}/thing?ls=a&ref=x"><img alt="thing ${id}" /></a>
    <h3 id="listing-title-${id}">Conflicted ${id}</h3>
    <input type="hidden" name="is_pl" value="false" />
  </div>
</li>`;
}

function topBlockAd(id) {
  return `<div class="ad-block-item">
  <a class="v2-listing-card__img" data-listing-id="${id}" href="https://www.etsy.com/listing/${id}/thing?ls=a&ref=search_grid-1&pro=1&pop=1&dd=1">
    <img alt="thing ${id}" />
    <video data-listing-id="${id}" muted preload="none"></video>
    <span class="ranked-badges-position">Popular now</span>
  </a>
  <div class="v2-listing-card__info">
    <h3 id="listing-title-${id}">Top block ad ${id}</h3>
    <p><span class="wt-screen-reader-only">Ad from shop Shop${id}</span></p>
  </div>
  <button data-ui="favorite-listing-button" data-listing-id="${id}" data-listing-source="search">Fav</button>
</div>`;
}

function untaggedAd(id) {
  return `<div class="carousel-cell">
  <a href="https://www.etsy.com/listing/${id}/thing?ls=a&ref=search_grid-1&pro=1"><img alt="thing ${id}" /></a>
  <h3 id="listing-title-${id}">Untagged ad ${id}</h3>
  <p><span class="wt-screen-reader-only">Ad from shop Shop${id}</span></p>
</div>`;
}

function labelOnlyAd(id) {
  return `<li class="wt-list-unstyled wt-grid__item-xs-6">
  <div class="v2-listing-card" data-listing-id="${id}">
    <a data-listing-id="${id}" href="https://www.etsy.com/listing/${id}/thing?ls=s&ref=search_grid-9-1-1&pro=1&pop=1&content_source=abc"><img alt="thing ${id}" /></a>
    <h3 id="listing-title-${id}">Label only ad ${id}</h3>
    <p><span aria-hidden="true"><button type="button">Ad<strong>\u30fb</strong>By <span data-shop-url="https://www.etsy.com/shop/Shop${id}">Shop${id}</span></button></span></p>
    <form action="/cart/listing.php" method="post">
      <input type="hidden" name="listing_source" value="search" />
    </form>
    <button data-ui="favorite-listing-button" data-listing-id="${id}" data-listing-source="search">Fav</button>
  </div>
</li>`;
}

function splitLabelAd(id) {
  return `<li class="wt-list-unstyled wt-grid__item-xs-6">
  <div class="v2-listing-card" data-listing-id="${id}">
    <a data-listing-id="${id}" href="https://www.etsy.com/listing/${id}/thing?ls=s&content_source=abc"><img alt="thing ${id}" /></a>
    <h3 id="listing-title-${id}">Split label ad ${id}</h3>
    <div class="byline"><span>4.9</span><span>(1.1k)</span><span>Ad</span><span>\u2022</span><span>By</span><span>Shop${id}</span></div>
    <input type="hidden" name="is_pl" value="false" />
  </div>
</li>`;
}

function deck(mode, count, from = 0) {
  return Array.from({ length: count }, (_, i) => card(from + i, mode === 'allads' ? true : (from + i) % 3 === 0)).join('');
}

function searchPage(mode) {
  const body =
    mode === 'allads' ? deck('allads', 12, 1000) : mode === 'conflict' ? deck('mixed', 12, 1000) + conflictedCard(1099) : deck('mixed', 24, 1000);
  const topBlock =
    mode === 'topads'
      ? `<div id="topads">${[5000, 5001, 5002, 5003].map(topBlockAd).join('')}</div>` +
        `<div id="untagged">${[6000, 6001].map(untaggedAd).join('')}</div>` +
        `<ol id="labelonly">${[7000, 7001, 7002].map(labelOnlyAd).join('')}</ol>` +
        `<ol id="splitlabel">${[8000, 8001].map(splitLabelAd).join('')}</ol>`
      : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Etsy search</title>
<style>#results > li, #topads > div, #untagged > div, #labelonly > li, #splitlabel > li { display: block !important; }</style></head>
<body>
<button id="more" type="button">More</button>
<button id="renew" type="button">Renew</button>
${topBlock}
<ol id="results" class="wt-grid">${body}</ol>
<template id="moreCards">${deck('mixed', 4, 2000)}</template>
<template id="renewCards">${deck('mixed', 12, 3000)}</template>
<script>
document.getElementById('more').addEventListener('click', () => {
  document.getElementById('results').append(document.getElementById('moreCards').content.cloneNode(true));
});
document.getElementById('renew').addEventListener('click', () => {
  history.pushState({}, '', location.pathname + location.search + '&page=2');
  document.getElementById('results').replaceChildren(document.getElementById('renewCards').content.cloneNode(true));
});
</script>
</body></html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.writeHead(200, { 'content-type': 'text/html' });
  if (SEARCH_PATH.test(url.pathname)) {
    res.end(searchPage(url.searchParams.get('q') || 'mixed'));
    return;
  }
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
check('the localized description resolves', manifest.description.startsWith('Shapes Etsy search results'), true);
check('description fits the store limit', manifest.description.length <= 132, true);
check('permissions stay minimal', manifest.permissions.sort(), ['storage', 'webNavigation']);
check('host access is Etsy only', manifest.host_permissions, ['*://*.etsy.com/*']);
check('the toggle command is registered', Object.keys(manifest.commands), ['toggle-filters']);

check('the content script only reaches Etsy search paths', manifest.content_scripts[0].matches, [
  '*://*.etsy.com/search',
  '*://*.etsy.com/search?*',
  '*://*.etsy.com/search/*',
  '*://*.etsy.com/*/search',
  '*://*.etsy.com/*/search?*',
  '*://*.etsy.com/*/search/*',
]);

console.log('\n--- navigation ---');
const page = await browser.newPage();
watchPage(page, pageErrors);

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

console.log('\n--- hiding promoted listings ---');

const allOn = { explicit: true, bestSeller: true, instantDownload: true, newest: true };
const setSettings = (hideAds, enabled = true) =>
  worker.evaluate((filters, hideAdsValue, enabledValue) => chrome.storage.sync.set({ settings: { enabled: enabledValue, filters, hideAds: hideAdsValue } }), allOn, hideAds, enabled);

const grid = await browser.newPage();
watchPage(grid, pageErrors);
const hiddenCount = () => grid.$$eval('[data-filter-boost-hidden]', (els) => els.length);
const stripLabel = () => grid.$eval('#filter-boost-strip .filter-boost-strip__label', (el) => el.textContent).catch(() => null);
const hasStrip = async () => (await grid.$('#filter-boost-strip')) !== null;

await setSettings(false);
await sleep(300);
await settledUrl(grid, 'http://www.etsy.com/search?q=mixed');
await grid.bringToFront();
await sleep(400);
check('the fixture renders a full results grid', await grid.$$eval('#results li', (els) => els.length), 24);
check('nothing is hidden while the feature is off', await hiddenCount(), 0);
check('and no strip is shown', await hasStrip(), false);

await setSettings(true);
await sleep(600);
check('turning it on hides the promoted cards without a reload', await hiddenCount(), 8);
check('the strip reports what it removed', await stripLabel(), '8 promoted hidden');
check('organic cards are left alone', await grid.$$eval('#results li:not([data-filter-boost-hidden])', (els) => els.length), 16);
check(
  'hiding wins over an important rule in the page stylesheet',
  await grid.$$eval('[data-filter-boost-hidden]', (els) => els.every((el) => getComputedStyle(el).display === 'none')),
  true
);
check(
  'hidden cards stay in the document rather than being removed',
  await grid.$$eval('[data-filter-boost-hidden]', (els) => els.every((el) => el.querySelector('[data-listing-id]') !== null)),
  true
);

await grid.click('#filter-boost-strip .filter-boost-strip__button');
await sleep(300);
check('reveal puts them back', await hiddenCount(), 0);
check('and the strip flips its wording', await stripLabel(), '8 promoted shown');

await grid.click('#filter-boost-strip .filter-boost-strip__button');
await sleep(300);
check('hiding again works', await hiddenCount(), 8);

await grid.click('#more');
await sleep(600);
check('cards appended after load are covered too', await hiddenCount(), 9);
check('and the count follows', await stripLabel(), '9 promoted hidden');

await grid.click('#renew');
await sleep(600);
check('a same-page result set change resets the totals', await hiddenCount(), 4);
check('and the strip resets with it', await stripLabel(), '4 promoted hidden');
check('reveal does not carry over into the new result set', await grid.$eval('#filter-boost-strip .filter-boost-strip__button', (el) => el.textContent), 'Show');

await settledUrl(grid, 'http://www.etsy.com/search?q=allads');
await sleep(600);
check('a page where every card looks promoted hides nothing', await hiddenCount(), 0);
check('and says the detector could not be trusted', await stripLabel(), 'Promoted listings could not be identified here');

await settledUrl(grid, 'http://www.etsy.com/search?q=conflict');
await sleep(600);
check('a card carrying both an ad and an organic marker is left visible', await hiddenCount(), 4);

await settledUrl(grid, 'http://www.etsy.com/search?q=topads');
await sleep(600);
check('ads outside the grid list are hidden too', await hiddenCount(), 19);
check(
  'an ad whose label is split across separate elements is still hidden',
  await grid.$$eval('#splitlabel > li', (els) => els.every((el) => el.hasAttribute('data-filter-boost-hidden'))),
  true
);
check(
  'an ad Etsy serves with an organic attribution parameter is still hidden, because the card says Ad',
  await grid.$$eval('#labelonly > li', (els) => els.every((el) => el.hasAttribute('data-filter-boost-hidden'))),
  true
);
check(
  'an ad card with no listing id anywhere is still hidden',
  await grid.$$eval('#untagged > div', (els) => els.every((el) => el.hasAttribute('data-filter-boost-hidden'))),
  true
);
check(
  'and the whole ad card is hidden, not just its image link',
  await grid.$$eval('#topads > div', (els) => els.every((el) => el.hasAttribute('data-filter-boost-hidden'))),
  true
);
check(
  'a plain title prefix on an ad card no longer vetoes the hide',
  await grid.$$eval('#topads [id^="listing-title-"]', (els) => els.length),
  4
);

await settledUrl(grid, 'http://www.etsy.com/de-en/search?q=mixed');
await sleep(600);
check('a locale-prefixed search is covered', await hiddenCount(), 8);

await settledUrl(grid, 'http://www.etsy.com/searchable/thing');
await sleep(500);
check('lookalike paths get no content script', await hasStrip(), false);

await settledUrl(grid, 'http://www.etsy.com/search?q=mixed');
await sleep(600);
check('back on a real search it works again', await hiddenCount(), 8);

await setSettings(false);
await sleep(600);
check('turning it off restores every card in place', await hiddenCount(), 0);
check('and takes the strip away', await hasStrip(), false);

await setSettings(true, false);
await sleep(600);
check('the master switch off also stops it', await hiddenCount(), 0);
check('with no strip left behind', await hasStrip(), false);

await grid.close();

console.log('\n--- per filter control ---');
await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: true, filters: { explicit: false, bestSeller: true, instantDownload: false, newest: false } } })
);
await sleep(400);
check(
  'only the enabled filter is injected',
  await settledUrl(page, 'http://www.etsy.com/search?q=candles'),
  'http://www.etsy.com/search?q=candles&is_best_seller=true'
);

await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: false, filters: { explicit: true, bestSeller: true, instantDownload: true, newest: true } } })
);
await sleep(400);
check(
  'the master switch off leaves searches alone',
  await settledUrl(page, 'http://www.etsy.com/search?q=posters'),
  'http://www.etsy.com/search?q=posters'
);
check('the badge reads OFF', await worker.evaluate(() => chrome.action.getBadgeText({})), 'OFF');

await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: true, filters: { explicit: true, bestSeller: true, instantDownload: true, newest: true } } })
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
check('every filter has its own row', await popup.$$eval('#filters li', (rows) => rows.length), 4);
check(
  'the rows are labelled and show their param',
  await popup.$$eval('#filters li', (rows) => rows.map((row) => `${row.querySelector('.row-title').textContent}|${row.querySelector('code').textContent}`)),
  [
    'Explicit results|explicit=1',
    'Bestseller|is_best_seller=true',
    'Instant download|instant_download=true',
    'Newest first|order=date_desc',
  ]
);
check(
  'the URL filter switches start on',
  await popup.$$eval('#filters .switch-input', (inputs) => inputs.every((input) => input.checked)),
  true
);
check('ad hiding starts off', await popup.$eval('#hideAds', (el) => el.checked), false);
check('the two groups are labelled', await popup.$$eval('.group-label', (els) => els.map((el) => el.textContent)), [
  'Added to the search URL',
  'On the results page',
]);
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

await popup.click('label[for="hideAds"]');
await sleep(300);
check(
  'toggling ad hiding writes it to sync storage',
  await worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings.hideAds),
  true
);
await popup.click('label[for="hideAds"]');
await sleep(300);
check(
  'and toggling it back off writes that too',
  await worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings.hideAds),
  false
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
check('the ad hiding row is disabled too', await popup.$eval('#hideAds', (el) => el.disabled), true);
check('the status reports the off state', await popup.$eval('#statusText', (el) => el.textContent), 'Filters are turned off');

console.log('\n--- live status and apply ---');
await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: true, filters: { explicit: true, bestSeller: true, instantDownload: true, newest: true } } })
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
  'http://www.etsy.com/search?q=frames&explicit=1&is_best_seller=true&instant_download=true&order=date_desc'
);

console.log('\n--- update notice ---');
await worker.evaluate(() =>
  chrome.storage.sync.set({ settings: { enabled: true, filters: { explicit: true, bestSeller: true, instantDownload: true, newest: true } } })
);
await sleep(300);

const noticePopup = await browser.newPage();
watchPage(noticePopup, pageErrors);
await noticePopup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
await sleep(400);
check('no notice is shown on a fresh install', await noticePopup.$eval('#notice', (el) => el.hidden), true);

await worker.evaluate(() => chrome.storage.local.set({ pendingNote: '1.1.0' }));
await sleep(400);
check('the badge marks a pending note', await worker.evaluate(() => chrome.action.getBadgeText({})), '•');

await noticePopup.reload({ waitUntil: 'domcontentloaded' });
await sleep(400);
check('the popup shows the notice after an update', await noticePopup.$eval('#notice', (el) => el.hidden), false);
check('the notice names the version', await noticePopup.$eval('#noticeTitle', (el) => el.textContent), 'New in 1.1.0');
check('the notice explains the change', await noticePopup.$eval('#noticeText', (el) => el.textContent.includes('newest first')), true);

await noticePopup.evaluate(() => document.getElementById('dismiss').click());
await sleep(500);
check('dismissing hides the notice', await noticePopup.$eval('#notice', (el) => el.hidden), true);
check('dismissing clears the stored flag', await worker.evaluate(async () => (await chrome.storage.local.get('pendingNote')).pendingNote ?? null), null);
check('dismissing clears the badge', await worker.evaluate(() => chrome.action.getBadgeText({})), '');

await noticePopup.reload({ waitUntil: 'domcontentloaded' });
await sleep(400);
check('and it stays dismissed', await noticePopup.$eval('#notice', (el) => el.hidden), true);

console.log('\n--- runtime health ---');
check('the service worker logged no errors', workerErrors, []);
check('the popup logged no errors', pageErrors, []);

await browser.close();
server.close();
console.log(failures ? `\n${failures} of ${checks} failing` : `\nall green (${checks} checks)`);
process.exit(failures ? 1 : 0);
