import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('assets/index-evolution-20261019.js','utf8');
function iconNodes(name){const prefix=`Ee("${name}",`,start=source.indexOf(prefix)+prefix.length;assert.ok(start>=prefix.length);let end=start,depth=0,quote=false,escape=false;for(;end<source.length;end++){const c=source[end];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;}else if(c==='"')quote=true;else if(c==='[')depth++;else if(c===']'&&!--depth)break;}return JSON.parse(source.slice(start,end+1));}
test('the shared X is a closed filled SVG, visible with the filled-icon renderer',()=>{
 const nodes=iconNodes('X');assert.ok(nodes.length);
 for(const [tag,attrs] of nodes){assert.equal(tag,'path');assert.equal(attrs.fill,'currentColor');assert.match(attrs.d,/[zZ]/);}
 const upstream=readFileSync('assets/icons/iconscout/original/line/times.svg','utf8');assert.ok(upstream.includes(nodes[0][1].d));
});
test('all shared icons have explicit filled or stroked geometry, including one-letter X',()=>{
 const names=[...source.matchAll(/Ee\("([^\"]+)",\[\[/g)].map(m=>m[1]);assert.ok(names.includes('X'));assert.ok(names.length>60);
 for(const name of names)assert.ok(iconNodes(name).some(([,a])=>a.fill&&a.fill!=='none'||a.stroke&&a.stroke!=='none'),name);
});
test('weekly team aggregation contains fatigue and coverage but no sleep or pain averages',()=>{
 const team=source.slice(source.indexOf('function RN('),source.indexOf('function AN('));
 assert.ok(team.includes('Fatiga media semanal'));assert.ok(team.includes('weekly-team-wellness-coverage'));
 assert.ok(!/E\.sleep|E\.pain|kh\(le,"sleep"|kh\(le,"pain_score"|weekly-team-wellness-mini/.test(team));
 assert.ok(team.includes('Fatiga: 1–5'));assert.ok(team.includes('.select("id,player_id,entry_date,fatigue")'));
 const individual=source.slice(source.indexOf('function _N('),source.indexOf('function gc('));assert.ok(individual.includes('pain_score'));assert.ok(individual.includes('sleep'));
});
