import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src');
const BACKGROUND = pathToFileURL(path.join(SRC, 'background.js')).href;

const etsy = await import(pathToFileURL(path.join(SRC, 'lib', 'etsy.js')).href);
const settingsLib = await import(pathToFileURL(path.join(SRC, 'lib', 'settings.js')).href);

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

const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

const ALL_ON = { enabled: true, filters: { explicit: true, bestSeller: true, instantDownload: true } };
const ALL = 'explicit=1&is_best_seller=true&instant_download=true';

let workerSeq = 0;

async function bootWorker(seed = {}) {
  const listeners = {};
  const on = (key) => ({ addListener: (fn) => (listeners[key] = listeners[key] || []).push(fn) });
  const areas = {
    sync: { ...(seed.sync || {}) },
    local: { ...(seed.local || {}) },
    session: { ...(seed.session || {}) },
  };
  const updates = [];
  const badge = { text: null };

  const area = (name) => ({
    get: async (key) => (key in areas[name] ? { [key]: areas[name][key] } : {}),
    set: async (obj) => {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: areas[name][k], newValue: v };
        areas[name][k] = v;
      }
      for (const fn of listeners['storage.onChanged'] || []) fn(changes, name);
    },
  });

  globalThis.chrome = {
    storage: { sync: area('sync'), local: area('local'), session: area('session'), onChanged: on('storage.onChanged') },
    webNavigation: { onBeforeNavigate: on('nav.before'), onHistoryStateUpdated: on('nav.history') },
    tabs: { onRemoved: on('tabs.removed'), update: async (tabId, props) => updates.push({ tabId, url: props.url }) },
    commands: { onCommand: on('command') },
    runtime: { onInstalled: on('installed'), onStartup: on('startup') },
    action: { setBadgeText: ({ text }) => (badge.text = text), setBadgeBackgroundColor: () => {} },
  };

  await import(`${BACKGROUND}?worker=${workerSeq++}`);
  await settle();

  const fire = async (key, ...args) => {
    for (const fn of listeners[key] || []) await fn(...args);
    await settle();
  };

  return { fire, updates, badge, areas, chrome: globalThis.chrome };
}

const nav = (tabId, url, frameId = 0) => ({ tabId, url, frameId });
const lastUrl = (updates) => (updates.length ? updates[updates.length - 1].url : null);

console.log('--- pure logic ---');

check('parseSearchUrl accepts a plain search', etsy.parseSearchUrl('https://www.etsy.com/search?q=a')?.pathname, '/search');
check('parseSearchUrl accepts a locale prefix', etsy.parseSearchUrl('https://www.etsy.com/de-en/search?q=a')?.pathname, '/de-en/search');
check('parseSearchUrl accepts a scoped search', etsy.parseSearchUrl('https://www.etsy.com/search/home-and-living?q=a')?.pathname, '/search/home-and-living');
check('parseSearchUrl rejects category pages', etsy.parseSearchUrl('https://www.etsy.com/c/jewelry'), null);
check('parseSearchUrl rejects /searchable', etsy.parseSearchUrl('https://www.etsy.com/searchable/x'), null);
check('parseSearchUrl rejects lookalike hosts', etsy.parseSearchUrl('https://etsy.com.evil.test/search?q=a'), null);
check('parseSearchUrl rejects notetsy.com', etsy.parseSearchUrl('https://www.notetsy.com/search?q=a'), null);
check('parseSearchUrl rejects non-http schemes', etsy.parseSearchUrl('javascript:alert(1)'), null);
check('parseSearchUrl rejects junk input', etsy.parseSearchUrl(undefined), null);
check('searchTermOf trims and lowercases', etsy.searchTermOf(new URL('https://www.etsy.com/search?q=%20Mugs%20')), 'mugs');

check(
  'urlWithFilters keeps param order',
  etsy.urlWithFilters(new URL('https://www.etsy.com/search?q=mugs'), ALL_ON).href,
  `https://www.etsy.com/search?q=mugs&${ALL}`
);
check(
  'urlWithFilters only adds the enabled filters',
  etsy.urlWithFilters(new URL('https://www.etsy.com/search?q=mugs'), {
    enabled: true,
    filters: { explicit: false, bestSeller: true, instantDownload: false },
  }).href,
  'https://www.etsy.com/search?q=mugs&is_best_seller=true'
);
check(
  'urlWithFilters never overwrites a user value',
  etsy.urlWithFilters(new URL('https://www.etsy.com/search?q=mugs&explicit=0'), ALL_ON).href,
  'https://www.etsy.com/search?q=mugs&explicit=0&is_best_seller=true&instant_download=true'
);
check('urlWithFilters returns null when nothing is missing', etsy.urlWithFilters(new URL(`https://www.etsy.com/search?q=a&${ALL}`), ALL_ON), null);
check('urlWithFilters returns null when disabled', etsy.urlWithFilters(new URL('https://www.etsy.com/search?q=a'), { ...ALL_ON, enabled: false }), null);

