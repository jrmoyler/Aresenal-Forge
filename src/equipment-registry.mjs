export const WEAPON_FAMILIES=Object.freeze(['swords','short_blades','polearms','heavy_impact','archery','casting_implements','ritual','martial','flexible','thrown','tech_ranged','integrated','shields','manifested','deployables']);
export function validateWeapon(w){if(!w||typeof w.id!=='string'||!w.id.startsWith('arsenal:'))throw Error('bad weapon id');if(!WEAPON_FAMILIES.includes(w.family))throw Error('unknown family');if(!w.geometry||!Array.isArray(w.geometry.sockets))throw Error('missing socket plan');if(!w.gameplay?.collision)throw Error('missing collision strategy');return true;}
export function resolveEquipmentEvent({weapon,ownerId,targetId,castId,tick,position,normal,windowId='primary',surfaceId=null}){
 validateWeapon(weapon);if(!ownerId||!castId||!Number.isSafeInteger(tick)||tick<0||!windowId)throw Error('missing combat context');
 for(const vector of [position,normal])if(!Array.isArray(vector)||vector.length!==3||!vector.every(Number.isFinite))throw Error('invalid contact vector');
 if(Math.hypot(...normal)<1e-8)throw Error('zero normal');
 return {kind:'contact-candidate',id:JSON.stringify([castId,weapon.id,windowId,targetId??surfaceId??'surface']),ownerId,targetId:targetId??null,surfaceId,weaponId:weapon.id,position:[...position],normal:normal.map(x=>x/Math.hypot(...normal)),tick,windowId,authority:'host-must-validate-before-ucsm-submit'};
}
// One instance per active cast. Close/dispose when the cast ends; no global unbounded cache.
export function createContactCollector(){const seen=new Set();let closed=false;return {accept(input){if(closed)throw Error('Cast collector closed');const event=resolveEquipmentEvent(input);if(seen.has(event.id))return null;seen.add(event.id);return event;},close(){seen.clear();closed=true;}};}
export function sampleSurface(layer,position){if(typeof layer?.sample!=='function')throw Error('Biome surface layer is not connected');if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))throw Error('invalid position');return structuredClone(layer.sample(position[0],position[2]));}
