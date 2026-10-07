# Putt Putt Scorecard

A one-page scorecard for putt putt / adventure golf. You scan a QR code at the
first tee, enter the players' names, then tap the strokes each of them took on
each hole. It keeps the running totals, the difference against course par, and
at the end it shows the winner and the full card.

No sign-in, no accounts, no server. The round lives in the browser on the
phone that is scoring, so it keeps working when the signal does not.

## What is in here

| File | Purpose |
| --- | --- |
| `index.html` | The whole app: markup, styles and logic in one file. |
| `icon.svg` | Favicon and home-screen icon. |
| `manifest.webmanifest` | Lets the page be added to a phone's home screen. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

There is no build step and no package manager. Dependencies are two CDN
requests: Google Fonts for the typefaces, and `qrcodejs` to draw the QR code
on the set-up screen.

## Running it locally

Open it over HTTP rather than as a `file://` path, so the manifest and the QR
code behave the way they will in production:

```sh
cd putt-putt-card
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying

The site is static, so GitHub Pages serves it straight from the default branch:

1. Push this repo to GitHub.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Wait for the first build, then open the URL Pages gives you.

The page reads its own address at runtime and draws the QR code from that, so
there is no URL to configure. Screenshot or print that code and it will open
the live site on any phone.

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
