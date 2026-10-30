# Authored Three.js asset library

The Forge now contains 595 loadable assets, with original editable Three.js source and self-contained PBR GLBs. The inspector loads the selected asset automatically, verifies its SHA-256, previews it and offers a GLB download. Browser-imported replacements take precedence and retain their own provenance.

| Collection | Assets | Contents |
|---|---:|---|
| Weapons | 75 | 15 families, individually selected silhouettes and components, 3 detail tiers each |
| Armor | 60 | 12 equipment slots × 5 construction styles; rigid, awaiting character fit |
| Interactive props | 100 | 20 functional designs × 5 construction variants |
| Environment props | 120 | 24 environmental designs × 5 variants |
| Materials | 100 | 10 surfaces × 10 finishes; 300 PNG maps and 100 material swatch GLBs |
| Attachments | 50 | 10 equipment attachment designs × 5 variants |
| Construction modules | 60 | 12 modular structures × 5 variants |
| Animated mechanisms | 30 | 6 mechanisms × 5 variants, with looping transform clips |

Supplementary variants share their core design. These are not 460 unrelated sculpted hero models. Source inventory IDs and original briefs remain intact; the authored names are proposals recorded in the generated manifest.

## Native studio

Open `native.html` (or click **Native studio** in the Forge) to render all assets directly from their Three.js source. It supports asset selection, detail tiers, orbit controls and mechanism playback without fetching GLBs. The production build includes both pages.

## Use the native Three.js assets

```js
import * as THREE from 'three';
import { createArsenalAsset } from './src/asset-factory.mjs';

const asset = createArsenalAsset('arsenal:swords/katana', { lod: 0 });
scene.add(asset.object);
// Geometry is authored directly in Three.js; no GLB download is needed.
const grip = asset.object.getObjectByName('grip.primary');
// Align this local grip transform to the host's hand socket.
// Do not assume the origin matches a particular character skeleton.

// For a mechanism, play its provided moving-assembly clip:
const machine = createArsenalAsset('arsenal:animated_mechanisms/001');
scene.add(machine.object);
const mixer = new THREE.AnimationMixer(machine.object);
for (const clip of machine.animations) mixer.clipAction(clip).play();
// In the host frame loop: mixer.update(deltaSeconds).
// On teardown: stop/uncache the mixer, detach the objects, then dispose.
mixer.stopAllAction();
mixer.uncacheRoot(machine.object);
scene.remove(machine.object);
machine.dispose();
scene.remove(asset.object);
asset.dispose();
```

Use a bundler with JSON import support and the pinned Three.js version. The factory owns its materials/textures/geometries per instance. `dispose()` is idempotent. It does not dispose host resources or remove its object from the scene. `arsenalAssetIds` exposes every supported ID. `lod` accepts 0, 1 or 2; discrete exported LOD files currently cover weapons. Load only the models required by the scene; do not preload the entire pack on mobile.

## Use the GLBs

Load `assets/manifest.json`, find the asset by ID, then load its `path` with `GLTFLoader`. The actual files live under `public/assets/` and Vite copies them unchanged into the build. Weapons use their original prescribed paths. GLBs embed their maps and require no texture sidecar or compression decoder.

Meters, +Y up, right-handed coordinates. Handle-centric weapons generally extend along +Y, while ranged muzzles face −Z. Inspect per-asset sockets and align them to the host rig. Do not treat a global axis convention as proof of correct rig fitting. Unused socket names are explicitly listed in `unavailableSockets` rather than fabricated.

Bounds and coarse AABB proxies come from generated geometry. They are suitable for initial placement/broadphase checks, not damage volumes or validated animation sweeps. Collision proxies are metadata and do not render as visible meshes.

## Rebuild and verify

```sh
npm ci
npm run assets:generate
npm run assets:validate
npm run validate
npm test
npm run build
node tools/check-generated-browser.mjs
node tools/check-babylon-import.mjs
node tools/browser-check.mjs
```

- `src/assets/geometry.mjs`: beveled components, shaped blades and shared geometry helpers.
- `src/assets/weapons.mjs`: all 75 named weapon recipes and functional attachment sockets.
- `src/assets/armor.mjs`: armor construction and rigid equipment recipes.
- `src/assets/props.mjs`: props, modular construction and moving assemblies.
- `src/assets/surfaces.mjs`: deterministic tileable PBR pixel generation.
- `sources/assets/`: individual recipe snapshots with provenance.
- `data/generated-assets.json`: paths, hashes, sizes, mesh/triangle counts, bounds and statuses.
- `docs/evidence/assets/validation.json`: Khronos validation of all 745 GLBs.
- `docs/evidence/assets/three-runtime.json`: all base assets loaded and rendered in Three.js.
- `docs/evidence/assets/babylon-import.json`: all GLBs parsed by Babylon NullEngine; this is not GPU visual parity.
- `docs/evidence/assets/contact-sheets/`: actual rendered assets grouped for review.

The browser render harness uses software rendering. Its draw-call counts are useful, but its timing is not a Steam Deck performance benchmark. The runtime and structural checks establish loadability; they do not grant visual approval. The matrix stays at **authored** until the host integration, review and device gates are met.

## Integration boundaries

The current upstream READMEs were inspected during this pass. Ability Matrix now describes 279 castables; Biome Triad includes its dynamic surface layer; Aetherion exposes several runtime paths, including a Babylon MMO and Three.js content. This PR changes only Arsenal Forge. It does not replace those repositories, submit UCSM damage, invent host interfaces, or assert live element/surface integration. The original 23-element requirements still need host-side verification.
