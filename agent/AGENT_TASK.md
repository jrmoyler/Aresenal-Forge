# Assignment: build Arsenal Forge to production quality

Implement the inventory in `data/` into actual editable source and shippable assets for Aetherion. Consult `README.md`, `docs/`, and `shared/` first. Inspect the current GitHub source of Ability Matrix, Biome Triad and Aetherion before coding. Work in small verifiable batches with no synthetic progress claims.

## Definition of done
- Each entity has an actual source asset, exported runtime file(s), manifest with SHA256 and rights/provenance, performance tier, preview capture and validation metadata.
- No item marked `complete` unless its individual gameplay/runtime integration and art-quality criteria pass.
- Test 23 elemental signatures via existing UCSM ontology (ID `storm` for Lightning); integrate actual installed dynamic surface layer via adapter, do not assume path/API.
- Prove Three.js and Babylon.js import/animation/material parity. Test Steam Deck on actual device before asserting frame-rate budgets.
- Preserve compatibility and all five source repositories; no arbitrary vendor rewrites.
- Publish progress matrix with `missing / authored / integrated / visually-approved / tested` states.

## Handoff to coding agent
Deliver versioned manifests, validated GLBs/textures/audio/source, working standalone preview, automated checks, screenshots/video, and exact Git revision/hashes. Follow `shared/AGENT_INTEGRATION_PROMPT.md`.
