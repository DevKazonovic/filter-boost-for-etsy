# Privacy policy, Filter Boost for Etsy

Version 1.2.0

## The short version

Filter Boost collects nothing. There is no account, no analytics, no tracking, no remote server and no
remote code. Nothing you do in the browser is transmitted anywhere.

## What the extension stores

- **Your settings.** The master on/off switch, one flag per filter, and whether promoted listings are
  hidden, kept in Chrome's extension storage. If you are signed into Chrome, Chrome itself syncs them
  to your other devices. They are never sent to the developer.
- **A short-lived note of the current search term per tab.** This is what stops the extension from
  re-adding a filter you just removed. It lives in session storage, is discarded when the tab closes,
  and is cleared when the browser restarts.

## What the extension can see

The extension is granted access to `etsy.com` only, and cannot see any other website.

It observes the start of navigations to Etsy search URLs so it can add your chosen filter parameters
before the page loads.

On Etsy search result pages, and only there, it also reads the page in order to find the listing cards
Etsy has labelled as promoted, so it can hide them when you have asked it to. That reading happens
entirely inside your browser, on a page you opened yourself. Nothing read from the page is stored,
kept after you leave the page, or transmitted anywhere. The extension makes no network requests of its
own, and never clicks, favourites, adds to cart, or otherwise interacts with Etsy on your behalf.

## What it does not do

- No personally identifiable information, no location, no authentication data, no financial data.
- No browsing history collection and no logging of your searches.
- No retention of anything read from an Etsy page. Counts shown on the results page are recomputed
  each time and discarded when you leave.
- No selling or sharing of data, because none is collected.
- No advertising and no third-party services of any kind.

## Removing your data

Uninstalling the extension removes its stored settings. You can also clear them at any time from
`chrome://extensions`.

## Contact

Questions about this policy can be sent to the support address on the Chrome Web Store listing.

---

Not affiliated with, endorsed by or sponsored by Etsy, Inc. Etsy is a trademark of Etsy, Inc.
