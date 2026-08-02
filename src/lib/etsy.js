export const FILTERS = Object.freeze([
  Object.freeze({ id: 'explicit', param: 'explicit', value: '1', messageKey: 'filterExplicit' }),
  Object.freeze({ id: 'bestSeller', param: 'is_best_seller', value: 'true', messageKey: 'filterBestSeller' }),
  Object.freeze({ id: 'instantDownload', param: 'instant_download', value: 'true', messageKey: 'filterInstantDownload' }),
  Object.freeze({ id: 'newest', param: 'order', value: 'date_desc', messageKey: 'filterNewest' }),
]);

export const SEARCH_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?search(?:\/|$)/;

export function parseSearchUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.hostname !== 'etsy.com' && !url.hostname.endsWith('.etsy.com')) return null;
  if (!SEARCH_PATH.test(url.pathname)) return null;
  return url;
}

export function searchTermOf(url) {
  return (url.searchParams.get('q') || '').trim().toLowerCase();
}

export function activeFilters(settings) {
  if (!settings || settings.enabled === false) return [];
  return FILTERS.filter((filter) => settings.filters?.[filter.id] !== false);
}

export function missingFilters(url, settings) {
  return activeFilters(settings).filter((filter) => !url.searchParams.has(filter.param));
}

export function urlWithFilters(url, settings) {
  const missing = missingFilters(url, settings);
  if (!missing.length) return null;
  const next = new URL(url.href);
  for (const filter of missing) next.searchParams.set(filter.param, filter.value);
  return next;
}

export const TAB_STATUS = Object.freeze({
  NOT_SEARCH: 'notSearch',
  DISABLED: 'disabled',
  NO_FILTERS: 'noFilters',
  ACTIVE: 'active',
  MISSING: 'missing',
});

export function tabStatus(rawUrl, settings) {
  const url = parseSearchUrl(rawUrl);
  if (!settings || settings.enabled === false) return { status: TAB_STATUS.DISABLED, url, target: null };
  if (!activeFilters(settings).length) return { status: TAB_STATUS.NO_FILTERS, url, target: null };
  if (!url) return { status: TAB_STATUS.NOT_SEARCH, url: null, target: null };
  const target = urlWithFilters(url, settings);
  return { status: target ? TAB_STATUS.MISSING : TAB_STATUS.ACTIVE, url, target };
}
