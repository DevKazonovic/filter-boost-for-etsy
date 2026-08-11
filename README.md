# Filter Boost for Etsy

Chrome extension (Manifest V3) that shapes Etsy search results: it adds a chosen set of filter
parameters to Etsy search URLs so every new search starts from the same filters, and it can hide the
listing cards Etsy labels as promoted.

Forced parameters, each individually switchable:

| Filter | Parameter |
| --- | --- |
| Explicit results | `explicit=1` |
| Bestseller | `is_best_seller=true` |
| Instant download | `instant_download=true` |
| Newest first | `order=date_desc` |

Plus one results-page switch, off by default:

| Switch | What it does |
| --- | --- |
| Hide promoted listings | Visually hides ad cards on the results page, with a counter and one-click reveal |

## Hiding promoted listings

A content script injected only on Etsy search paths classifies each result card from four independent
families of Etsy's own markers: click attribution on the listing link, the promoted flag on the
quick-add and favourite controls, the ad prefix on the card title identifier, and the advertising
disclosure Etsy renders for the reader. A card is hidden only when at least one promoted marker fires
and no organic marker does, so an ambiguous card stays visible.

Etsy's own visible "Ad" label outranks everything. If the card tells the reader it is an ad, it is
hidden, and no other marker can veto that. Etsy is legally obliged to render that label, and it is the
only signal that means the same thing to the code as it does to the person looking at the page.

Below the label, only two markers may vote organic: the attribution parameter on the link, and the
promoted flag on the quick-add form. Everything else is promoted-only.

The attribution parameter is not trustworthy on its own. Etsy serves plenty of promoted cards with the
organic value on it, which made every one of those ads permanently immune while it was allowed to veto.

That distinction is load-bearing. The title prefix and the disclosure wording are absence-shaped, and
an absent ad prefix is not evidence of an organic listing. The listing-source fields are worse: they
record where an interaction came from, not whether the listing is an ad, so a promoted card inside a
search module legitimately reads `search` there. Both mistakes let Etsy's top-of-grid ad block through
untouched while the interleaved ads were hidden correctly.

A card is found by climbing from a listing link to the highest ancestor still covering exactly one
listing, rather than assuming it sits in a grid list item. Etsy's top-of-grid ads are not list items,
and assuming they were meant hiding a card's image while leaving its title and price on screen.

The failure direction is deliberate. Leaving an ad visible is self-correcting because the card still
says it is an ad, while hiding an organic result is invisible and silently corrupts research. So:
markers that rotate per deploy are never used, cards are hidden rather than removed, a counter is
shown even when nothing was hidden, and if every card on a page classifies as promoted the detector is
treated as broken and nothing is hidden at all.

Detection lives in `src/ad-markers.js`, page mechanics in `src/content.js`. Both are plain scripts,
not modules, because manifest content scripts cannot be modules and there is no bundler here.

## Layout

```text
src/            the extension itself, this folder is what gets loaded and zipped
  lib/          URL and settings logic shared by the service worker and the popup
  ad-markers.js classifies a result card as promoted, organic or unknown
  content.js    runs on Etsy search pages, hides promoted cards, owns the on-page counter
  _locales/     en (i18n is wired up, dropping in another locale needs no code change)
tests/          unit.mjs (stubbed Chrome APIs) and e2e.mjs (real Chrome via puppeteer)
scripts/        icon generation, store asset generation, validate and package
store/          listing copy, privacy policy, generated store graphics per locale
dist/           built upload package
```

## Develop

```sh
npm run dev
```

Opens a Chrome window with `src/` loaded, on its own profile in `.dev-profile/` so it never touches
your normal browser, and lands on an Etsy search. Save any file under `src/` and the extension
reloads itself, no visit to `chrome://extensions` and no clicking. Ctrl-c closes it.

Chrome cannot install a zip. Unpacked loading takes the **folder**, and `dist/*.zip` exists only for
the store upload.

Flags: `--headless` for no window, `--blank` to skip opening Etsy. Set `DEV_CHANNEL=chrome` to drive
your installed Chrome instead of the one puppeteer downloaded.

## Install from source

1. Open `chrome://extensions`, turn on Developer mode.
2. Load unpacked, select the `src/` folder of this repository.
3. Pin the toolbar icon.

## Commands

Run from the repository root, after `npm install` (puppeteer is the only dependency, and only the
test and asset tooling needs it, the extension itself has none).

