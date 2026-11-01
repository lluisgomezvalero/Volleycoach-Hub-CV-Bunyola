import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const root=resolve('.');
function moduleRef(ref,parent){const url=new URL(ref,`file://${parent}`);return url.pathname+url.search;}
function graph(){
 const html=readFileSync(resolve(root,'index.html'),'utf8'),entry=moduleRef(html.match(/<script[^>]+src="([^\"]+)"/)[1],resolve(root,'index.html')),seen=new Map();
 function visit(ref){const file=ref.split('?')[0];if(seen.has(ref)||!existsSync(file)||!file.endsWith('.js'))return;const text=readFileSync(file,'utf8');seen.set(ref,text);for(const expression of [/(?:import|export)\s*(?:[^"'\n]*?\bfrom\s*)?["'](\.[^"']+)["']/g,/import\(["'](\.[^"']+)["']\)/g])for(const match of text.matchAll(expression))visit(moduleRef(match[1],file));}
 visit(entry);return {entry,seen};
}
test('all active screen and session imports share one app bootstrap and React runtime, including query versions',()=>{
 const {entry,seen}=graph(),bootstraps=[...seen].filter(([,code])=>code.includes('createRoot(document.getElementById("root"))')).map(([path])=>path);
 assert.deepEqual(bootstraps,[entry],`More than one application runtime is reachable: ${bootstraps.join(', ')}`);
 for(const file of ['assets/session-recurrence-20261011.js','assets/index-NTH10f-r.js'])assert.ok([...seen.keys()].some(ref=>ref.split('?')[0]===resolve(root,file)));
});
test('shared client/React export shim targets the exact versioned HTML entrypoint',()=>{
 const {entry}=graph(),shim=resolve(root,'assets/index-NTH10f-r.js'),target=readFileSync(shim,'utf8').match(/export \* from ["']([^"']+)/)[1];assert.equal(moduleRef(target,shim),entry);
});
test('every reachable application import bypasses old ten-minute cached modules with the same version',()=>{
 const {entry,seen}=graph(),version=entry.split('?')[1];assert.ok(version);
 for(const [ref,code] of seen){assert.equal(ref.split('?')[1],version,ref);for(const match of code.matchAll(/["'](\.{1,2}\/[^"']+\.js(?:\?[^"']*)?)["']/g))assert.equal(moduleRef(match[1],ref.split('?')[0]).split('?')[1],version,match[1]);}
});
