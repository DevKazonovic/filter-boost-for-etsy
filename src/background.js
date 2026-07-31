import { parseSearchUrl, searchTermOf, urlWithFilters } from './lib/etsy.js';
import { readSettings, writeSettings, onSettingsChanged, normalizeSettings, SETTINGS_KEY } from './lib/settings.js';

const TAB_TERMS_KEY = 'tabSearchTerms';
const ETSY_FILTER = { url: [{ hostSuffix: 'etsy.com' }] };

let settings = null;
let tabTerms = null;
let writeChain = Promise.resolve();

function persistTabTerms() {
  const snapshot = { ...tabTerms };
  writeChain = writeChain.then(() => chrome.storage.session.set({ [TAB_TERMS_KEY]: snapshot })).catch(() => {});
}

async function warmCaches() {
  const [loaded, session] = await Promise.all([
    readSettings(),
    chrome.storage.session.get(TAB_TERMS_KEY).catch(() => ({})),
  ]);
  if (settings === null) settings = loaded;
  if (tabTerms === null) tabTerms = session[TAB_TERMS_KEY] || {};
  return settings;
}

function updateBadge() {
  const off = !settings?.enabled;
  Promise.resolve(chrome.action.setBadgeText({ text: off ? 'OFF' : '' })).catch(() => {});
  Promise.resolve(chrome.action.setBadgeBackgroundColor({ color: '#6B7280' })).catch(() => {});
}

function processNavigation(details) {
  if (details.frameId !== 0) return;

  const url = parseSearchUrl(details.url);
  if (!url) return;

  const term = searchTermOf(url);
  if (tabTerms[details.tabId] === term) return;

  tabTerms[details.tabId] = term;
  persistTabTerms();

  const target = urlWithFilters(url, settings);
  if (!target) return;

  Promise.resolve(chrome.tabs.update(details.tabId, { url: target.href })).catch(() => {});
}

function onNavigation(details) {
  if (settings === null || tabTerms === null) {
    warmCaches().then(() => processNavigation(details));
    return;
  }
  processNavigation(details);
}

chrome.webNavigation.onBeforeNavigate.addListener(onNavigation, ETSY_FILTER);
chrome.webNavigation.onHistoryStateUpdated.addListener(onNavigation, ETSY_FILTER);

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!tabTerms || !(tabId in tabTerms)) return;
  delete tabTerms[tabId];
  persistTabTerms();
});

onSettingsChanged((next) => {
  settings = next;
  tabTerms = {};
  persistTabTerms();
  updateBadge();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-filters') return;
  const current = await warmCaches();
  await writeSettings({ ...current, enabled: !current.enabled });
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  if (!stored[SETTINGS_KEY]) await writeSettings(normalizeSettings(null));
  await warmCaches();
  updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await warmCaches();
  updateBadge();
});

warmCaches().then(updateBadge);
