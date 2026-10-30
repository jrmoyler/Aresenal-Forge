# Arsenal production bible — 75 individually indexed base weapons

`data/weapons.75.json` contains every named weapon with its family, hero-asset path, socket plan, animation states, physics contact requirements, reference acceptance, shader and multi-engine gates. **These are production briefs, not created GLBs.**

## Authoring standards
1. Obtain/approve reference contact sheet: orthographic front/back/side, grip detail and material macros. Record licensing and provenance.
2. Build a *different* topology, edge profile, silhouette and mass distribution for each named weapon. Do not merely scale or recolor one generic mesh.
3. Author metal/wood/leather/fabric/crystal material separation; bake tangent-space normals and packed PBR channels and verify in neutral studio lighting and actual in-game light.
4. Place `grip.primary`, `grip.secondary`, `edge.base`, `edge.tip`, `vfx.muzzle`, `holster` sockets in weapon-local coordinates. Unused sockets may be marked unavailable explicitly.
5. Author attack-specific sweeps from actual frame-by-frame animation poses: sword edges, spear tips, hammer head, projectile muzzle, shield face; continuous intersection tests prevent tunneling.
6. Animate follow-through, anticipation, recoil and reverse transitions with real rig grip constraints (including two-handed adjustments).
7. Provide hitboxes, stamina/poise and animation windows in structured JSON; balance values must be playtested and cannot be inferred from labels.
8. Infusion registry covers 23 element IDs, with physical surface material interactions, charging, VFX sockets and constraints; color-only recolor is insufficient.
9. Run screenshot contact sheets, footage, GLB validators, draw call/GPU profiling, repeated spawn/dispose leak tests.

## Armor/props
`armor.60.json` tracks 60 armor candidates; `asset-production-slots.json` tracks 460 structured production slots across six supplementary categories. Slots are backlog definitions, not finished concept art, animations or meshes. Characters must be fitted with real skeletal and morphological rigs rather than just attaching unskinned equipment to the root.

## Agent tasks
Agent A: 15 weapon family reference kits. Agent B: 75 source geometry packages. Agent C: rig attachment and attack sweep authoring. Agent D: 23-element material/infusion factory. Agent E: armor (60). Agent F: props and environmental asset backlog. Agent G: Babylon + Three parity and Steam Deck evidence. Merge only approved batches with hashes and review images.