check('tabStatus: not a search', etsy.tabStatus('https://www.etsy.com/c/jewelry', ALL_ON).status, 'notSearch');
check('tabStatus: undefined url', etsy.tabStatus(undefined, ALL_ON).status, 'notSearch');
check('tabStatus: master off', etsy.tabStatus('https://www.etsy.com/search?q=a', { ...ALL_ON, enabled: false }).status, 'disabled');
check(
  'tabStatus: every filter off',
  etsy.tabStatus('https://www.etsy.com/search?q=a', { enabled: true, filters: { explicit: false, bestSeller: false, instantDownload: false } }).status,
  'noFilters'
);
check('tabStatus: filters present', etsy.tabStatus(`https://www.etsy.com/search?q=a&${ALL}`, ALL_ON).status, 'active');
check('tabStatus: filters missing', etsy.tabStatus('https://www.etsy.com/search?q=a', ALL_ON).status, 'missing');
check(
  'tabStatus: only the enabled filters have to be present',
  etsy.tabStatus('https://www.etsy.com/search?q=a&is_best_seller=true', {
    enabled: true,
    filters: { explicit: false, bestSeller: true, instantDownload: false },
  }).status,
  'active'
);

check('normalizeSettings fills defaults', settingsLib.normalizeSettings(undefined), ALL_ON);
check('normalizeSettings keeps explicit false', settingsLib.normalizeSettings({ enabled: true, filters: { explicit: false } }), {
  enabled: true,
  filters: { explicit: false, bestSeller: true, instantDownload: true },
});
check('normalizeSettings drops unknown keys', settingsLib.normalizeSettings({ enabled: false, filters: { nope: true } }), {
  enabled: false,
  filters: { explicit: true, bestSeller: true, instantDownload: true },
});

console.log('\n--- locales and manifest ---');

const LOCALES = (await readdir(path.join(SRC, '_locales'))).filter((name) => !name.startsWith('.')).sort();
const readJson = async (...parts) => JSON.parse(await readFile(path.join(SRC, ...parts), 'utf8'));
const messages = Object.fromEntries(await Promise.all(LOCALES.map(async (l) => [l, await readJson('_locales', l, 'messages.json')])));
const manifest = await readJson('manifest.json');
const baseKeys = Object.keys(messages.en).sort();

for (const locale of LOCALES) {
  const entries = messages[locale];
  check(`${locale}: same keys as en`, Object.keys(entries).sort(), baseKeys);
  check(`${locale}: no empty message`, Object.values(entries).every((entry) => entry.message?.trim().length > 0), true);
  check(`${locale}: description fits the store limit`, entries.extDescription.message.length <= 132, true);
  check(`${locale}: name fits the store limit`, entries.extName.message.length <= 45, true);
  check(
    `${locale}: shortcut placeholder is wired`,
    entries.shortcutHint.message.includes('$SHORTCUT$') && entries.shortcutHint.placeholders?.shortcut?.content === '$1',
    true
  );
  check(`${locale}: the Etsy disclaimer is present`, entries.disclaimer.message.includes('Etsy, Inc'), true);
}

const manifestKeys = JSON.stringify(manifest).match(/__MSG_([A-Za-z0-9_]+)__/g) || [];
check(
  'every manifest message key exists',
  manifestKeys.map((token) => token.slice(6, -2)).every((key) => key in messages.en),
  true
);
check('the popup declares every filter message key', etsy.FILTERS.every((filter) => filter.messageKey in messages.en), true);
check('manifest version is store-shaped', /^\d+\.\d+\.\d+$/.test(manifest.version), true);
check('the service worker is a module', manifest.background.type, 'module');
check('no broad host permissions', manifest.host_permissions, ['*://*.etsy.com/*']);
check('no content scripts are declared', 'content_scripts' in manifest, false);

console.log('\n--- service worker ---');

{
  const env = await bootWorker();
  await env.fire('nav.before', nav(1, 'https://www.etsy.com/search?q=mugs'));
  check('new search is filtered', lastUrl(env.updates), `https://www.etsy.com/search?q=mugs&${ALL}`);

  const count = env.updates.length;
  await env.fire('nav.before', nav(1, lastUrl(env.updates)));
  check('the redirect does not loop', env.updates.length, count);

  await env.fire('nav.history', nav(1, 'https://www.etsy.com/search?q=mugs&explicit=1'));
  check('unticking a filter on the same search is respected', env.updates.length, count);

  await env.fire('nav.before', nav(1, 'https://www.etsy.com/search?q=mugs&page=2&explicit=1'));
  check('paging the same search is respected', env.updates.length, count);

  await env.fire('nav.before', nav(1, 'https://www.etsy.com/search?q=shirts'));
  check('a new term is filtered again', lastUrl(env.updates), `https://www.etsy.com/search?q=shirts&${ALL}`);
}

{
  const env = await bootWorker();
  for (const url of [
    'https://www.etsy.com/c/jewelry',
    'https://www.etsy.com/listing/12345/thing',
    'https://www.etsy.com/shop/PixelHypeStudio',
    'https://www.etsy.com/market/mugs',
    'https://www.etsy.com/',
  ]) {
    await env.fire('nav.before', nav(2, url));
  }
  await env.fire('nav.before', nav(2, 'https://www.etsy.com/search?q=x', 1));
  await env.fire('nav.before', nav(2, 'https://www.notetsy.com/search?q=x'));
  check('non-search pages, sub-frames and other hosts are ignored', env.updates.length, 0);
}

