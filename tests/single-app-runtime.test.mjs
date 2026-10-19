import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const root=resolve('.');
function graph(){
 const html=readFileSync(resolve(root,'index.html'),'utf8'),entry=resolve(root,html.match(/<script[^>]+src="([^\"]+)"/)[1]),seen=new Map();
 function visit(file){if(seen.has(file)||!existsSync(file)||!file.endsWith('.js'))return;const text=readFileSync(file,'utf8');seen.set(file,text);for(const expression of [/(?:import|export)\s*(?:[^"'\n]*?\sfrom\s*)?["'](\.[^"']+)["']/g,/import\(["'](\.[^"']+)["']\)/g])for(const match of text.matchAll(expression))visit(resolve(dirname(file),match[1]));}
 visit(entry);return {entry,seen};
}
test('all active screen and session imports share one app bootstrap and React runtime',()=>{
 const {entry,seen}=graph(),bootstraps=[...seen].filter(([,code])=>code.includes('createRoot(document.getElementById("root"))')).map(([path])=>path);
 assert.deepEqual(bootstraps,[entry],`More than one application runtime is reachable: ${bootstraps.join(', ')}`);
 assert.ok(seen.has(resolve(root,'assets/session-recurrence-20261011.js')));
 assert.ok(seen.has(resolve(root,'assets/index-NTH10f-r.js')));
});
test('shared client/React export shim targets the HTML entrypoint',()=>{
 const {entry}=graph(),shim=resolve(root,'assets/index-NTH10f-r.js'),target=readFileSync(shim,'utf8').match(/export \* from ["']([^"']+)/)[1];assert.equal(resolve(dirname(shim),target),entry);
});
