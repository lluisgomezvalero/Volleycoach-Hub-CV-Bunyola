import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync('assets/StatisticsPage-evolution-20261019.js','utf8'),code=source.slice(source.indexOf('function O('),source.indexOf('function EvolutionView'));
function harness(items,key='metric'){
 let selected=null;const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const O=new Function('u','e','M','T','J',`return (${code})`)({useState:()=>[selected,v=>selected=v]},jsx,value=>value===null||value===undefined?null:Number(value),values=>values.reduce((a,b)=>a+b,0)/values.length,()=> 'fecha');
 return()=>O({label:'Métrica',metricKey:key,items});
}
const item=(id,value)=>({event:{id,starts_at:'2026-10-19',payload:{opponent:'Rival'}},payload:{metrics:{metric:value,reception_error_pct:value}},label:`Jornada ${id}`});
function nodes(tree){return [tree,...(Array.isArray(tree?.props?.children)?tree.props.children:[tree?.props?.children]).filter(n=>n&&typeof n==='object').flatMap(nodes)];}
test('selecting each match updates the headline, detail and comparison, not the season average',()=>{
 const render=harness([item('1',20),item('2',40),item('3',60)]);let tree=render();assert.ok(nodes(tree).some(n=>n.props?.children==='40.0%'&&n.props?.title));assert.ok(nodes(tree).some(n=>n.props?.children==='Media'));
 nodes(tree).find(n=>n.type==='button'&&n.props['aria-label'].startsWith('Jornada 3')).props.onClick();tree=render();assert.ok(nodes(tree).some(n=>n.props?.children==='60.0%'&&n.props?.title==='Jornada 3'));assert.match(JSON.stringify(tree),/\+20.0 pp · Jornada 3/);
 nodes(tree).find(n=>n.type==='button'&&n.props['aria-label'].startsWith('Jornada 1')).props.onClick();tree=render();assert.ok(nodes(tree).some(n=>n.props?.children==='20.0%'&&n.props?.title==='Jornada 1'));assert.match(JSON.stringify(tree),/Sin comparación/);
});
test('missing match data never falls back to an unrelated percentage',()=>{const render=harness([item('1',20),item('2',null)]);let tree=render();nodes(tree).find(n=>n.type==='button'&&n.props['aria-label'].startsWith('Jornada 2')).props.onClick();tree=render();assert.ok(nodes(tree).some(n=>n.props?.children==='—'&&n.props?.title==='Jornada 2'));assert.match(JSON.stringify(tree),/Sin comparación/);});
test('error metrics compare the selected match with the preceding available match',()=>{const render=harness([item('1',40),item('2',20),item('3',50)],'reception_error_pct');let tree=render();nodes(tree).find(n=>n.type==='button'&&n.props['aria-label'].startsWith('Jornada 2')).props.onClick();tree=render();assert.match(JSON.stringify(tree),/↑ Mejora/);assert.match(JSON.stringify(tree),/-20.0 pp · Jornada 2/);});
