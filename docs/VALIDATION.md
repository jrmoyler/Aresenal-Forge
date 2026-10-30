# Validation results

- `npm test`: 10 passed, 0 failed.
- `npm run validate`: 595 unique catalog entries; baseline manifest has 595 missing assets.
- `npm run build`: production bundle succeeds. Three.js is lazy-loaded on first GLB preview; the renderer chunk remains large (expected dependency cost).
- `node tools/browser-check.mjs`: desktop and mobile navigation, search, selection, persistent notes, categories, pagination, empty state, integration page, manifest download, malformed GLB rejection, valid test GLB preview/persistence, evidence stage and no horizontal overflow/page exceptions passed.
- `git diff --check`: passed.

GLB preview uses a synthetic triangle **only as a test fixture**. It is not a shipped weapon, approved art, or evidence of Babylon/Three visual parity. Browser screenshots show the unpopulated production catalog. No physical Steam Deck measurements, Babylon parity, or end-to-end Aetherion combat verification was performed.
