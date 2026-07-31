const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { stripAlpha, describe } = require('./png');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'store', 'assets');
const LOCALES = ['en', 'fr', 'es', 'de'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

const COPY = {
  en: {
    overviewTitle: 'Your Etsy filters,<br />applied for you',
    overviewSub: 'Bestseller, instant download and explicit results go on every new search. Automatically.',
    urlTitle: 'You search. It adds the rest.',
    urlTyped: 'What you type',
    urlLoaded: 'What loads',
    controlsTitle: 'One switch,<br />or three',
    controlsSub: 'Turn the whole thing off from the toolbar, or choose exactly which filters get forced.',
    behaviourTitle: 'It stays out of your way',
    behaviourPoints: [
      'Untick a filter on the results page and it stays unticked until your next search.',
      'Runs only on Etsy search results. Listings, shops and every other site are untouched.',
      'No account, no tracking, no data collection. Nothing leaves your browser.',
    ],
    tileSmall: 'Your Etsy search filters, applied automatically.',
    tileMarquee: 'Bestseller, instant download and explicit results on every new search.',
  },
  fr: {
    overviewTitle: 'Vos filtres Etsy,<br />appliqués pour vous',
    overviewSub: 'Meilleure vente, téléchargement immédiat et résultats explicites à chaque nouvelle recherche.',
    urlTitle: 'Vous cherchez. Il ajoute le reste.',
    urlTyped: 'Ce que vous tapez',
    urlLoaded: 'Ce qui se charge',
    controlsTitle: 'Un bouton,<br />ou trois',
    controlsSub: "Désactivez tout depuis la barre d'outils, ou choisissez exactement quels filtres sont forcés.",
    behaviourTitle: 'Il ne vous gêne jamais',
    behaviourPoints: [
      'Décochez un filtre sur la page de résultats : il le reste jusqu\'à votre prochaine recherche.',
      'Actif uniquement sur les résultats de recherche Etsy. Fiches, boutiques et autres sites intacts.',
      'Aucun compte, aucun suivi, aucune collecte. Rien ne quitte votre navigateur.',
    ],
    tileSmall: 'Vos filtres de recherche Etsy, appliqués automatiquement.',
    tileMarquee: 'Meilleure vente, téléchargement immédiat et résultats explicites à chaque nouvelle recherche.',
  },
  es: {
    overviewTitle: 'Tus filtros de Etsy,<br />ya aplicados',
    overviewSub: 'Más vendido, descarga instantánea y resultados explícitos en cada búsqueda nueva.',
    urlTitle: 'Tú buscas. Él pone el resto.',
    urlTyped: 'Lo que escribes',
    urlLoaded: 'Lo que se carga',
    controlsTitle: 'Un interruptor,<br />o tres',
    controlsSub: 'Desactiva todo desde la barra de herramientas, o elige exactamente qué filtros se fuerzan.',
    behaviourTitle: 'No se mete en tu camino',
    behaviourPoints: [
      'Desmarca un filtro en la página de resultados y sigue así hasta tu próxima búsqueda.',
      'Solo funciona en resultados de búsqueda de Etsy. Las fichas, las tiendas y el resto de webs quedan intactas.',
      'Sin cuenta, sin seguimiento, sin recopilación de datos. Nada sale de tu navegador.',
    ],
    tileSmall: 'Tus filtros de búsqueda de Etsy, aplicados automáticamente.',
    tileMarquee: 'Más vendido, descarga instantánea y resultados explícitos en cada búsqueda nueva.',
  },
  de: {
    overviewTitle: 'Deine Etsy-Filter,<br />automatisch gesetzt',
    overviewSub: 'Bestseller, Sofort-Download und explizite Ergebnisse bei jeder neuen Suche.',
    urlTitle: 'Du suchst. Es ergänzt den Rest.',
    urlTyped: 'Was du tippst',
    urlLoaded: 'Was geladen wird',
    controlsTitle: 'Ein Schalter,<br />oder drei',
    controlsSub: 'Schalte alles über die Symbolleiste aus, oder wähle genau, welche Filter erzwungen werden.',
    behaviourTitle: 'Es bleibt dir aus dem Weg',
    behaviourPoints: [
      'Entferne einen Filter auf der Ergebnisseite, er bleibt bis zur nächsten Suche entfernt.',
      'Läuft nur auf Etsy-Suchergebnissen. Angebote, Shops und alle anderen Websites bleiben unberührt.',
      'Kein Konto, kein Tracking, keine Datenerfassung. Nichts verlässt deinen Browser.',
    ],
    tileSmall: 'Deine Etsy-Suchfilter, automatisch angewendet.',
    tileMarquee: 'Bestseller, Sofort-Download und explizite Ergebnisse bei jeder neuen Suche.',
  },
};

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: #ffffff;
    background: radial-gradient(120% 120% at 12% 0%, #6366f1 0%, #4338ca 55%, #312e81 100%);
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  .pad { display: flex; align-items: center; gap: 64px; padding: 0 80px; width: 100%; }
  .copy { flex: 1; min-width: 0; }
  h1 { font-size: 52px; line-height: 1.08; letter-spacing: -0.025em; font-weight: 700; }
  p.sub { margin-top: 20px; font-size: 22px; line-height: 1.5; color: rgba(255,255,255,0.78); max-width: 22ch; }
  .shot { border-radius: 16px; border: 1px solid rgba(255,255,255,0.22); overflow: hidden; flex: none; }
  .shot img { display: block; width: 340px; }
  .stack { padding: 0 80px; width: 100%; }
`;

function page(width, height, body, extraCss = '') {
  return `<!doctype html><meta charset="utf-8"><style>
    html, body { width: ${width}px; height: ${height}px; }
    ${BASE_CSS}${extraCss}
  </style><body>${body}</body>`;
}

const overview = (copy, popup) =>
  page(
    1280,
    800,
    `<div class="pad">
      <div class="copy"><h1>${copy.overviewTitle}</h1><p class="sub">${copy.overviewSub}</p></div>
      <div class="shot"><img src="${popup}" /></div>
    </div>`
  );

const controls = (copy, popup) =>
  page(
    1280,
    800,
    `<div class="pad">
      <div class="shot"><img src="${popup}" /></div>
      <div class="copy"><h1>${copy.controlsTitle}</h1><p class="sub">${copy.controlsSub}</p></div>
    </div>`
  );

const urlStory = (copy) =>
  page(
    1280,
    800,
    `<div class="stack">
      <h1>${copy.urlTitle}</h1>
      <div class="rows">
        <div>
          <div class="label">${copy.urlTyped}</div>
          <div class="bar"><span class="dot"></span><span class="url">etsy.com/search?q=stickers</span></div>
        </div>
        <div>
          <div class="label">${copy.urlLoaded}</div>
          <div class="bar"><span class="dot"></span><span class="url">etsy.com/search?q=stickers<span class="added">&amp;explicit=1&amp;is_best_seller=true&amp;instant_download=true</span></span></div>
        </div>
      </div>
    </div>`,
    `
    .rows { width: 100%; display: flex; flex-direction: column; gap: 40px; margin-top: 46px; }
    .label { font-size: 17px; text-transform: uppercase; letter-spacing: 0.13em; color: rgba(255,255,255,0.6); margin-bottom: 14px; }
    .bar { display: flex; align-items: center; gap: 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; padding: 22px 32px; }
    .bar span.url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 20px; white-space: nowrap; }
    .dot { width: 11px; height: 11px; border-radius: 50%; background: rgba(255,255,255,0.34); flex: none; }
    .added { color: #c7d2fe; }
    h1 { font-size: 48px; }
  `
  );

const behaviour = (copy) =>
  page(
    1280,
    800,
    `<div class="stack">
      <h1>${copy.behaviourTitle}</h1>
      <ul>${copy.behaviourPoints.map((point) => `<li><span></span>${point}</li>`).join('')}</ul>
    </div>`,
    `
    ul { list-style: none; margin-top: 42px; display: flex; flex-direction: column; gap: 26px; }
    li { display: flex; align-items: flex-start; gap: 18px; font-size: 25px; line-height: 1.4; color: rgba(255,255,255,0.9); max-width: 34ch; }
    li span { width: 10px; height: 10px; border-radius: 3px; background: #c7d2fe; flex: none; margin-top: 13px; }
  `
  );

const tile = (width, height, icon, headline, sub) => {
  const big = height > 400;
  return page(
    width,
    height,
    `<div class="tile">
      <div class="brand"><img src="${icon}" /><strong>${headline}</strong></div>
      <div class="tag">${sub}</div>
    </div>`,
    `
    .tile { display: flex; flex-direction: column; justify-content: center; gap: ${big ? 26 : 14}px; padding: 0 ${big ? 90 : 40}px; width: 100%; }
    .brand { display: flex; align-items: center; gap: ${big ? 24 : 14}px; }
    .brand img { width: ${big ? 104 : 56}px; height: ${big ? 104 : 56}px; border-radius: ${big ? 24 : 14}px; }
    .brand strong { font-size: ${big ? 50 : 26}px; letter-spacing: -0.02em; }
    .tag { font-size: ${big ? 29 : 15}px; line-height: 1.4; color: rgba(255,255,255,0.8); max-width: ${big ? 30 : 24}ch; }
  `
  );
};

const written = [];

async function shoot(browser, html, width, height, file) {
  const view = await browser.newPage();
  await view.setViewport({ width, height, deviceScaleFactor: 1 });
  await view.setContent(html, { waitUntil: 'load' });
  await sleep(150);
  const buffer = await view.screenshot();
  await view.close();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stripAlpha(buffer));
  written.push(file);
}

async function popupShot(browser, popupUrl, locale, messages, scheme, file) {
  const view = await browser.newPage();
  await view.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await view.setViewport({ width: 320, height: 420, deviceScaleFactor: 2 });
  await view.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await sleep(400);

  const height = await view.evaluate(
    (msgs, filterLabels) => {
      const text = (key) => msgs[key].message;
      for (const element of document.querySelectorAll('[data-i18n]')) {
        element.textContent = text(element.dataset.i18n);
      }
      document.getElementById('masterState').textContent = text('masterOn');
      document.querySelectorAll('#filters .row-title').forEach((node, index) => {
        node.textContent = filterLabels[index];
      });
      document.getElementById('status').dataset.tone = 'ok';
      document.getElementById('statusText').textContent = text('statusActive');
      document.getElementById('shortcut').textContent = text('shortcutHint').replace('$SHORTCUT$', '⌥⇧F');
      return document.body.scrollHeight;
    },
    messages,
    [messages.filterExplicit.message, messages.filterBestSeller.message, messages.filterInstantDownload.message]
  );

  const buffer = await view.screenshot({ clip: { x: 0, y: 0, width: 320, height } });
  await view.close();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stripAlpha(buffer));
  written.push(file);
  return dataUri(file);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [`--disable-extensions-except=${SRC}`, `--load-extension=${SRC}`, '--no-sandbox'],
  });
  const target = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 20000 });
  const popupUrl = target.url().replace('background.js', 'popup.html');

  const storeIcon = path.join(OUT, 'store-icon-128.png');
  if (!fs.existsSync(storeIcon)) throw new Error('run generate-icons.js first');
  const icon = dataUri(storeIcon);

  for (const locale of LOCALES) {
    const copy = COPY[locale];
    const messages = JSON.parse(fs.readFileSync(path.join(SRC, '_locales', locale, 'messages.json'), 'utf8'));
    const dir = path.join(OUT, locale);

    const light = await popupShot(browser, popupUrl, locale, messages, 'light', path.join(dir, 'popup-light.png'));
    const dark = await popupShot(browser, popupUrl, locale, messages, 'dark', path.join(dir, 'popup-dark.png'));

    await shoot(browser, overview(copy, light), 1280, 800, path.join(dir, 'screenshot-1-overview.png'));
    await shoot(browser, urlStory(copy), 1280, 800, path.join(dir, 'screenshot-2-url.png'));
    await shoot(browser, controls(copy, dark), 1280, 800, path.join(dir, 'screenshot-3-controls.png'));
    await shoot(browser, behaviour(copy), 1280, 800, path.join(dir, 'screenshot-4-behaviour.png'));
    await shoot(browser, tile(440, 280, icon, 'Filter Boost', copy.tileSmall), 440, 280, path.join(dir, 'promo-small-440x280.png'));
    await shoot(
      browser,
      tile(1400, 560, icon, 'Filter Boost for Etsy', copy.tileMarquee),
      1400,
      560,
      path.join(dir, 'promo-marquee-1400x560.png')
    );

    console.log(`${locale}: 6 upload assets + 2 popup captures`);
  }

  await browser.close();

  const problems = [];
  for (const file of [...written, storeIcon]) {
    const info = describe(fs.readFileSync(file));
    if (info.hasAlpha) problems.push(`${path.relative(ROOT, file)} still has an alpha channel`);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }

  console.log(`\n${written.length + 1} files, all 24-bit PNG with no alpha channel`);
})();
