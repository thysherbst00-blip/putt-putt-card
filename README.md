# Putt Putt Scorecard

**Live:** <https://putt-putt-card.pages.dev/> — signs are issued at
<https://putt-putt-card.pages.dev/admin>, which only the owner can open.

A one-page scorecard for putt putt / adventure golf. You scan a QR code at the
first tee, enter the players' names, then tap the strokes each of them took on
each hole. It keeps the running totals, the difference against course par, and
at the end it shows the winner and the full card.

Players need no sign-in and no account. The round lives in the browser on the
phone that is scoring, so it keeps working when the signal does not. The only
server-side part is the gate: the scorecard opens for a dated code and refuses
once that code lapses.

## What is in here

| File | Purpose |
| --- | --- |
| `index.html` | The scorecard itself: markup, styles and logic in one file. |
| `admin.html` | Issues a dated code and prints the sign that carries it. |
| `functions/_middleware.js` | Checks the code before the scorecard is served. |
| `functions/api/token.js` | Signs a new code. Refuses callers who are not the owner. |
| `icon.svg` | Favicon and home-screen icon. |
| `manifest.webmanifest` | Lets the page be added to a phone's home screen. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

There is no build step and no package manager. The scorecard pulls one thing
off a CDN, Google Fonts for the typefaces. The sign generator also loads
`qrcodejs` to draw the code. The two files under `functions/` run on Cloudflare
rather than in the browser, and Pages picks them up on its own.

## Running it locally

The gate runs on Cloudflare, so a plain file server will not exercise it. Use
Wrangler, which runs the functions the way production does:

```sh
cd putt-putt-card
npx wrangler pages dev . --binding QR_SIGNING_KEY=local-test ADMIN_KEY=local-admin
# then open the address it prints
```

For a look at the scorecard alone, any static server will do, and the gate
simply stays open because no signing key is set:

```sh
python -m http.server 8000
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

## The sign, and who may issue one

`/admin` mints a code and lays out the sign that carries it: choose how long it
stays valid, type the course name, print. The scorecard itself carries no QR
code, because nobody scans a code on a page they could only reach by scanning
it.

### How the gate works

The code embeds a token: an expiry timestamp plus an HMAC-SHA256 signature over
it. `functions/_middleware.js` recomputes that signature before serving the
scorecard and refuses anything forged or lapsed, with a page telling the player
to ask at the kiosk. The signing key lives in a Cloudflare environment variable,
so it is in neither the repository nor anything sent to a browser. That is what
makes the limit real rather than decorative: a check written in page JavaScript
could be stepped around by anyone who opened the developer tools.

One scan covers the round. A valid token sets a 12-hour pass cookie, capped at
the token's own life, so reopening a closed tab mid-round does not mean
fetching the sign again.

### Setting it up

In the Cloudflare dashboard, under the Pages project → **Settings** →
**Variables and secrets**, add two encrypted values:

| Name | Value |
| --- | --- |
| `QR_SIGNING_KEY` | A long random string. Signs and verifies codes. |
| `ADMIN_KEY` | A second random string. You type this into `/admin` to issue codes. |

Redeploy afterwards; environment variables only reach a new deployment.

Optionally add `ADMIN_EMAIL` and put **Cloudflare Access** in front of `/admin*`
and `/api/*` (Zero Trust → Access → Applications → Self-hosted, with a policy
allowing that one email). Then issuing a code needs a real login rather than a
typed key. Worth doing if the admin key might end up on a shared machine.

### Revoking

Generating a code does not cancel the ones already printed; each runs to its own
expiry. To stop every outstanding code at once, change `QR_SIGNING_KEY` and
redeploy. Signatures made with the old key stop verifying immediately, so print
a fresh sign straight after.

### Before it is configured

With no `QR_SIGNING_KEY` set, the gate stays open and the scorecard serves to
anyone, so a half-finished setup does not take the site down. Issuing codes
fails closed in the same situation: `/api/token` refuses until both the signing
key and an owner check exist.

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
- **Share one live card between phones.** That needs a database; the functions
  here hold no state at all.
- **Keep any record of a round.** Scores never leave the phone that typed them.
- **Track who scanned what.** A token says when it lapses and nothing else: no
  identifier, no counter, no log of who played.
