# Filter Boost for Etsy

Chrome extension (Manifest V3) that adds a chosen set of filter parameters to Etsy search URLs, so
every new search starts from the same filters.

Forced parameters, each individually switchable:

| Filter | Parameter |
| --- | --- |
| Explicit results | `explicit=1` |
| Bestseller | `is_best_seller=true` |
| Instant download | `instant_download=true` |

## Layout

```text
src/            the extension itself, this folder is what gets loaded and zipped
  lib/          URL and settings logic shared by the service worker and the popup
  _locales/     en (i18n is wired up, dropping in another locale needs no code change)
tests/          unit.mjs (stubbed Chrome APIs) and e2e.mjs (real Chrome via puppeteer)
scripts/        icon generation, store asset generation, validate and package
store/          listing copy, privacy policy, generated store graphics per locale
dist/           built upload package
```

## Install from source

1. Open `chrome://extensions`, turn on Developer mode.
2. Load unpacked, select the `src/` folder of this repository.
3. Pin the toolbar icon.

## Commands

Run from the repository root, after `npm install` (puppeteer is the only dependency, and only the
test and asset tooling needs it, the extension itself has none).

```sh
npm test              # 79 logic checks against stubbed Chrome APIs
npm run e2e           # 37 checks in a real Chrome with the extension loaded
npm run verify        # both suites, then validate and package
npm run icons         # regenerate src/icons and the opaque 128px store icon
npm run assets        # regenerate the localized store screenshots and promo tiles
npm run build         # validate the package and write dist/*.zip
```

`e2e` never touches etsy.com: it maps the Etsy hostnames to a local stub server with Chrome's host
resolver rules.

`build` fails the package rather than shipping it if the manifest version is malformed, a locale is
missing a key, an icon has the wrong dimensions, a message key referenced by the manifest does not
exist, a broad permission crept in, or a dotfile would end up in the zip.

## Behaviour

- Runs on Etsy search result pages only: `/search`, locale prefixes such as `/de-en/search`, and
  scoped searches such as `/search/home-and-living`. Category, market, shop and listing pages are
  untouched, as is every non-Etsy site.
- Filters are applied when a **new search term** appears. Change them on the results page and they
  stay changed until the next search.
- Parameters already present in the URL are never overwritten.
- Per-tab search memory lives in session storage, so it survives the service worker idling out and
  resets on browser restart.
- Changing any setting clears that memory, so the new configuration applies from the next navigation.

## Permissions

`storage` for the settings and the per-tab memory, `webNavigation` plus host access to `*.etsy.com`
to see search navigations. No content script, no page access, no data collection. See
`store/PRIVACY.html`.

## Publishing

`store/LISTING.md` holds the copy-paste listing text, permission justifications, data-safety answers
and reviewer notes. Assets are generated into `store/assets/`, six upload files plus the store icon,
all 24-bit PNG with no alpha channel because the dashboard rejects alpha. `npm run assets` fails if
any generated file still carries an alpha channel.

## Licence

MIT, see `LICENSE`.

Not affiliated with, endorsed by or sponsored by Etsy, Inc. Etsy is a trademark of Etsy, Inc.
