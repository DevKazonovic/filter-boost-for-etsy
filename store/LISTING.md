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
- Newest first (order=date_desc)

Etsy loads the results with its own filter chips already ticked and sorted, exactly as if you had clicked them yourself.

IT STAYS OUT OF YOUR WAY
Filters are added when a new search term appears, not on every click. Untick one on the results page and it stays unticked until your next search. Anything you put in the URL yourself is never overwritten.

CONTROL
- A master switch in the toolbar popup turns everything off in one click.
- Each filter has its own switch, so you can force one, some or all of them.
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
Filter Boost shapes what the user sees in Etsy search results. It applies the user's chosen Etsy search filter parameters to search URLs, and on the results page it hides the listing cards Etsy has itself labelled as promoted. Both are the same single purpose: controlling which Etsy search results the user is shown.
```

### Permission justifications

| Permission | Justification |
| --- | --- |
| `storage` | Stores the user's own switch settings (master on/off, one flag per filter, and whether promoted listings are hidden) and a per-tab note of the current search term so the extension does not re-apply filters the user has just removed. No browsing data is stored. |
| `webNavigation` | The extension needs to know when a navigation to an Etsy search URL starts so it can add the missing filter parameters before the page loads. Events are restricted to the etsy.com host permission. No other navigation is observed. |
| `*://*.etsy.com/*` (host access) | The extension only acts on Etsy search result pages. This is the narrowest host pattern that covers etsy.com and its localised subdomains. No other site is accessed. |
| Content script | Injected only on Etsy search result paths, never site-wide. It reads the rendered result cards to find the ones Etsy labels as promoted and hides them when the user has switched that on. It makes no network requests, stores nothing it reads, and never interacts with the page on the user's behalf. |

**Remote code:** select "No, I am not using remote code". If a justification box appears, use:

```text
All logic ships inside the package. The extension loads no external scripts, uses no eval or new Function, embeds no remote modules, and makes no network requests of any kind.
```

**Data usage:** Select "does not collect or use user data" and tick the three certification boxes. The
extension collects nothing: no personally identifiable information, no health, financial, authentication,
personal communication, location, browsing history, or web-page content. The content script reads Etsy
search result pages transiently to classify listing cards, but nothing read is retained past the page load
and nothing is transmitted. Settings never leave the user's own Chrome sync storage.

**Privacy policy URL:** publish one. Host `PRIVACY.html` on GitHub Pages, or paste `PRIVACY.md` into a
public gist, and put that URL in the listing. The extension now reads page content, so a reachable policy
saying what is read and that nothing is kept is worth having even though the no-collection certification
still applies.

## Reviewer notes

```text
The extension does two things, both on Etsy search only.

1. It listens to webNavigation events limited to etsy.com, and when a navigation to an Etsy search URL starts with a new search term it redirects the tab to the same URL plus the user's chosen filter parameters (explicit, is_best_seller, instant_download, order). These are Etsy's own public search filter parameters.

2. A content script, injected only on Etsy search result paths and not site-wide, reads the rendered listing cards and hides the ones Etsy has marked as promoted. It identifies them from Etsy's own markers, including the advertising disclosure Etsy itself renders on the card. Hidden cards stay in the page and are only visually hidden, a counter on the page always states how many were hidden, and one click restores them. The feature ships switched off. The script makes no network requests, stores nothing it reads, and never clicks, favourites, carts or otherwise interacts with Etsy on the user's behalf. A card hidden before it enters the viewport may not register an advertising impression, as with any content blocker.

To test: install, open https://www.etsy.com/search?q=stickers, and the address bar will show the four parameters appended. Click the toolbar icon, turn on "Hide promoted listings" under "On the results page", and the promoted cards disappear with a counter at the bottom left of the page offering to show them again. Turn the master switch off and everything reverts with no page reload.
```

## Before you submit

1. Register the developer account and pay the one-time fee if you have not already.
2. Optionally host `PRIVACY.md` or `PRIVACY.html` and copy the URL into the privacy policy field.
3. Set a support email or support URL on the listing.
4. Upload the zip from `../dist/`.
5. Choose Public or Unlisted, and the regions you want.
