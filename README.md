# Arsenal Forge

A runnable asset-production workspace for Aetherion, built from the supplied Arsenal Forge Agent Production Kit. The GitHub repository intentionally retains the user-provided spelling `Aresenal-Forge`.

## Run

Node 22+:

```sh
npm ci
npm run dev
npm test
npm run validate
npm run build
```

Deploy the generated `dist/` folder to any static host, or use Vercel's Vite preset. No server secrets or database credentials are required. Use HTTPS or localhost for browser SHA-256 support.

## What works

- All 75 weapon briefs, 60 armor candidates and 460 supplementary production slots, preserving the supplied IDs and data.
- Search, family filtering, pagination and selected-item inspection across the complete catalog.
- Self-contained GLB import (50 MB limit), structural inspection and SHA-256 hashing. External resources are rejected.
- Bundled authored models with SHA-256 checks and downloads. Native Three.js asset factory for host games.
- Three.js PBR preview with orbit/zoom, environment lighting, camera fitting and playback of the first embedded animation. GPU resources are disposed when changing assets.
- IndexedDB asset persistence, local production notes and provenance, license, integration, visual-review and test-evidence fields.
- Evidence-derived production stages and JSON exports for the whole manifest or selected brief. Exports include metadata, not GLB bytes; preserve original binaries separately. Local edits are browser-local, not automatically pushed to GitHub.
- Engine-independent contact-candidate generation, per-cast/per-window deduplication, and a Biome Triad `sample(x,z)` utility. No gameplay damage is calculated here.
- Automated tests, build checks and a reproducible browser workflow test.

## Content status

**595 authored assets are included:** 75 weapons, 60 armor pieces, 100 interactive props, 120 environment props, 100 PBR material swatches, 50 attachments, 60 construction modules and 30 animated mechanisms. Weapons include 150 additional LOD exports. The material library includes 300 PNG maps.

Every asset has editable Three.js authoring code, a per-record source recipe, a self-contained GLB, hashes, measured bounds and mesh statistics. Models load automatically in the inspector. Use `createArsenalAsset(id)` from `src/asset-factory.mjs` to build them directly in a Three.js game without fetching GLBs. See [the asset guide](docs/GENERATED_ASSETS.md) and [provenance](ASSET_PROVENANCE.md).

These assets are at the **authored** stage, with no automatic shipping-art approval. Armor remains rigid and needs character rig fitting. Attack sweeps, host combat/element integration, visual signoff and actual Steam Deck performance remain outstanding. Supplementary slot designs are proposed and use explicitly documented construction variants.

## Integration

See `docs/SOURCE_AUDIT.md` for current upstream findings. Original supplied instructions remain in `shared/` and `agent/` for provenance, with an audit notice pointing to corrections. The upstream repositories have not been modified. Arsenal does not independently connect to a game server or submit UCSM events. Host wiring and asset-specific alignment require integration testing.

## Verification

`npm test` covers catalog conservation, evidence gates, export isolation, malformed GLBs, vectors, deduplication and surface sampling. `npm run validate` writes `data/manifest.json` from source records and bundled asset evidence. Browser checks require `npx playwright install chromium`, then run `node tools/browser-check.mjs` (it starts its own local server). QA screenshots are under `docs/evidence/`.
