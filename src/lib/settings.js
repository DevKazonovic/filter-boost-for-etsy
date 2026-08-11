import { FILTERS } from './etsy.js';

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  filters: Object.freeze(Object.fromEntries(FILTERS.map((filter) => [filter.id, true]))),
  hideAds: false,
});

export function normalizeSettings(raw) {
  const filters = {};
  for (const filter of FILTERS) {
    filters[filter.id] = raw?.filters?.[filter.id] !== false;
  }
  return { enabled: raw?.enabled !== false, filters, hideAds: raw?.hideAds === true };
}

export async function readSettings() {
  try {
    const stored = await chrome.storage.sync.get(SETTINGS_KEY);
    return normalizeSettings(stored[SETTINGS_KEY]);
  } catch {
    return normalizeSettings(null);
  }
}

export async function writeSettings(settings) {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

export function onSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
    callback(normalizeSettings(changes[SETTINGS_KEY].newValue));
  });
}
