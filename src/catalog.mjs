export const STAGES=Object.freeze(['missing','authored','integrated','visually-approved','tested']);
export function createCatalog(weapons,armor,slots){
 const all=[...weapons.map(x=>({...x,kind:'weapons'})),...armor.map(x=>({...x,kind:'armor',name:`${x.slot} ${x.id.split('/').at(-1)}`,family:x.slot})),...Object.entries(slots).flatMap(([family,items])=>items.map(x=>({...x,kind:'slots',family,name:x.productionName})))];
 if(new Set(all.map(x=>x.id)).size!==all.length)throw Error('Duplicate catalog IDs');
 return all;
}
export function shippedAssetPath(item){
 return item.geometry?.glb??item.model??(item.kind==='slots'?`assets/${item.family}/${item.id.split('/').at(-1)}.glb`:null);
}
export function previewFile(item){return `assets/previews/${item.id.replaceAll(':','-').replaceAll('/','-')}.webp`;}
export function filterCatalog(items,{kind,query='',family='all'}={}){const q=query.toLowerCase().trim();return items.filter(x=>(!kind||x.kind===kind)&&(family==='all'||x.family===family)&&`${x.name} ${x.id} ${x.family}`.toLowerCase().includes(q));}
export function productionStage(record={}){
 if(!record.asset?.sha256)return 'missing';
 if(!record.source?.trim()||!record.license?.trim())return 'missing';
 if(!record.integrationEvidence?.trim())return 'authored';
 if(!record.visualEvidence?.trim())return 'integrated';
 if(!record.testEvidence?.trim())return 'visually-approved';
 return 'tested';
}
export function exportManifest(catalog,records={}){return {schemaVersion:'arsenal-forge/1.0.0',packId:'arsenal:core',coordinateSystem:{units:'meters',upAxis:'Y',handedness:'right'},authority:'host',assets:catalog.map(x=>({id:x.id,name:x.name,kind:x.kind,family:x.family,expectedPath:shippedAssetPath(x),stage:productionStage(records[x.id]),evidence:structuredClone(records[x.id]??{})}))};}