{
  const env = await bootWorker();
  await env.fire('nav.before', nav(3, 'https://www.etsy.com/de-en/search?q=tag'));
  check('locale-prefixed search is filtered', lastUrl(env.updates), `https://www.etsy.com/de-en/search?q=tag&${ALL}`);
  await env.fire('nav.before', nav(4, 'https://www.etsy.com/search/home-and-living?q=vase'));
  check('scoped search is filtered', lastUrl(env.updates), `https://www.etsy.com/search/home-and-living?q=vase&${ALL}`);
  await env.fire('nav.before', nav(5, 'https://www.etsy.com/search'));
  check('bare search page is filtered', lastUrl(env.updates), `https://www.etsy.com/search?${ALL}`);
}

{
  const env = await bootWorker({ sync: { settings: { enabled: false, filters: { explicit: true, bestSeller: true, instantDownload: true } } } });
  await env.fire('nav.before', nav(6, 'https://www.etsy.com/search?q=mugs'));
  check('master off does nothing', env.updates.length, 0);
  check('badge reads OFF', env.badge.text, 'OFF');
}

{
  const env = await bootWorker({ sync: { settings: { enabled: true, filters: { explicit: false, bestSeller: true, instantDownload: false } } } });
  await env.fire('nav.before', nav(7, 'https://www.etsy.com/search?q=mugs'));
  check('only the enabled filters are injected', lastUrl(env.updates), 'https://www.etsy.com/search?q=mugs&is_best_seller=true');
  check('badge is clear while enabled', env.badge.text, '');
}

{
  const env = await bootWorker({ sync: { settings: { enabled: true, filters: { explicit: false, bestSeller: false, instantDownload: false } } } });
  await env.fire('nav.before', nav(8, 'https://www.etsy.com/search?q=mugs'));
  check('every filter off means no redirect', env.updates.length, 0);
}

{
  const env = await bootWorker();
  await env.fire('nav.before', nav(9, 'https://www.etsy.com/search?q=mugs'));
  await env.fire('nav.before', nav(9, lastUrl(env.updates)));
  await env.chrome.storage.sync.set({ settings: { enabled: true, filters: { explicit: false, bestSeller: true, instantDownload: true } } });
  await settle();
  await env.fire('nav.before', nav(9, 'https://www.etsy.com/search?q=mugs'));
  check(
    'changing settings re-applies on the next navigation, without the filter just turned off',
    lastUrl(env.updates),
    'https://www.etsy.com/search?q=mugs&is_best_seller=true&instant_download=true'
  );
  const after = env.updates.length;
  await env.fire('nav.before', nav(9, 'https://www.etsy.com/search?q=mugs&is_best_seller=true'));
  check('and then the same search is left alone again', env.updates.length, after);
}

{
  const env = await bootWorker({ sync: { settings: { enabled: false, filters: { explicit: true, bestSeller: true, instantDownload: true } } } });
  await env.fire('command', 'toggle-filters');
  check('the keyboard command turns the master switch on', env.areas.sync.settings.enabled, true);
  check('the badge follows the command', env.badge.text, '');
  await env.fire('command', 'toggle-filters');
  check('the command toggles back off', env.areas.sync.settings.enabled, false);
  await env.fire('command', 'some-other-command');
  check('unrelated commands are ignored', env.areas.sync.settings.enabled, false);
}

{
  const env = await bootWorker();
  await env.fire('nav.before', nav(10, 'https://www.etsy.com/search?q=mugs'));
  await env.fire('nav.before', nav(10, lastUrl(env.updates)));
  await env.fire('tabs.removed', 10, {});
  const count = env.updates.length;
  await env.fire('nav.before', nav(10, 'https://www.etsy.com/search?q=mugs'));
  check('a reused tab id counts as a new search', env.updates.length, count + 1);
}

{
  const env = await bootWorker();
  await env.fire('nav.before', nav(11, 'https://www.etsy.com/search?q=mugs'));
  const revived = await bootWorker({ session: env.areas.session });
  await revived.fire('nav.history', nav(11, 'https://www.etsy.com/search?q=mugs&explicit=1'));
  check('per-tab memory survives a worker restart', revived.updates.length, 0);
}

{
  const env = await bootWorker();
  await env.fire('nav.before', nav(12, 'https://www.etsy.com/search?q=Mugs%20'));
  const count = env.updates.length;
  await env.fire('nav.history', nav(12, 'https://www.etsy.com/search?q=mugs&explicit=1'));
  check('term matching ignores case and padding', env.updates.length, count);
}

{
  const env = await bootWorker();
  await env.fire('installed', { reason: 'install' });
  check('install seeds the default settings', env.areas.sync.settings, ALL_ON);
}

console.log(failures ? `\n${failures} of ${checks} failing` : `\nall green (${checks} checks)`);
process.exit(failures ? 1 : 0);
