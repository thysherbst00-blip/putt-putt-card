# Putt Putt Scorecard

**Live:** <https://putt-putt-card.pages.dev/> — the sign to print is at
<https://putt-putt-card.pages.dev/poster.html>

A one-page scorecard for putt putt / adventure golf. You scan a QR code at the
first tee, enter the players' names, then tap the strokes each of them took on
each hole. It keeps the running totals, the difference against course par, and
at the end it shows the winner and the full card.

No sign-in, no accounts, no server. The round lives in the browser on the
phone that is scoring, so it keeps working when the signal does not.

## What is in here

| File | Purpose |
| --- | --- |
| `index.html` | The scorecard itself: markup, styles and logic in one file. |
| `poster.html` | The printable sign for the first tee, holding the QR code. |
| `icon.svg` | Favicon and home-screen icon. |
| `manifest.webmanifest` | Lets the page be added to a phone's home screen. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

There is no build step and no package manager. The scorecard pulls one thing
off a CDN, Google Fonts for the typefaces. The poster also loads `qrcodejs` to
draw the code.

## Running it locally

Open it over HTTP rather than as a `file://` path, so the manifest and the QR
code behave the way they will in production:

```sh
cd putt-putt-card
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying

The site is static. There is nothing to build, so a host only has to serve the
files as they are. It runs on Cloudflare Pages, which deploys on every push to
`main`:

1. Cloudflare dashboard → **Workers & Pages** → **Create application**.
2. At the bottom of that screen, follow **"Need to use the legacy Pages
   workflow? Continue to Pages"**. The default route builds a Worker, which is
   not what this is — a Worker gets an address carrying the account subdomain,
   and the whole point of the move was to keep names out of the URL.
3. **Connect to Git**, pick this repository, production branch `main`.
4. Framework preset **None**, build command **empty**, output directory **`/`**.
5. Save and deploy. The site lands on `<project-name>.pages.dev`.

Cloudflare marks Pages as legacy and is pushing Workers instead. If it ever
goes away, moving is cheap: these are plain static files with nothing
host-specific in them, so Netlify or any other static host serves them as they
are, and the code on the sign re-points itself.

The address matters here: it is what players read in their browser after
scanning, so it is deliberately a project name rather than a personal GitHub
handle. If GitHub Pages was ever switched on for this repo, switch it off
(Settings → Pages → Source: None) so only one address serves the site.

Both pages work out their own address at runtime, so the code on the sign
always points at the scorecard sitting beside it. Moving hosts, or putting a
custom domain in front, needs no edit anywhere.

## The sign at the first tee

`poster.html` is what players see on arrival. It draws a QR code for the
scorecard, adds the three steps, and prints onto one page. Open it, type the
course name if you want it on the sign, and print it or just show the screen.

The code is built from the page's own address at runtime, so it always points
at the scorecard sitting beside it. Move the site and the code follows.

The scorecard itself carries no QR code. Nobody scans a code on a page they
could only reach by scanning it.

## How a round is stored

Everything sits under the single `localStorage` key `puttputt.round.v1` on the
scoring device: course name, hole count, par, the pick-up rule, the players and
their strokes. Consequences worth knowing:

- Closing the tab mid-round is safe. Reopening offers to carry on.
- The data never leaves the phone. It is not backed up anywhere.
- Clearing the browser's site data deletes the round.
- Every phone that scans the code gets its own card. Two people scoring the
  same game means two separate cards.

## Scoring rules it applies

- Lowest total wins. Equal totals share the position and the summary says so.
- Par is a single value for every hole, set at the start (2 for putt putt,
  3 is common on adventure courses).
- The par difference counts only the holes actually played, so a part-finished
  round still reads correctly.
- A 1 is marked as an ace. A hole is "won" when exactly one player is lowest on
  it and everyone has a score for it; otherwise it counts as tied.
- The pick-up rule caps the stroke buttons at 5 or 6. Set it to Never and a
  `7+` button appears, which keeps counting upwards.

## Things it deliberately does not do

- **Work offline on a cold load.** The round survives offline, but a first
  visit with no signal gets no fonts and no QR code. A service worker would fix
  that.
- **Share one live card between phones.** That needs a server and a database.
- **Store anything server-side.** There is no back end to store it in.
