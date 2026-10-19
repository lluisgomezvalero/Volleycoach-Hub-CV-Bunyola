import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync('assets/official-standings-20261020.js','utf8');
const {parseFederationStandings:parse,fetchFederationStandings:fetchStandings,sourceFor,federationSource:source,readStandingsCache,createOfficialStandings}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const fixture=readFileSync('tests/fixtures/federation-8244.html','utf8');
test('real official fixture preserves all 12 positions and published points without recalculation',()=>{
 const rows=parse(fixture);assert.equal(rows.length,12);assert.equal(rows[0].name,'QUEEN MALLORCA CIDE PALMA');const own=rows.find(r=>r.is_own);assert.equal(own.rank,8);assert.equal(own.pj,3);assert.equal(own.points,0);assert.equal(own.sf,1);assert.equal(own.sc,9);assert.equal(rows[2].points,8);
});
test('invalid, empty, challenged or structurally changed responses are rejected, never treated as zero',()=>{
 for(const html of ['', '<html>Forbidden</html>', fixture.replace('<th>PT</th>','<th>Changed</th>'),fixture.replace('<td>9</td>','<td>?</td>'),fixture.replace('JARDINS DALFABIA CVBUNYOLA','Other team'),fixture.replace('<td>2.</td>','<td>1.</td>')])assert.throws(()=>parse(html));
});
test('official sanctions and entity names are displayed without re-sorting or script injection',()=>{
 const rows=parse(fixture.replace('<td>9</td>','<td>-1</td>').replace('QUEEN MALLORCA CIDE PALMA','A &amp; B &lt;img src=x&gt;'));
 assert.equal(rows[0].points,-1);assert.equal(rows[0].rank,1);assert.equal(rows[0].name,'A & B <img src=x>');assert.ok(!code.includes('dangerouslySetInnerHTML'));
});
test('only the configured team and season use the federation source',()=>{
 assert.equal(sourceFor({teams:[{id:source.teamId,season_id:source.seasonId}]}),source);assert.equal(sourceFor({teams:[{id:source.teamId,season_id:'next-season'}]}),null);assert.equal(sourceFor({teams:[{id:'other',season_id:source.seasonId}]}),null);assert.equal(sourceFor({}),null);
});
test('fetch uses public endpoint, excludes credentials, handles HTTP error and propagates abort',async()=>{
 const controller=new AbortController();let args;
 const data=await fetchStandings(async(...a)=>{args=a;return {ok:true,text:async()=>fixture};},controller.signal);assert.equal(data.rows.length,12);assert.ok(Number.isFinite(Date.parse(data.checkedAt)));assert.equal(args[0],source.endpoint);assert.equal(args[1].credentials,'omit');assert.equal(args[1].signal,controller.signal);
 await assert.rejects(fetchStandings(async()=>({ok:false,status:503})),/503/);await assert.rejects(fetchStandings(async()=>{throw Error('aborted');}),/aborted/);
});
test('stored snapshot keeps its successful timestamp; corrupt cache cannot invent a classification',()=>{
 const data={rows:parse(fixture),checkedAt:'2026-10-19T23:00:00Z'};assert.deepEqual(readStandingsCache({getItem:()=>JSON.stringify(data)}),data);
 for(const value of ['bad JSON','null',JSON.stringify({...data,checkedAt:'invalid'}),JSON.stringify({...data,rows:[]}),JSON.stringify({...data,rows:data.rows.map(r=>({...r,points:null}))})])assert.equal(readStandingsCache({getItem:()=>value}),null);
 assert.equal(readStandingsCache({getItem(){throw Error('storage blocked');}}),null);
});
test('official rendering shows saved state and outage warning without legacy editing or event calculations',()=>{
 let cursor=0;const states=[{rows:parse(fixture),checkedAt:'2026-10-19T23:00:00Z'},false,'No se ha podido actualizar desde la federación.'];const React={useState:()=>[states[cursor++],()=>{}],useEffect(){}};const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const Component=createOfficialStandings(React,jsx),view=JSON.stringify(Component());assert.ok(view.includes('puede estar desactualizada'));assert.ok(view.includes('Última consulta correcta'));assert.ok(!view.includes('Editar'));assert.ok(!view.includes('Reiniciar'));
 const page=readFileSync('assets/CompetitionPage-CD0FJnCQ.js','utf8');assert.ok(page.includes('sourceFor(identity)?e.jsx(OfficialStandings,{}):e.jsx(ee,{})'));
});
test('all federation sponsored names map to the existing 12 club crests, including accents',async()=>{
 const {clubKey,standingsWithLogos}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 const names=['CV Alaró','CV Algaida','CV Artà','CV BUNYOLA','CV CIDE','CV Esporles','CV Manacor','CV Mayurqa','CV Muro','CV Portocristo','CV Pòrtol','CV Sóller'];
 const clubs=names.map(name=>({name,logo:`assets/${clubKey(name)}.png`}));const rows=parse(fixture),decorated=standingsWithLogos(rows,clubs);
 assert.equal(new Set(rows.map(r=>clubKey(r.name))).size,12);assert.ok(decorated.every(r=>r.logo));assert.deepEqual(decorated.map(({logo,...r})=>r),rows);
 const shuffled=standingsWithLogos([...rows].reverse(),clubs);assert.equal(shuffled.find(r=>r.is_own).logo,'assets/bunyola.png');
 assert.equal(clubKey('Club desconocido'),'');assert.equal(clubKey('CIDE y Bunyola'),'');
});
test('missing or ambiguous logo data never modifies official scores or prevents the table',async()=>{
 const {standingsWithLogos}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);const rows=parse(fixture);
 const noLogos=standingsWithLogos(rows,undefined);assert.equal(noLogos.length,12);assert.ok(noLogos.every(r=>r.logo===''));
 const ambiguous=standingsWithLogos(rows,[{name:'CV Bunyola',logo:'assets/one.png'},{name:'Bunyola',logo:'assets/two.png'}]);assert.equal(ambiguous.find(r=>r.is_own).logo,'');assert.deepEqual(noLogos.map(({logo,...r})=>r),rows);
});
test('crest URLs accept existing raster data and local assets while rejecting executable schemes',async()=>{
 const {safeLogo}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 assert.equal(safeLogo('data:image/jpeg;base64,abc'),'data:image/jpeg;base64,abc');assert.equal(safeLogo('assets/team.png'),'./assets/team.png');assert.equal(safeLogo('https://example.org/logo.png'),'https://example.org/logo.png');assert.equal(safeLogo('javascript:alert(1)'),'');assert.equal(safeLogo('data:text/html,abc'),'');
});
