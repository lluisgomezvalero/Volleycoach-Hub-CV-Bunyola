import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchExposure,exposureCopy,participationOptions,createMatchExposureUI} from '../assets/match-exposure-20261016.js';
const now=Date.parse('2026-10-26T12:00:00+01:00');
const event=(id,type='match',extra={})=>({id,event_type:type,starts_at:'2026-10-25T17:00:00+01:00',ends_at:'2026-10-25T19:00:00+01:00',...extra});
test('different participation, pending distinct from confirmed none',()=>{
 const events=[event('a'),event('b','friendly'),event('c')];
 const rows=[{event_id:'a',player_id:'p',category:'high'},{event_id:'b',player_id:'p',category:'none'},{event_id:'a',player_id:'q',category:'low'}];
 const p=matchExposure(events,rows,'p',now),q=matchExposure(events,rows,'q',now);
 assert.deepEqual(p,{total:3,pending:1,none:1,warmup:0,low:0,medium:0,high:1});assert.equal(q.low,1);assert.equal(q.pending,2);
 assert.match(exposureCopy(p),/participación alta/);assert.match(exposureCopy(p),/pendiente/);
});
test('all five categories; cleared or unknown remains pending, no numeric load',()=>{
 const events=Array.from({length:7},(_,i)=>event(String(i)));const rows=['none','warmup','low','medium','high',null,'other'].map((category,i)=>({event_id:String(i),player_id:'p',category}));
 const result=matchExposure(events,rows,'p',now);assert.equal(result.pending,2);for(const key of ['none','warmup','low','medium','high'])assert.equal(result[key],1);assert.equal('load' in result,false);assert.equal('ratio' in result,false);assert.equal(participationOptions.length,6);
});
test('deduplicates; excludes training, tournament, cancelled, future and unfinished',()=>{
 const result=matchExposure([event('a'),event('a'),event('t','training'),event('tour','tournament'),event('c','match',{status:'Cancelado'}),event('f','match',{starts_at:'2026-10-27T10:00:00Z'}),event('u','match',{ends_at:'2026-10-26T20:00:00Z'})],[],'p',now);assert.equal(result.total,1);
});
test('rolling seven-day boundary across Europe/Madrid daylight saving transition',()=>{
 const iso=d=>new Date(d).toISOString();const e=(id,start)=>event(id,'match',{starts_at:iso(start),ends_at:iso(start+3600000)});
 assert.equal(matchExposure([e('old',now-7*86400000),e('in',now-7*86400000+1)],[],'p',now).total,1);
});
test('editor and summary render without creating another React runtime',()=>{
 const React={useState:v=>[v,()=>{}],useEffect:()=>{}};const jsx={jsx:(tag,props)=>({tag,props}),jsxs:(tag,props)=>({tag,props})};const {Editor,Summary}=createMatchExposureUI(React,jsx,{},()=>({identity:{}}));
 assert.equal(Editor({event:event('t','tournament'),isStaff:true}),null);
 assert.equal(Editor({event:event('m'),isStaff:false}),null);
 const rendered=Editor({event:{...event('a'),team_id:'team'},isStaff:true});assert.equal(rendered.tag,'section');assert.match(JSON.stringify(rendered),/No calcula UA/);
 assert.equal(Summary({playerId:null}),null);
});

test('coach editor loads saved values, batch saves changes, clears to pending and preserves edits on failure',async()=>{
 const state=[],effects=[];let cursor=0,effectCursor=0,fail=false,lastRows;
 const React={useState(initial){const key=cursor++;if(!(key in state))state[key]=initial;return[state[key],value=>{state[key]=typeof value==='function'?value(state[key]):value;}];},useEffect(fn){const key=effectCursor++;if(!effects[key]){effects[key]=true;fn();}}};
 const jsx={jsx:(tag,props)=>({tag,props}),jsxs:(tag,props)=>({tag,props})};
 const db={from(table){const chain={select(){return chain;},eq(){return chain;},order(){return Promise.resolve({data:[{id:'p',profiles:{full_name:'Player P'}},{id:'q',profiles:{full_name:'Player Q'}}]});},then(resolve,reject){return Promise.resolve({data:[{player_id:'p',category:'low'}]}).then(resolve,reject);},async upsert(rows){lastRows=rows;return {error:fail?new Error('offline'):null};}};return chain;}};
 const {Editor}=createMatchExposureUI(React,jsx,db,()=>({identity:{profile:{id:'coach'}}}));
 const render=()=>{cursor=0;effectCursor=0;return Editor({event:{...event('a'),starts_at:'2020-01-01T10:00:00Z',ends_at:'2020-01-01T12:00:00Z',team_id:'team'},isStaff:true});};
 const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
 const oldWindow=globalThis.window;globalThis.window={dispatchEvent(){}};
 try{render();await flush();let view=render();const labels=view.props.children[4];assert.equal(labels[0].props.children[1].props.value,'low');assert.equal(labels[1].props.children[1].props.value,'');
 labels[0].props.children[1].props.onChange({target:{value:'high'}});labels[1].props.children[1].props.onChange({target:{value:'warmup'}});
 view=render();await view.props.children.at(-1).props.onClick();assert.deepEqual(lastRows.map(r=>[r.player_id,r.category]),[['p','high'],['q','warmup']]);assert.equal(lastRows[0].recorded_by,'coach');
 view=render();assert.match(JSON.stringify(view),/Participación guardada/);assert.equal(view.props.children.at(-1).props.disabled,true);
 view.props.children[4][0].props.children[1].props.onChange({target:{value:''}});view=render();fail=true;await view.props.children.at(-1).props.onClick();view=render();assert.match(JSON.stringify(view),/Tus cambios siguen aquí/);assert.equal(view.props.children.at(-1).props.disabled,false);
 fail=false;await view.props.children.at(-1).props.onClick();assert.equal(lastRows[0].category,null);assert.equal(lastRows.length,1);
 }finally{globalThis.window=oldWindow;}
});
