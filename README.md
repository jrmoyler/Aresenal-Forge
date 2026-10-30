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
- Three.js PBR preview with orbit/zoom, environment lighting, camera fitting and playback of the first embedded animation. GPU resources are disposed when changing assets.
- IndexedDB asset persistence, local production notes and provenance, license, integration, visual-review and test-evidence fields.
- Evidence-derived production stages and JSON exports for the whole manifest or selected brief. Exports include metadata, not GLB bytes; preserve original binaries separately. Local edits are browser-local, not automatically pushed to GitHub.
- Engine-independent contact-candidate generation, per-cast/per-window deduplication, and a Biome Triad `sample(x,z)` utility. No gameplay damage is calculated here.
- Automated tests, build checks and a reproducible browser workflow test.

## Content status

**595 records; 0 approved shipping assets.** The attached ZIP contains briefs and planning slots, no models, source geometry, textures, animations, audio, or approved references. This application does not invent substitute art or mark those slots complete. Importing a GLB does not certify its appearance, sockets, gameplay or engine parity. Stages are based on the evidence the operator records; they are not independent verification.

The full art-production definition of done in `agent/AGENT_TASK.md` remains outstanding: individual editable sources and licensed references, approved PBR GLBs, animation/sweep authoring, all 23 elemental integrations, both-engine captures, and physical Steam Deck testing. The Forge workspace is implemented; the 595-asset production program is not complete.

## Integration

See `docs/SOURCE_AUDIT.md` for current upstream findings. Original supplied instructions remain in `shared/` and `agent/` for provenance, with an audit notice pointing to corrections. The upstream repositories have not been modified. Arsenal does not independently connect to a game server or submit UCSM events. Host wiring and asset-specific alignment require integration testing.

## Verification

`npm test` covers catalog conservation, evidence gates, export isolation, malformed GLBs, vectors, deduplication and surface sampling. `npm run validate` writes the baseline `data/manifest.json` (all missing) from source records. Browser checks require `npx playwright install chromium`, then run `node tools/browser-check.mjs` (it starts its own local server). QA screenshots are under `docs/evidence/`.
