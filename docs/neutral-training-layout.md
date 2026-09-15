# Neutral training layout trial

Checkpoint before this trial: `before-neutral-training` (a6bd7ec).

The page asks for the user's judgment, displays their selection alongside both source scores, and counts source agreement without grading the user. Equal displayed scores are tracked separately. The result panel uses neutral styling.

To undo the trial, revert the redesign commit and redeploy `web/` to the existing Jensen MTG Cloudflare targets. The checkpoint also preserves the exact preceding version. Avoid resetting history or restoring unrelated subsequent work.
