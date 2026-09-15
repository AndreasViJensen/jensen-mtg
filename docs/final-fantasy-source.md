# Final Fantasy ratings decision

The Final Fantasy answer key is the 17Lands card-data page:

https://www.17lands.com/card_data?expansion=FIN&format=PremierDraft&time_period=ALL_TIME

Use FIN, Premier Draft, All users, All Time, with no color or rarity filters.
The selected metric is **Win Rate in Hand (Opener or Drawn)**. The app stores
the page's literal letter grades alongside the page's displayed one-decimal
win rates; it does not derive grades from the SOS thresholds.

The snapshot in `web/data/final-fantasy.json` contains all 357 rows shown by
the page. 348 rows have a displayed win rate and are used for training and
Browse rankings. The nine rows with a `-` grade have no score and are retained
for provenance but excluded from play and rankings.

Higher displayed win rate in hand wins, including within the same letter
grade. Equal displayed percentages tie. This is a stored snapshot, not a live
connection. To refresh it, use the same filters and metric, preserve the
literal grades and displayed precision, and update the verification checks in
`tests/app.test.cjs` only after comparing the complete source page.

17Lands supplies the ratings and grades. Scryfall supplies the card images and
type metadata used by the app. The site footer credits both sources.

## Verified snapshot

The snapshot was checked against the supplied All-users FIN table and grade
grid. The canonical FNV-1a checksum over all name, grade, and displayed score
rows is `3328844481`; the checksum over name, color, and rarity metadata is
`2431312925`. There are 23 F-tier cards and 9 ungraded cards.
