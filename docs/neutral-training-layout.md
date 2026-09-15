# Neutral training layout trial

Checkpoint before this trial: `before-neutral-training` (a6bd7ec).

The page asks for the user's judgment, displays both source scores in the familiar result box, and describes agreement with the source without calling the user correct or incorrect. Equal displayed scores are tracked separately.

To undo the trial, revert the redesign commit and redeploy `web/` to the existing Jensen MTG Cloudflare targets. The checkpoint also preserves the exact preceding version. Avoid resetting history or restoring unrelated subsequent work.
