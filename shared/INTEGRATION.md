> Historical kit contract. Read `docs/SOURCE_AUDIT.md` first: active renderer and surface-layer statements below have changed upstream.

# Integration contract — all five content libraries and Aetherion

## Current verified source architecture (inspection 2026-10-25)
- **Ability Matrix** `jrmoyler/Ability-Matrix`: UCSM `CombatStateManager.js`, `ontology.js` with 23 IDs, `reactions.js`, `PackAdapter.js`, state at **30 Hz**; the README documents 230 active castables and 161 proposed additions (not yet playable). Lightning ID is `storm`.
- **Biome Triad** `jrmoyler/biome-triad`: six baseline biomes and `Helios.registerBiome`. Dynamic surface layer was delivered separately as `Biome_Triad_Dynamic_Surface_Environmental_State_Layer.zip`; verify its installed API against the source before binding here.
- **Aetherion** `jrmoyler/Aetherion-The-Fifteen-Oaths`: README advertises a Babylon.js MMO in `game/` and a distinct Three.js Ability Matrix workflow. Do not assume a single renderer. Inspect `game/CONTRACTS.md` and runtime before writing adapters.

## Five library roles
1. Ability Matrix: castable source of truth + UCSM for reactions/status.
2. Biome Triad: terrain, wetness, conductivity, destruction-compatible surface values, climate, weather.
3. Arsenal Forge: GLB weapon/armor/prop definitions, attachment sockets, material collision profiles, timings and footprint data.
4. Combat Dynamics Lab: hit-to-effect mappings, physics presentation, particles, hit stop, spatial audio and damage feedback. **Never computes authoritative health loss**.
5. Character Forge: visual bodies, approved reference provenance, rigs, animation banks, character sockets, hit zones.

## REQUIRED minimum integrations
- Register immutable pack manifests and versioned `assetId`, `characterId`, `weaponId`, `effectPresetId`.
- During animation, Character Forge exposes world-space socket transforms; Arsenal Forge attaches via socket map; Combat Dynamics tracks collision sweeps from weapon/socket poses.
- On verified contact, the host forwards a normalized, unique hit/terrain-impact event to UCSM. UCSM validates and commits outcomes, then Combat Dynamics consumes cues/outbox to render. No feedback loop may create a second authoritative hit.
- On terrain contact, Biome Triad returns `surfaceId`, material tags and environment values; host submits a mapped terrain-impact. World changes are authored by biome layer, and only resulting eligible elemental status regions are reported to UCSM.
- All packets must allow negative and unknown-state cases. Version mismatch and missing assets must cause a visible diagnostic and safe fallback, never silently substituting misleading art.

## Determinism/authority rules
Fixed 30 Hz logic for UCSM; render on interpolation. Multiple engines may render the same events but cannot calculate different damage. Network authority must be bound to the real Aetherion server implementation, **not presumed**. Every secondary event has parent ID, generation depth and a bounded budget. No presentation consumer may call `UCSM.submit` in response to its own visual cue.

## Engine adapters
- GLB export specification: Y-up, meter-scale, neutral root, explicit material channels, validated normals/tangents, named bones/sockets. Use engine adapter matrices; Babylon's coordinate conventions can differ depending on scene configuration.
- Three.js: GLTFLoader + AnimationMixer; verify skin material limits, morphs and attachment spaces.
- Babylon.js: SceneLoader/AssetContainer + AnimationGroups and skeleton retarget mapping; verify orientation and handedness on import.
- Provide video/screenshots from **both** runtimes before art approval.

## Merge gate
Pass schema tests, deterministic tests, no leaked GPU resources, screenshot baselines, feature parity, and real-hardware budget tests. No `complete` claims for concept-only placeholders or unreviewed auto-generated meshes.
