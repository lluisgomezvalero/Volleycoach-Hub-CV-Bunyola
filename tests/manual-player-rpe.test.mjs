import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');const importCode=async code=>import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const mod=await importCode(read('assets/manual-player-rpe-20261022.js'));
const minutes=await importCode(read('assets/individual-minutes-20261015.js'));
const bars=await importCode(read('assets/player-load-bars-20261018.js').replace(/import \{individualMinutes\} from '[^']+';/,`const individualMinutes=${minutes.individualMinutes.toString()};`));
const coverage=await importCode(read('assets/rpe-coverage-20261016.js').replace(/import \{individualMinutes\} from '[^']+';/,`const individualMinutes=${minutes.individualMinutes.toString()};`));
const now=Date.parse('2026-10-22T12:00:00Z'),record={id:'one',player_id:'p',context:'Juvenil',activity_type:'match',starts_at:'2026-10-21T16:00:00Z',duration_minutes:60,score:7,recorded_by:'coach',created_at:'2026-10-21T19:00:00Z'};
test('extra match load joins training load exactly once across duplicate or repeated adapters',()=>{
 let joined=mod.mergeAdditionalLoads([],[],[],[record,record]);joined=mod.mergeAdditionalLoads(joined.events,joined.attendance,joined.rpes,[record]);assert.equal(joined.events.length,1);
 const model=bars.playerLoadWeeks(joined.events,joined.attendance,joined.rpes,'p',e=>e.payload.duration,now);assert.equal(model.weeks[4].load,420);assert.equal(model.weeks[4].registered,1);assert.equal(model.weeks[4].additional,1);
 const c=coverage.rpeCoverage(joined.events,joined.attendance,joined.rpes,'p',e=>e.payload.duration,now);assert.equal(c.registered,1);assert.equal(c.incomplete,false);assert.ok(coverage.coverageCopy(c).summary.includes('actividades'));
});
test('one player additional activity never creates another player pending session',()=>{
 const j=mod.mergeAdditionalLoads([],[],[],[record]);const c=coverage.rpeCoverage(j.events,j.attendance,j.rpes,'other',e=>e.payload.duration,now);assert.equal(c.sessions,0);assert.equal(c.incomplete,false);const b=bars.playerLoadWeeks(j.events,j.attendance,j.rpes,'other',e=>e.payload.duration,now);assert.equal(b.weeks[4].sessions,0);
});
test('annulled, invalid or out-of-window activities do not generate load',()=>{
 for(const r of [{...record,voided:true},{...record,score:null},{...record,duration_minutes:0}])assert.equal(mod.mergeAdditionalLoads([],[],[],[r]).events.length,0);
 const j=mod.mergeAdditionalLoads([],[],[],[{...record,starts_at:'2026-09-01T16:00:00Z'}]);assert.equal(bars.playerLoadWeeks(j.events,j.attendance,j.rpes,'p',e=>e.payload.duration,now).weeks[4].load,0);
});
test('Madrid times respect daylight saving and reject nonexistent or ambiguous local times',()=>{
 assert.equal(mod.madridDateTime('2026-10-22T18:00'),'2026-10-22T16:00:00.000Z');assert.equal(mod.madridDateTime('2026-11-02T18:00'),'2026-11-02T17:00:00.000Z');assert.throws(()=>mod.madridDateTime('2026-03-29T02:30'));assert.throws(()=>mod.madridDateTime('2026-10-25T02:30'));
});
test('RPE zero is valid; missing score or minutes, estimate, future and unchecked duplicate are rejected',()=>{
 const draft={id:'id',player_id:'p',score:'0',duration_minutes:'60',local_time:'2026-10-21T18:00',context:'Juvenil',activity_type:'training',confirmed:true,not_duplicate:true};assert.equal(mod.manualLoadInput(draft,now).score,0);
 for(const bad of [{score:''},{duration_minutes:''},{confirmed:false},{not_duplicate:false},{local_time:'2027-01-01T18:00'}])assert.throws(()=>mod.manualLoadInput({...draft,...bad},now));
 assert.equal(mod.manualLoadInput({...draft,event_id:'e',not_duplicate:false},now).event_id,'e');
});
test('mixed regular training and extra match retain individual minutes and do not alter source arrays',()=>{
 const events=[{id:'e',starts_at:'2026-10-21T10:00:00Z',ends_at:'2026-10-21T12:00:00Z',payload:{duration:120}}],attendance=[{event_id:'e',player_id:'p',official_status:'present',effective_minutes:30}],rpes=[{event_id:'e',player_id:'p',score:5,source:'player'}];const j=mod.mergeAdditionalLoads(events,attendance,rpes,[record]);assert.equal(bars.playerLoadWeeks(j.events,j.attendance,j.rpes,'p',e=>e.payload.duration,now).weeks[4].load,570);assert.equal(events.length,1);assert.equal(attendance[0].effective_minutes,30);assert.equal(rpes.length,1);
});
test('coach form saves communicated team RPE atomically and blocks double tap while pending',async()=>{
 const draft={player_id:'p',event_id:'e',duration_minutes:'30',score:'6',confirmed:true};let states=[draft,'','',false],cursor=0,ref={current:false},finish,calls=0,args;const pending=new Promise(resolve=>finish=resolve);
 const React={useState(){const n=cursor++;return [states[n],value=>states[n]=typeof value==='function'?value(states[n]):value];},useRef:()=>ref};const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const db={rpc(name,payload){calls++;args=[name,payload];return pending;}},Component=mod.createManualPlayerRpe(React,jsx,db),oldWindow=globalThis.window;globalThis.window={dispatchEvent(){}};
 function find(node){if(!node||typeof node!=='object')return null;if(node.type==='form')return node;for(const c of [node.props?.children].flat(Infinity)){const r=find(c);if(r)return r;}return null;}
 try{const tree=Component({identity:{profile:{role:'coach',id:'coach'}},players:[{id:'p'}]});const form=find(tree);form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});assert.equal(calls,1);assert.deepEqual(args,['record_player_rpe',{p_event_id:'e',p_player_id:'p',p_score:6,p_minutes:30}]);finish({error:null});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(states[0],null);assert.equal(states[2],'RPE comunicado guardado.');}finally{globalThis.window=oldWindow;}
});
test('player cannot see entry controls, while source labels remain visible for additional records',()=>{
 let cursor=0;const React={useState(initial){cursor++;return [initial,()=>{}];},useRef:initial=>({current:initial})},jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};const C=mod.createManualPlayerRpe(React,jsx,{});
 const node=C({identity:{profile:{role:'player'}},players:[{id:'p'}],records:[record],readOnly:true});const text=JSON.stringify(node);assert.ok(text.includes('introducido por el entrenador'));assert.ok(!text.includes('+ Añadir RPE'));assert.ok(!text.includes('Anular'));
});
