# Chrome Web Store submission

Everything below is copy-paste ready for the developer dashboard. Assets are in `assets/`, the
upload package is built by `npm run ext:build` into `../dist/`.

## Store listing

### Name

```text
Filter Boost for Etsy
```

### Short description (132 character limit, currently 110)

```text
Applies your preferred Etsy search filters automatically on every new search, with one click to turn them off.
```

**Category:** Shopping
**Language:** English

### Detailed description

```text
Filter Boost keeps your Etsy searches consistent. Instead of re-picking the same filters every time, it adds them to the URL the moment a new search starts.

WHAT IT DOES
Every time you start a new Etsy search, Filter Boost adds the filters you chose:
- Bestseller (is_best_seller=true)
- Instant download (instant_download=true)
- Explicit results (explicit=1)

Etsy loads the results with its own filter chips already ticked, exactly as if you had clicked them yourself.

IT STAYS OUT OF YOUR WAY
Filters are added when a new search term appears, not on every click. Untick one on the results page and it stays unticked until your next search. Anything you put in the URL yourself is never overwritten.

CONTROL
- A master switch in the toolbar popup turns everything off in one click.
- Each of the three filters has its own switch, so you can force one, two or all three.
- A keyboard shortcut (Alt+Shift+F by default) toggles it without opening the popup.
- The popup tells you whether the search you are looking at has your filters applied, and can apply them to the current page with one click.

SCOPE
It runs on Etsy search result pages only, including localised paths such as /de-en/search and category-scoped searches. Listing pages, shop pages, category browse pages and every other website are untouched.

PRIVACY
No account, no tracking, no analytics, no remote code. The extension does not read the contents of any page and nothing ever leaves your browser. It stores only your own switch settings, synced by Chrome across your devices.

Note: "Explicit results" is Etsy's own search filter. Filter Boost only sets it in the URL, it does not host or display any content itself.

Not affiliated with, endorsed by or sponsored by Etsy, Inc. Etsy is a trademark of Etsy, Inc.
```

## Graphic assets

Every file is 1280x800 or the stated canvas size, 24-bit PNG with **no alpha channel**, which is what
the dashboard requires. Promo videos are optional: leave both YouTube fields empty.

The listing page splits these into **Global assets** and **Localized assets**. The item is English
only, so upload everything under **Global** and leave the localized fields empty. If the form insists
on a localized screenshot for English, upload the same files there.

| Field | File | Size |
| --- | --- | --- |
| Store icon | `assets/store-icon-128.png` | 128x128 |
| Screenshot 1 | `assets/screenshot-1-overview.png` | 1280x800 |
| Screenshot 2 | `assets/screenshot-2-url.png` | 1280x800 |
| Screenshot 3 | `assets/screenshot-3-controls.png` | 1280x800 |
| Screenshot 4 | `assets/screenshot-4-behaviour.png` | 1280x800 |
| Small promo tile | `assets/promo-small-440x280.png` | 440x280 |
| Marquee promo tile | `assets/promo-marquee-1400x560.png` | 1400x560 |

`popup-light.png` and `popup-dark.png` are the raw popup captures the screenshots are built from,
they are not uploaded anywhere.

## Privacy practices tab

### Single purpose description

```text
Filter Boost adds a fixed set of Etsy search filter parameters to Etsy search result URLs so the user does not have to select the same filters manually on every search. That is its only function.
```

### Permission justifications

| Permission | Justification |
| --- | --- |
| `storage` | Stores the user's own switch settings (master on/off and one flag per filter) and a per-tab note of the current search term so the extension does not re-apply filters the user has just removed. No browsing data is stored. |
| `webNavigation` | The extension needs to know when a navigation to an Etsy search URL starts so it can add the missing filter parameters before the page loads. Events are restricted to the etsy.com host permission. No other navigation is observed. |
| `*://*.etsy.com/*` (host access) | The extension only acts on Etsy search result pages. This is the narrowest host pattern that covers etsy.com and its localised subdomains. No other site is accessed. |

**Remote code:** No, the extension does not use remote code. All logic ships in the package.

**Data usage:** Select "does not collect or use user data" and tick the three certification boxes. The
extension collects nothing: no personally identifiable information, no health, financial, authentication,
personal communication, location, browsing history, or web-page content. Settings never leave the user's
own Chrome sync storage.

**Privacy policy URL:** optional for this extension, because it certifies that it collects no user
data. If you want one anyway, no website is needed: paste `PRIVACY.md` into a public GitHub gist and
use that URL, or host `PRIVACY.html` on GitHub Pages.

## Reviewer notes

```text
The extension has no content script and never reads page content. It listens to webNavigation events limited to etsy.com, and when a navigation to an Etsy search URL starts with a new search term it redirects the tab to the same URL plus the user's chosen filter parameters (explicit, is_best_seller, instant_download). These are Etsy's own public search filter parameters. The popup lets the user turn the whole thing off or toggle each filter individually.

To test: install, open https://www.etsy.com/search?q=stickers, and the address bar will show the three parameters appended. Click the toolbar icon and turn "Force filters" off, then repeat the search to see the URL left untouched.
```

## Before you submit

1. Register the developer account and pay the one-time fee if you have not already.
2. Host `PRIVACY.html` and copy the URL into the privacy policy field.
3. Set a support email or support URL on the listing.
4. Upload `../dist/filter-boost-for-etsy-1.0.0.zip`.
5. Choose Public or Unlisted, and the regions you want.
