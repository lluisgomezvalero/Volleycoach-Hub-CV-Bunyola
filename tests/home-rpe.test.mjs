import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pendingHomeRpe,createHomeRpe} from '../assets/home-rpe-20261018.js';
const bundle=readFileSync(new URL('../assets/index-insights-20261012.js',import.meta.url),'utf8');
const start=bundle.indexOf('function Xh('),end=bundle.indexOf('function Qh(',start);
const [opens,closes]=new Function('pr',bundle.slice(start,end)+';return [Xh,WE]')(()=>90);
const event={id:'session',event_type:'training',title:'Entrenamiento',starts_at:'2026-10-18T16:00:00+02:00',ends_at:'2026-10-18T18:00:00+02:00'};
const now=Date.parse(event.ends_at),pick=(at=now,rows=[],rpes=[],overrides=[],events=[event])=>pendingHomeRpe(events,rows,rpes,overrides,'p',opens,closes,at);
test('same session gate: hidden before opening and shown at opening without extra 30 minutes',()=>{assert.equal(pick(now-1),null);assert.equal(pick().id,'session');assert.equal(pick(closes(event)+1),null);});
test('reopening is available immediately and expires on time',()=>{const at=closes(event)+3600000,o={event_id:event.id,player_id:'p',expires_at:new Date(at+1000).toISOString()};assert.equal(pick(at,[],[],[o]).id,event.id);assert.equal(pick(at+1000,[],[],[o]),null);});
test('submitted own RPE hides it; other player or coach estimates do not',()=>{assert.equal(pick(now,[],[{event_id:event.id,player_id:'p',source:'player'}]),null);for(const r of [{event_id:event.id,player_id:'other',source:'player'},{event_id:event.id,player_id:'p',source:'coach'}])assert.equal(pick(now,[],[r]).id,event.id);});
test('absence, cancelled or non-training events are excluded',()=>{for(const status of ['justified','unjustified'])assert.equal(pick(now,[{event_id:event.id,player_id:'p',official_status:status}]),null);for(const extra of [{status:'Cancelado'},{event_type:'match'}])assert.equal(pick(now,[],[],[],[{...event,...extra}]),null);});
test('newest available event wins; malformed timing cannot enable it',()=>{const old={...event,id:'old',starts_at:'2026-10-17T16:00:00+02:00',ends_at:'2026-10-17T18:00:00+02:00'};assert.equal(pick(now,[],[],[{event_id:'old',player_id:'p',expires_at:new Date(now+1000).toISOString()}],[old,event]).id,event.id);assert.equal(pick(now,[],[],[],[{...event,starts_at:'invalid',ends_at:'invalid'}]),null);});
test('home integration keeps staff greeting but removes player subtitle and reuses training gate',()=>{assert.match(bundle,/HomeRpe=createHomeRpe\(_,i,Q,ca,fa,pn,Xh,WE\)/);assert.match(bundle,/!c\?i.jsx\(HomeRpe/);assert.match(bundle,/c\?i.jsx\("small",\{children:PE\(\)\}\):null/);assert.doesNotMatch(bundle,/Próximo entreno, partido y tu seguimiento personal/);});
test('live component refreshes on focus and interval and cleans up subscriptions',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document,state=[],effects=[];let cursor=0,effect=0,queries=0;const timers=[],listeners=new Map(),removed=[];
 globalThis.window={addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>removed.push(n),setInterval:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearInterval:()=>{}};
 globalThis.document={visibilityState:'visible',addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>removed.push(n)};
 const React={useState(initial){const id=cursor++;if(!(id in state))state[id]=initial;return[state[id],v=>state[id]=v];},useEffect(fn){if(!effects[effect])effects[effect]=fn();effect++;}};
 const channel={on(){return channel;},subscribe(){return channel;}};let cleaned=false;
 const db={channel:()=>channel,removeChannel:()=>cleaned=true,from(table){queries++;const data=table==='events'?[{...event,starts_at:new Date(Date.now()-7200000).toISOString(),ends_at:new Date(Date.now()-3600000).toISOString()}]:[];const chain={select(){return chain;},eq(){return chain;},gte(){return chain;},lte(){return chain;},gt(){return chain;},in(){return chain;},then(resolve,reject){return Promise.resolve({data}).then(resolve,reject);}};return chain;}};
 const jsx={jsx:(tag,props)=>({tag,props}),jsxs:(tag,props)=>({tag,props})};
 try{const Component=createHomeRpe(React,jsx,db,'a','icon','arrow',()=>0,()=>Infinity);const render=()=>{cursor=0;effect=0;return Component({playerId:'p',teamId:'team'});};assert.equal(render(),null);await new Promise(r=>setTimeout(r,0));const view=render();assert.equal(view.tag,'a');assert.match(view.props.to,/event=session&mode=session/);assert.match(JSON.stringify(view),/Registrar RPE/);assert.ok(timers.some(t=>t.ms===15000));assert.ok(timers.some(t=>t.ms===60000));const before=queries;listeners.get('focus')();await new Promise(r=>setTimeout(r,0));assert.ok(queries>before);effects[0]();assert.equal(cleaned,true);assert.ok(removed.includes('focus'));assert.ok(removed.includes('visibilitychange'));}finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
