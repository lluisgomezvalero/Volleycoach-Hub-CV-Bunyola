import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerLoadWeeks,createPlayerLoadBars} from '../assets/player-load-bars-20261018.js';
const DAY=86400000,WEEK=7*DAY,now=Date.parse('2026-10-26T12:00:00+01:00');
const event=(id,age,extra={})=>({id,event_type:'training',starts_at:new Date(now-age).toISOString(),ends_at:new Date(now-age+3600000).toISOString(),...extra});
const attendance=(id,status='present',minutes=60)=>({event_id:id,player_id:'p',official_status:status,effective_minutes:minutes});
const rpe=(id,score=5,source='player')=>({event_id:id,player_id:'p',score,source});
const model=(events,rows=[],rpes=[])=>playerLoadWeeks(events,rows,rpes,'p',()=>60,now);
test('complete and partial participation use individual minutes, never coach estimated RPE',()=>{
 const m=model([event('a',DAY),event('b',2*DAY)],[attendance('a'),attendance('b','present',20)],[rpe('a'),rpe('b'),rpe('a',10,'coach')]);assert.equal(m.weeks[4].load,400);assert.equal(m.weeks[4].registered,2);
});
test('missing RPE, missing attendance and late missing minutes remain incomplete',()=>{
 const m=model([event('a',DAY),event('b',2*DAY),event('c',3*DAY)],[attendance('a'),attendance('c','late',null)],[rpe('c')]);assert.equal(m.weeks[4].pending,3);assert.equal(m.weeks[4].load,0);assert.equal(m.message,'Faltan registros');
});
test('confirmed absence and no sessions are distinct; absent history is not rest',()=>{
 const m=model([event('a',DAY)],[attendance('a','justified')]);assert.equal(m.weeks[4].absences,1);assert.equal(m.weeks[4].pending,0);assert.equal(m.reference,null);assert.equal(m.message,'Referencia insuficiente');assert.equal(model([]).weeks[4].sessions,0);
});
test('valid zero counts; blank or null RPE does not create a zero load record',()=>{
 for(const score of ['',null,undefined])assert.equal(model([event('a',DAY)],[attendance('a')],[{...rpe('a'),score}]).weeks[4].pending,1);
 assert.equal(model([event('a',DAY)],[attendance('a')],[rpe('a',0)]).weeks[4].registered,1);
});
test('rolling periods, exact boundaries and Madrid daylight saving use elapsed instants',()=>{
 const m=model([event('a',WEEK-1),event('b',WEEK),event('c',5*WEEK),event('future',-DAY)],[attendance('a'),attendance('b'),attendance('c')],[rpe('a'),rpe('b'),rpe('c')]);assert.equal(m.weeks[4].load,300);assert.equal(m.weeks[3].load,300);assert.equal(m.weeks[0].load,0);assert.match(m.weeks[4].period,/oct/);
});
test('deduplicates; excludes cancelled, matches and unfinished sessions',()=>{
 const e=event('a',DAY);const m=model([e,e,event('cancel',DAY,{status:'Cancelado'}),event('match',DAY,{event_type:'match'}),event('unfinished',1000)],[attendance('a')],[rpe('a')]);assert.equal(m.weeks[4].sessions,1);
});
test('complete reference permits neutral descriptive comparison; missing old data prevents it',()=>{
 const events=Array.from({length:5},(_,i)=>event(String(i),i*WEEK+DAY)),rows=events.map(e=>attendance(e.id)),scores=events.map(e=>rpe(e.id));assert.equal(model(events,rows,scores).message,'Similar a tus semanas anteriores');scores[0].score=10;assert.match(model(events,rows,scores).message,/Más carga registrada/);assert.equal(model(events,rows,scores.slice(0,4)).message,'Faltan registros');
});
test('bars are keyboard buttons and tapping shows dates, load and pending detail',()=>{
 const state=[];let cursor=0;const React={useState(initial){const id=cursor++;if(!(id in state))state[id]=initial;return [state[id],v=>state[id]=v];}};const jsx={jsx:(tag,props)=>({tag,props}),jsxs:(tag,props)=>({tag,props})};const Component=createPlayerLoadBars(React,jsx);const m=model([event('a',DAY)]);const render=()=>{cursor=0;return Component({model:m});};let tree=render();const buttons=tree.props.children[1].props.children;assert.equal(buttons.length,5);assert.equal(buttons[4].tag,'button');assert.match(JSON.stringify(tree.props.children[2]),/Faltan datos/);buttons[0].props.onClick();tree=render();assert.match(JSON.stringify(tree.props.children[2]),/no permite confirmar descanso/);assert.equal(tree.props.children[1].props.children[0].props['aria-pressed'],true);assert.doesNotMatch(JSON.stringify(tree),/ACWR|riesgo|óptim/);
});
