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
