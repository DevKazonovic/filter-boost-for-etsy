'use strict';

(() => {
  const ads = globalThis.FilterBoostAds;
  if (!ads) return;

  const SETTINGS_KEY = 'settings';
  const SEARCH_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?search(?:\/|$)/;
  const HIDDEN_ATTR = 'data-filter-boost-hidden';
  const STRIP_ID = 'filter-boost-strip';

  let observer = null;
  let strip = null;
  let stripLabel = null;
  let stripButton = null;
  let running = false;
  let revealed = false;
  let state = ads.WAITING;
  let broken = false;
  let address = location.href;
  let frame = 0;

  const pending = new Set();
  const labelled = new Set();
  const classified = new Set();
  const promotedCards = new Set();
  let totals = { cards: 0, promoted: 0, organic: 0 };

  const alive = () => {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  };

  const message = (key, subs) => {
    try {
      return chrome.i18n.getMessage(key, subs) || '';
    } catch {
      return '';
    }
  };

  const isSearch = () => SEARCH_PATH.test(location.pathname);

  const wanted = (raw) => Boolean(raw) && raw.enabled !== false && raw.hideAds === true && isSearch();

  function conceal(card) {
    card.setAttribute(HIDDEN_ATTR, '1');
    if (card.style) card.style.setProperty('display', 'none', 'important');
  }

  function reveal(card) {
    card.removeAttribute(HIDDEN_ATTR);
    if (card.style) card.style.removeProperty('display');
  }

  function clearResultSet() {
    for (const card of promotedCards) reveal(card);
    promotedCards.clear();
    classified.clear();
    pending.clear();
    labelled.clear();
    totals = { cards: 0, promoted: 0, organic: 0 };
    state = ads.WAITING;
    broken = false;
    revealed = false;
  }

  function applyVisibility() {
    const hiding = state === ads.OK && !broken && !revealed;
    for (const card of promotedCards) {
      if (hiding) conceal(card);
      else reveal(card);
    }
  }

  function ensureStrip() {
    if (strip && strip.isConnected) return strip;
    if (!document.body) return null;
    strip = document.createElement('div');
    strip.id = STRIP_ID;
    strip.setAttribute('dir', 'auto');
    stripLabel = document.createElement('span');
    stripLabel.className = 'filter-boost-strip__label';
    const stripVersion = document.createElement('span');
    stripVersion.className = 'filter-boost-strip__version';
    try {
      stripVersion.textContent = `v${chrome.runtime.getManifest().version}`;
    } catch {
      stripVersion.textContent = '';
    }
    stripButton = document.createElement('button');
    stripButton.type = 'button';
    stripButton.className = 'filter-boost-strip__button';
    stripButton.addEventListener('click', () => {
      revealed = !revealed;
      applyVisibility();
      renderStrip();
    });
    strip.addEventListener('click', (event) => {
      if (!event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      console.log('FILTER BOOST DIAGNOSTIC', JSON.stringify(diagnose(), null, 2));
    });
    strip.append(stripLabel, stripVersion, stripButton);
    document.body.append(strip);
    return strip;
  }

  function renderStrip() {
    if (!running) {
      removeStrip();
      return;
    }
    if (!ensureStrip()) return;
    const count = String(promotedCards.size);
    if (broken) {
      stripLabel.textContent = message('adsUnsure');
      stripButton.hidden = true;
      return;
    }
    if (state !== ads.OK || promotedCards.size === 0) {
      stripLabel.textContent = message('adsNone');
      stripButton.hidden = true;
      return;
    }
    stripLabel.textContent = message(revealed ? 'adsShown' : 'adsHidden', [count]);
    stripButton.textContent = message(revealed ? 'adsHide' : 'adsShow');
    stripButton.hidden = false;
  }

  function removeStrip() {
    if (strip) strip.remove();
    strip = null;
    stripLabel = null;
    stripButton = null;
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(flush);
  }

  function flush() {
    frame = 0;
    if (!running) return;
    if (!alive()) {
      stop();
      return;
    }
    const language = ads.languageOf(document);
    for (const card of pending) {
      if (classified.has(card) || !card.isConnected) continue;
      classified.add(card);
      totals.cards++;
      const verdict = labelled.has(card) ? ads.PROMOTED : ads.classify(card, language);
      if (verdict === ads.PROMOTED) {
        totals.promoted++;
        promotedCards.add(card);
      } else if (verdict === ads.ORGANIC) {
        totals.organic++;
      }
    }
    pending.clear();
    state = ads.gate(totals);
    if (state === ads.BROKEN) broken = true;
    applyVisibility();
    renderStrip();
  }

  function collect(root) {
    ads.cardsIn(root, pending);
    ads.labelledAdsIn(root, ads.languageOf(document), labelled);
    for (const card of labelled) pending.add(card);
    if (pending.size) schedule();
  }

  function ours(node) {
    return Boolean(strip) && (node === strip || strip.contains(node));
  }

  function onMutations(mutations) {
    if (!running) return;
    if (location.href !== address) {
      address = location.href;
      onAddressChanged();
      return;
    }
    for (const mutation of mutations) {
      if (ours(mutation.target)) continue;
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1 || ours(node)) continue;
        collect(node);
      }
    }
  }

  function onAddressChanged() {
    if (!isSearch()) {
      stop();
      return;
    }
    clearResultSet();
    collect(document);
    renderStrip();
  }

  function start() {
    if (running) return;
    running = true;
    clearResultSet();
    observer = new MutationObserver(onMutations);
    observer.observe(document, { childList: true, subtree: true });
    collect(document);
    renderStrip();
  }

  function diagnose() {
    const report = ads.diagnose(document, ads.languageOf(document));
    report.state = state;
    report.broken = broken;
    report.totals = totals;
    report.hidden = promotedCards.size;
    report.stillVisible = [...promotedCards].filter((card) => card.isConnected && card.offsetParent !== null).length;
    try {
      report.version = chrome.runtime.getManifest().version;
    } catch {
      report.version = null;
    }
    return report;
  }

  function stop() {
    running = false;
    if (observer) observer.disconnect();
    observer = null;
    clearResultSet();
    removeStrip();
  }

  function applySettings(raw) {
    if (wanted(raw)) start();
    else stop();
  }

  if (!isSearch()) return;

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
      applySettings(changes[SETTINGS_KEY].newValue);
    });
  } catch {
    return;
  }

  window.addEventListener('popstate', () => {
    if (!running) return;
    address = location.href;
    onAddressChanged();
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    Promise.resolve(chrome.storage.sync.get(SETTINGS_KEY))
      .then((stored) => applySettings(stored[SETTINGS_KEY]))
      .catch(() => {});
  });

  Promise.resolve(chrome.storage.sync.get(SETTINGS_KEY))
    .then((stored) => applySettings(stored[SETTINGS_KEY]))
    .catch(() => {});
})();
