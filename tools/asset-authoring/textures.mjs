import {PNG} from 'pngjs';
import {surfacePixels,surfaces} from '../../src/assets/surfaces.mjs';
export {surfaces};
export function surfaceMaps(kind,variation=0,size=128){return Object.fromEntries(Object.entries(surfacePixels(kind,variation,size)).map(([key,data])=>{const png=new PNG({width:size,height:size});png.data=Buffer.from(data);return [key,PNG.sync.write(png,{colorType:2})];}));}
