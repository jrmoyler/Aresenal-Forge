# Authored artwork batches

The remaining 593 catalog entries are rebuilt by six editable Three.js authoring
programs. IDs and runtime paths are preserved. The original upgraded longsword
and Frontier Bound chest are deliberately retained.

| Batch | Catalog models | Authoring source |
| --- | ---: | --- |
| Weapons | 74, plus 148 LOD files | `sources/upgrades/weapons.mjs` |
| Armor | 60 | `sources/upgrades/armor.mjs` |
| Interactive props | 99 | `sources/upgrades/interactive.mjs` |
| Environment props | 120 | `sources/upgrades/environment.mjs` |
| Construction and mechanisms | 90 | `sources/upgrades/mechanisms.mjs` |
| Material specimens and attachments | 150, plus 300 texture maps | `sources/upgrades/materials-attachments.mjs` |

These sources define shaped profiles, layered assemblies, joints, fittings,
material surfaces, and type-specific variations. They do not apply a generic
subdivision filter to the old pack. Static meshes are consolidated by material;
moving assemblies retain their pivots. Surface maps are original deterministic
procedural artwork, not photography, scans, or high-poly bakes. Armor remains
rigid equipment geometry; it is not skinned clothing.

## Recorded quality pass (2026-10)

All six batches were revised, regenerated, rendered and recorded. Every
manifest entry for the 593 assets now reads `artworkRevision:
authored-upgrade-2026-10` with fresh hashes and evidence in
`docs/evidence/upgrades/`. The pass fixed floating, intersecting and
below-ground parts. It replaced blobby rock and armor forms with faceted or
plated construction, and made variants structurally distinct rather than
recoloured. Texture maps were derived from one height field. Weapon socket
nodes match the briefs, and the renderer now records original glTF node names.
Unindexed geometry and incompressible noise maps were removed, so
`public/assets` is 396 MB rather than the 588 MB the unrevised sources produced
(the earlier legacy pack was 209 MB), with identical paths and counts. Known
open items: some textures read grainy at preview scale, glass and crystal read
dark or milky, a few environment props (anchor, fence, sconce, cart, reeds,
ferns) were not revised, and nothing is rig-fitted. This is still not art
approval.

## Reproduce one batch

From the repository root, after `npm ci` and `npx playwright install chromium`:

```sh
node sources/upgrades/armor.mjs
node tools/render-upgrades.mjs armor
node tools/record-upgrade-batch.mjs armor
npm run verify:upload
```

Replace `armor` with a batch name from the source filenames. The rendering tool
imports every model into Three.js, creates a matching 640px WebP studio preview,
measures bounds/triangles/materials, and samples embedded mechanical clips.
Evidence is written to `docs/evidence/upgrades/<batch>.json`. Recording a batch
requires all expected captures and refreshes source/model/texture hashes.

The PR-specific workflow regenerates and uploads six separate asset commits.
It is restricted to PR #2 on the same repository's `feat/forge-asset-upgrade`
branch. The binary GLBs, texture maps, and previews are committed, not merely
left as transient build artifacts. `npm run verify:upload` verifies the complete
595-model delivery including the two retained models.

## Evidence boundaries

An authored asset has an editable source and runtime file. It is not thereby
approved for final art, host gameplay, character rig fitting, cross-engine
parity, or a hardware performance budget. These candidates have not received
photoreal/AAA art signoff. Mechanical object clips are not character attacks.
The Forge shows authored source evidence separately from availability and later
acceptance stages. No invented reference, reviewer, frame rate, or integration
result is used to advance those stages.

## Forge high-detail remaster (`forge-high-detail-2026-10`)

Every delivery file was rebuilt from the PR #3 checkout (`29e7e70`) by the
deterministic pipeline in `tools/remaster/`: 745 GLBs (catalog models and
LODs), the 300 tileable material maps and all 595 preview stills. Running the
pipeline twice yields byte-identical output.

- `remaster.py` verifies each source against its manifest SHA-256, applies
  seam-aware subdivision (`geometry.py`, skipped for LOD 2), adds hardware and
  wear detail (`details.py`) and material finish layers
  (`forge_finishes.py`: sheen, clearcoat, IOR, refined embedded maps).
- `forge_surface_maps.py` refines the 100 periodic material sets while keeping
  packed AO and metal masks.
- `render_previews.py` renders 512px catalog stills headlessly (libEGL/libGL).
- `runtime-check.mjs` imports every model with Three.js GLTFLoader, checks
  finite bounds and samples each clip; results are in
  `docs/evidence/remaster-runtime.json` (745 passed, 0 failed).
- `refresh.py` rewrites the pack manifest, catalog evidence hashes and
  `docs/SHA256SUMS.txt`, recording each model's input SHA-256.

```sh
git worktree add ../forge-base 29e7e70
python3 tools/remaster/forge_surface_maps.py ../forge-base/public/assets/materials public/assets/materials
python3 tools/remaster/remaster.py ../forge-base .
python3 tools/remaster/render_previews.py public
node tools/remaster/runtime-check.mjs
python3 tools/remaster/refresh.py . --baseline ../forge-base --runtime-report docs/evidence/remaster-runtime.json
npm run verify:upload
```

Catalog triangles rose from 4.64M to 19.2M and the pack (models + LODs) from
344 MB to 819 MB; 93 models are now `high-detail` (>60k triangles). Runtime
import is evidenced; visual approval, rig fit, gameplay and Steam Deck
performance remain unapproved.
