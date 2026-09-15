# MTG Card Evaluation Trainer

Local browser app for practicing draft card comparisons. Select SOS (Avg Norm ratings), Aetherdrift, or Final Fantasy (17Lands win rate in hand).

## Run it in a browser

From this directory:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`. The root page redirects to the actual web app in `web/`.

## iPhone wrapper with Capacitor

This repo is now structured so Capacitor can package the static site from `web/` into a native iOS shell.

Prerequisites:

- Node.js and npm
- Full Xcode app installed
- An iPhone connected to the Mac and trusted by Xcode

Commands:

```bash
npm install
npm run cap:add:ios
npm run cap:sync:ios
npm run cap:open:ios
```

That opens the generated iOS project in Xcode, where you choose your personal team, plug in your iPhone as the run target, and press Run.

## How it works

- The local dataset is derived from `https://toskicologist.github.io/MTG-draft-sets-infographics/sos-ratings-v2.html`.
- Each round picks two random cards from the same rarity and the same color bucket.
- Card images are fetched live from Scryfall in the browser.
- After you click one card, the app reveals both scores and letter grades and tells you whether your pick was correct.
- Aetherdrift uses the stored 17Lands DFT / PremierDraft / All Time / All users snapshot. Higher displayed win rate in hand wins, including within the same grade; equal percentages tie.
- The original 17Lands letter grades are stored directly. Four unrated cards are excluded from play and rankings.
- Final Fantasy uses the stored 17Lands FIN / PremierDraft / All Time / All users snapshot. It stores the original letter grades and one-decimal Win Rate in Hand values; nine unrated cards are excluded from play and rankings.
- Switching sets resets the training score and updates Browse rankings and the source link.
- Aetherdrift provenance and refresh notes are in `docs/aetherdrift-source.md`.
- Final Fantasy provenance and refresh notes are in `docs/final-fantasy-source.md`.

Run verification with `npm test`. After web changes, run `npm run cap:sync:ios` before rebuilding the iPhone app.

## Refresh the dataset

If you want to regenerate `web/data/cards.json` from a fresh copy of the source page:

```bash
curl -sS -L 'https://toskicologist.github.io/MTG-draft-sets-infographics/sos-ratings-v2.html' -o /tmp/sos-ratings-v2.html
python3 scripts/extract_cards.py /tmp/sos-ratings-v2.html web/data/cards.json
```

You still need internet access at runtime for Scryfall card images.
