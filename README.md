# MTG Card Evaluation Trainer

Local browser app for practicing draft card comparisons using the `Avg Norm` scores from the SOS ratings page as the answer key.

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
- After you click one card, the app reveals both `Avg Norm` values and tells you whether your pick was correct.

## Refresh the dataset

If you want to regenerate `web/data/cards.json` from a fresh copy of the source page:

```bash
curl -sS -L 'https://toskicologist.github.io/MTG-draft-sets-infographics/sos-ratings-v2.html' -o /tmp/sos-ratings-v2.html
python3 scripts/extract_cards.py /tmp/sos-ratings-v2.html web/data/cards.json
```

You still need internet access at runtime for Scryfall card images.