```sh
npm test              # 85 logic checks against stubbed Chrome APIs
npm run e2e           # 77 checks in a real Chrome with the extension loaded
npm run verify        # both suites, then validate and package
npm run icons         # regenerate src/icons and the opaque 128px store icon
npm run assets        # regenerate the localized store screenshots and promo tiles
npm run build         # validate the package and write dist/*.zip
```

`e2e` never touches etsy.com: it maps the Etsy hostnames to a local stub server with Chrome's host
resolver rules. The stub serves a realistic search grid built from captured Etsy card markup, so the
ad detection is exercised against organic, promoted, conflicting and all-promoted pages.

`build` fails the package rather than shipping it if the manifest version is malformed, a locale is
missing a key, an icon has the wrong dimensions, a message key referenced by the manifest does not
exist, a broad permission crept in, a content script asset is missing or reaches beyond Etsy search,
or a dotfile would end up in the zip.

## Automation

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: `npm ci`, both test
suites in a real Chrome, then `npm run build`. The packaged zip is attached to the run as an
artifact, so any commit can be installed and checked without building locally.

`.github/workflows/deploy.yml` runs on every push to `main`. It compares the manifest version against
the previous commit:

| Manifest version | What happens |
| --- | --- |
| unchanged | tests and package only, nothing is shipped |
| changed | tests, package, `v<version>` tag and GitHub release, upload to the Chrome Web Store, submit for review |

So shipping is: bump `version` in `src/manifest.json`, add a `RELEASE_NOTES` entry if the change is
worth announcing, commit, push. No tags to remember.

The version gate exists because the store rejects a re-upload of a version that already exists, so
every push cannot be a release. A manual run from the Actions tab has a **force** option that deploys
without a version change, for retrying a failed upload.

Without the four `CWS_*` secrets the store steps are skipped with a warning, so the workflows are
useful before any credentials exist.

| Secret | Where it comes from |
| --- | --- |
| `CWS_EXTENSION_ID` | the 32-letter id in the developer dashboard URL for the item |
| `CWS_CLIENT_ID` | Google Cloud OAuth client, type **Desktop app**, project with the Chrome Web Store API enabled |
| `CWS_CLIENT_SECRET` | same OAuth client |
| `CWS_REFRESH_TOKEN` | `npm run cws-token` |

`npm run cws-token` opens the Google consent screen, catches the redirect on a local port, exchanges
the code and prints the refresh token. Two things decide whether it works:

- Sign in with the **same Google account that owns the extension**.
- On the OAuth consent screen, set publishing status to **In production**. While it is in *Testing*,
  Google expires refresh tokens after 7 days and deploys start failing a week later.

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
- A filter added in a later version defaults to on for existing users, because `normalizeSettings`
  treats a missing flag as enabled. Their own choices are preserved.

## Release notes shown to existing users

Store installs update themselves silently, so a version that changes behaviour announces itself once.
`src/lib/notes.js` maps a version to a message key:

```js
export const RELEASE_NOTES = Object.freeze({ '1.1.0': 'releaseNote110' });
```

On `onInstalled` with `reason: 'update'`, if the new version has an entry, the service worker writes
it to `storage.local` and the toolbar icon gets a dot. The popup then shows a dismissible line, and
"Got it" clears both. Fresh installs never see it, and a version with no entry updates silently.

To announce a release: add the version to `RELEASE_NOTES`, add the matching message to every locale,
bump the manifest version, `npm run verify`.

## Permissions

`storage` for the settings and the per-tab memory, `webNavigation` plus host access to `*.etsy.com`
to see search navigations. The content script is scoped to Etsy search paths only, never site-wide.
It reads result cards to classify them, makes no network requests, and retains nothing. No data
collection. See `store/PRIVACY.html`.

Match patterns are tested against the path **and** the query string, so `/search` alone never matches
`/search?q=x`. Both forms are listed. `build` fails if a pattern reaches beyond Etsy search.

## Publishing

`store/LISTING.md` holds the copy-paste listing text, permission justifications, data-safety answers
and reviewer notes. Assets are generated into `store/assets/`, six upload files plus the store icon,
all 24-bit PNG with no alpha channel because the dashboard rejects alpha. `npm run assets` fails if
any generated file still carries an alpha channel.

## Licence

MIT, see `LICENSE`.

Not affiliated with, endorsed by or sponsored by Etsy, Inc. Etsy is a trademark of Etsy, Inc.
