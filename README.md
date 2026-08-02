# Filter Boost for Etsy

Chrome extension (Manifest V3) that adds a chosen set of filter parameters to Etsy search URLs, so
every new search starts from the same filters.

Forced parameters, each individually switchable:

| Filter | Parameter |
| --- | --- |
| Explicit results | `explicit=1` |
| Bestseller | `is_best_seller=true` |
| Instant download | `instant_download=true` |
| Newest first | `order=date_desc` |

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
