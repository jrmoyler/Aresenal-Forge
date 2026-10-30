# Source inspection — 2026-10-29

The ZIP has 14 files totaling 294,751 uncompressed bytes: JSON production definitions, reference registry and two tests. It does not contain binary art. The 75 weapons span 15 families; the 60 armor records span 12 slots; supplementary categories total 460. All 595 IDs are preserved.

## Upstream inspection

| Repository / path | Inspected file blob SHA | Finding |
|---|---|---|
| Ability-Matrix / packs/sandbox/src/combat/ucsm/ontology.js | 8fff34bd6560ae4127d45e93eae0154f3cbfb9d4 | 23 canonical elements; Lightning is `storm` |
| biome-triad / README.md | e75bf7cb2917d9ce7117214299eca6227026363b | 17 worlds, installed surface-state extension |
| biome-triad / extensions/surface-state/README.md | d39d344b1dcfdf3d2577428a7b834865fdeb659e | `createBiomeSurfaceLayer`; `sample(x,z)`, `impact`, `update` |
| Aetherion-The-Fifteen-Oaths / game/CONTRACTS.md | 7ab949d25495b4910833640caef829ea2da9c496 | Shipped Three.js 0.180 runtime; older Babylon sections are legacy |

These are file blob hashes, not repository commit pins. Production integration must pin repository commits and run host-level tests; no live multi-repository integration is claimed here.

## Corrections to supplied kit

The kit's six-biome / separate-surface-layer and Babylon-active statements are stale. Aetherion's active runtime is Three.js. The authoring contract's −Z forward convention conflicts with the character contract's +Z facing; do not apply a blanket rotation. Inspect attachment transforms for every asset and rig. Babylon import parity remains a requested but unverified acceptance gate.

## Implemented vs outstanding

Implemented: production catalog, evidence records, browser persistence, local GLB inspection and Three.js preview, JSON handoff exports, metadata manifest, host-safe contact candidate utilities, tests and static build.

Outstanding: all actual shipping art, editable sources, licensed references, individualized animation/hit windows, gameplay attachment bindings, infusion implementations, Babylon parity captures, physical device performance and external art signoff. Source kit placeholders are not converted into fabricated balance data or assets.
