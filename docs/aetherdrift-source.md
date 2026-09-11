# Aetherdrift ratings decision

The user selected this page as the Aetherdrift answer key:
https://www.17lands.com/card_data?expansion=DFT&format=PremierDraft&time_period=ALL_TIME

Use DFT, PremierDraft, All Time, All users, with no color or rarity filters.
The selected metric is Win Rate in Hand (Opener or Drawn).
Store the page's literal letter grades alongside its win rates; do not derive
them using the existing SOS Avg Norm thresholds.
The app includes the full 281-card snapshot in `web/data/aetherdrift.json`.
277 cards have ratings; the four ungraded cards are retained with null win rates
and excluded from training and browsing. Higher displayed win rate wins, even
within a letter grade; equal displayed percentages tie. Scores use the page's
one-decimal percentage precision.

Names, grades, and displayed scores were checked against the complete rendered
Grades grid (sorted canonical FNV-1a checksum 3948192544). Colors and rarities
were checked against the Table view (checksum 1308456291, sorted color letters).
Scryfall supplies card types, mana costs, and image URLs. Bonus-card rarities
follow 17Lands, which can differ from another printing's rarity.

This is a stored snapshot, not a live connection. To refresh it, use the same
filters and metric, preserve literal grades, and update the verification
checksums in `tests/app.test.cjs` only after comparing the full source grid.

## Verified F-tier snapshot (2026-09-11)

Read directly from the rendered Grades grid; colors follow its column headers.

| Card | Color column | Grade | Win rate in hand |
| --- | --- | --- | --- |
| Interface Ace | White | F | 49.4% |
| Lightwheel Enhancements | White | F | 48.7% |
| Alacrian Armory | White | F | 46.5% |
| Thoughtcast | Blue | F | 49.5% |
| Spell Pierce | Blue | F | 49.3% |
| Stall Out | Blue | F | 49.1% |
| Repurposing Bay | Blue | F | 46.8% |
| Unstoppable Plan | Blue | F | 37.7% |
| Bloodghast | Black | F | 49.0% |
| Bone Miser | Black | F | 46.8% |
| Reckless Velocitaur | Red | F | 49.3% |
| Full Throttle | Red | F | 45.6% |
| Point the Way | Green | F | 43.7% |
| Ketramose, the New Dawn | Multicolor | F | 46.8% |
| Racers' Scoreboard | Colorless | F | 48.5% |

The separate ungraded '-' row is not F tier.
