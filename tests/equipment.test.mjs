import test from 'node:test';import assert from 'node:assert/strict';import {validateWeapon,resolveEquipmentEvent,WEAPON_FAMILIES} from '../src/equipment-registry.mjs';import fs from 'node:fs';
const weapons=JSON.parse(fs.readFileSync(new URL('../data/weapons.75.json',import.meta.url)));
test('75 distinct weapon briefs and 15 families',()=>{assert.equal(weapons.length,75);assert.equal(new Set(weapons.map(w=>w.id)).size,75);assert.equal(WEAPON_FAMILIES.length,15);for(const w of weapons) assert.ok(validateWeapon(w));});
test('emits candidate not damage',()=>{const e=resolveEquipmentEvent({weapon:weapons[0],ownerId:'p',targetId:'e',castId:'c',tick:1,position:[0,1,0],normal:[0,1,0]});assert.equal(e.kind,'contact-candidate');assert.equal(e.authority,'host-must-validate-before-ucsm-submit');});
