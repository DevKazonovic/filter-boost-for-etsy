'use strict';

globalThis.FilterBoostAds = (() => {
  const PROMOTED = 'promoted';
  const ORGANIC = 'organic';
  const UNKNOWN = 'unknown';

  const OK = 'ok';
  const WAITING = 'waiting';
  const BROKEN = 'broken';

  const ANCHOR = '[data-listing-id], a[href*="/listing/"]';
  const MIN_CARDS = 8;

  const DISCLOSURE = Object.freeze({
    en: Object.freeze([/^ad$/, /^ad by\b/, /^ad from shop\b/]),
  });

  const RUN_ON = Object.freeze([/\bad by\b/, /\bad from shop\b/]);

  const STOP_TAGS = new Set(['BODY', 'HTML', 'MAIN', 'OL', 'UL', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'FORM']);

  const attr = (node, name) => (node && node.getAttribute ? node.getAttribute(name) || '' : '');

  function find(card, selector) {
    if (card.matches && card.matches(selector)) return card;
    return card.querySelector ? card.querySelector(selector) : null;
  }

  function queryParam(href, key) {
    const match = new RegExp(`[?&]${key}=([^&#]*)`).exec(href);
    return match ? match[1] : null;
  }

  function attribution(card) {
    const link = find(card, 'a[href*="/listing/"]');
    if (link) {
      const source = queryParam(attr(link, 'href'), 'ls');
      if (source === 'a') return PROMOTED;
      if (source === 's') return ORGANIC;
    }
    const shop = find(card, '[data-shop-url]');
    if (shop && attr(shop, 'data-shop-url').includes('plkey=')) return PROMOTED;
    return UNKNOWN;
  }

  function commerceControls(card) {
    const flag = find(card, 'input[name="is_pl"]');
    if (flag) {
      const value = attr(flag, 'value').toLowerCase();
      if (value === 'true') return PROMOTED;
      if (value === 'false') return ORGANIC;
    }
    const listingSource = find(card, 'input[name="listing_source"]');
    if (listingSource && attr(listingSource, 'value').toLowerCase() === 'ads') return PROMOTED;
    const favourite = find(card, '[data-listing-source]');
    if (favourite && attr(favourite, 'data-listing-source').toLowerCase() === 'ads') return PROMOTED;
    return UNKNOWN;
  }

  function titleIdentity(card) {
    return find(card, '[id^="ad-listing-title-"], [aria-describedby^="ad-listing-title-"]') ? PROMOTED : UNKNOWN;
  }

  function ownText(node) {
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === 3) text += `${child.nodeValue} `;
    }
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function labelsAd(node, wording) {
    const text = ownText(node);
    return Boolean(text) && wording.some((pattern) => pattern.test(text));
  }

  function disclosure(card, language) {
    const wording = DISCLOSURE[language];
    if (!wording) return UNKNOWN;
    if (labelsAd(card, wording)) return PROMOTED;
    for (const node of card.querySelectorAll('*')) {
      if (labelsAd(node, wording)) return PROMOTED;
    }
    const joined = (card.textContent || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return RUN_ON.some((pattern) => pattern.test(joined)) ? PROMOTED : UNKNOWN;
  }

  function languageOf(doc) {
    const tag = doc && doc.documentElement ? attr(doc.documentElement, 'lang') : '';
    return tag.toLowerCase().split('-')[0];
  }

  function classify(card, language) {
    if (disclosure(card, language) === PROMOTED) return PROMOTED;
    const votes = [attribution(card), commerceControls(card), titleIdentity(card)];
    if (votes.includes(ORGANIC)) return ORGANIC;
    return votes.includes(PROMOTED) ? PROMOTED : UNKNOWN;
  }

  function listingKeys(element) {
    const keys = new Set();
    const own = attr(element, 'data-listing-id');
    if (own) keys.add(own);
    for (const node of element.querySelectorAll('[data-listing-id]')) {
      const id = attr(node, 'data-listing-id');
      if (id) keys.add(id);
    }
    if (keys.size) return keys;
    const fromHref = (node) => {
      const match = /\/listing\/(\d+)/.exec(attr(node, 'href'));
      if (match) keys.add(match[1]);
    };
    if (element.matches && element.matches('a[href*="/listing/"]')) fromHref(element);
    for (const link of element.querySelectorAll('a[href*="/listing/"]')) fromHref(link);
    return keys;
  }

  function climb(start) {
    if (listingKeys(start).size !== 1) return null;
    let candidate = start;
    for (let parent = candidate.parentElement; parent; parent = parent.parentElement) {
      if (STOP_TAGS.has(parent.tagName)) break;
      if (listingKeys(parent).size !== 1) break;
      candidate = parent;
    }
    return candidate;
  }

  function cardOf(node) {
    if (!node || !node.closest) return null;
    const tagged = node.closest('[data-listing-id]');
    return (tagged && climb(tagged)) || climb(node);
  }

  function cardAround(node) {
    for (let element = node; element; element = element.parentElement) {
      if (STOP_TAGS.has(element.tagName)) break;
      const keys = listingKeys(element);
      if (keys.size === 1) return climb(element);
      if (keys.size > 1) break;
    }
    return null;
  }

  function labelledAdsIn(root, language, into) {
    const found = into || new Set();
    const wording = DISCLOSURE[language];
    if (!wording || !root.querySelectorAll) return found;
    if (root.nodeType === 1 && labelsAd(root, wording)) {
      const card = cardAround(root);
      if (card) found.add(card);
    }
    for (const node of root.querySelectorAll('*')) {
      if (!labelsAd(node, wording)) continue;
      const card = cardAround(node);
      if (card) found.add(card);
    }
    return found;
  }

  function cardsIn(root, into) {
    const found = into || new Set();
    if (!root) return found;
    if (root.matches && root.matches(ANCHOR)) {
      const card = cardOf(root);
      if (card) found.add(card);
    }
    if (root.querySelectorAll) {
      for (const element of root.querySelectorAll(ANCHOR)) {
        const card = cardOf(element);
        if (card) found.add(card);
      }
    }
    return found;
  }

  function describe(element) {
    if (!element || !element.tagName) return null;
    const classes = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean) : [];
    return classes.length ? `${element.tagName}.${classes.slice(0, 3).join('.')}` : element.tagName;
  }

  function diagnose(root, language) {
    const wording = DISCLOSURE[language] || [];
    const labels = [];
    for (const node of root.querySelectorAll('*')) {
      if (labelsAd(node, wording)) labels.push(node);
    }
    const samples = labels.slice(0, 3).map((node) => {
      const chain = [];
      for (let element = node, depth = 0; element && depth < 9; element = element.parentElement, depth++) {
        if (STOP_TAGS.has(element.tagName)) break;
        chain.push(`${describe(element)} keys=${listingKeys(element).size}`);
      }
      const card = cardAround(node);
      return {
        label: describe(node),
        text: ownText(node),
        card: describe(card),
        cardDisplay: card && card.style ? card.style.getPropertyValue('display') || 'none-set' : null,
        chain,
      };
    });
    return { language, labelCount: labels.length, samples };
  }

  function gate(totals) {
    if (totals.cards < MIN_CARDS) return WAITING;
    if (totals.promoted + totals.organic === 0) return WAITING;
    if (totals.promoted >= totals.cards) return BROKEN;
    return OK;
  }

  return {
    PROMOTED,
    ORGANIC,
    UNKNOWN,
    OK,
    WAITING,
    BROKEN,
    ANCHOR,
    MIN_CARDS,
    languageOf,
    classify,
    cardOf,
    cardsIn,
    labelledAdsIn,
    diagnose,
    gate,
  };
})();
