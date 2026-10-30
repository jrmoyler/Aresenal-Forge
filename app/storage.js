const DB='arsenal-forge-assets';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function assetStore(id,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('assets',value===undefined?'readonly':'readwrite');const store=tx.objectStore('assets');const r=value===undefined?store.get(id):store.put(value,id);tx.oncomplete=()=>{db.close();resolve(r.result);};tx.onerror=()=>{db.close();reject(tx.error);};});}
export function loadRecords(){try{return JSON.parse(localStorage.getItem('arsenal-records-v1')||'{}');}catch{return {};}}
export function saveRecords(records){localStorage.setItem('arsenal-records-v1',JSON.stringify(records));}
export function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
