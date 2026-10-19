import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('assets/japos-20261019.js','utf8');
const {japoPoints,validateJapo,japoStandings,loadJapos,createJapos}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const game=(id,a,b,sets_a=2,sets_b=0)=>({id,team_a:a,team_b:b,sets_a,sets_b});
test('all four match outcomes award 3/0 or 2/1 points',()=>{
 assert.deepEqual(japoPoints(2,0),[3,0]);assert.deepEqual(japoPoints(2,1),[2,1]);assert.deepEqual(japoPoints(0,2),[0,3]);assert.deepEqual(japoPoints(1,2),[1,2]);
 for(const [a,b] of [[1,1],[2,2],[3,0],[-1,2],[2,'0']])assert.throws(()=>japoPoints(a,b));
});
test('teams must have participants without duplicates or overlap',()=>{
 for(const [a,b] of [[[],['b']],[['a'],[]],[['a','a'],['b']],[['a'],['a']]])assert.throws(()=>validateJapo(game('x',a,b)));
 assert.doesNotThrow(()=>validateJapo(game('x',['a'],['b','c'])));
});
test('changing teams accumulates individual points; absences are not defeats',()=>{
 const rows=japoStandings([game('1',['a','b'],['c']),game('2',['c','a'],['b'],2,1)],[{id:'a'},{id:'b'},{id:'c'},{id:'absent'}]);
 assert.equal(rows.find(r=>r.id==='a').points,5);assert.equal(rows.find(r=>r.id==='a').wins,2);assert.equal(rows.find(r=>r.id==='b').points,4);assert.equal(rows.find(r=>r.id==='c').points,2);assert.ok(!rows.some(r=>r.id==='absent'));
});
test('correction and annulment recalculate; same UUID cannot count twice',()=>{
 const g=game('1',['a'],['b']);assert.equal(japoStandings([g,g],[])[0].points,3);
 assert.equal(japoStandings([{...g,sets_a:1,sets_b:2}],[])[0].id,'b');assert.deepEqual(japoStandings([{...g,voided:true}],[]),[]);
});
test('tied points share rank; played count is preserved',()=>{
 const rows=japoStandings([game('1',['a','b'],['c'])],[]);assert.deepEqual(rows.map(r=>r.rank),[1,1,3]);assert.equal(rows[2].played,1);assert.equal(rows[2].wins,0);
});
test('season loading paginates and excludes cancelled sessions',async()=>{
 let ranges=[],filters=[];const db={from:()=>{const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},order:()=>q,range:(a,b)=>{ranges.push([a,b]);return q;},then:resolve=>resolve({data:ranges.length===1?Array.from({length:500},(_,i)=>({id:String(i),events:{status:i===0?'cancelled':'scheduled'}})):[{id:'last',events:{status:'scheduled'}}],error:null})};return q;}};
 const rows=await loadJapos(db,'team','season');assert.equal(rows.length,500);assert.deepEqual(ranges,[[0,499],[500,999]]);assert.ok(filters.some(([k,v])=>k==='events.season_id'&&v==='season'));
});
test('collapsed Japos performs no database calls and exposes accessible toggle',()=>{
 const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},React={useState:()=>[false,()=>{}]};
 const Japos=createJapos(React,jsx,{from:()=>{throw Error('Unexpected query');}}),tree=Japos({teamId:'t'});assert.equal(tree.props.children[0].props['aria-expanded'],false);assert.equal(tree.props.children[1],null);assert.equal(Japos({}),null);
});
test('active app exposes Japos in session and training list with single injected runtime',()=>{
 const code=readFileSync('assets/index-evolution-20261019.js','utf8');assert.ok(code.includes('const Japos=createJapos(_,i,Q)'));assert.ok(code.includes('i.jsx(Japos,{event:a,teamId:a.team_id,seasonId:a.season_id,identity:t})'));assert.ok(code.includes('i.jsx(Japos,{teamId:p,identity:a})'));
});
test('result form saves once on double tap, preserves failed draft, and updates standings after confirmation',async()=>{
 let calls=0,finish;const pending=new Promise(resolve=>finish=resolve);
 const candidate={...game('retry-id',['a'],['b'],2,1),event_id:'event'};
 let states=[],refs=[],cursor=0,refCursor=0,seeded=false;
 const React={useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useRef(initial){const i=refCursor++;return refs[i]??=( {current:initial});},useEffect(){}};
 const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const db={from(){return {insert(data){calls++;return {select:()=>({single:()=>pending})};}};}};
 const Hub=createJapos(React,jsx,db);states=[true];const hub=Hub({teamId:'team'}),Body=hub.props.children[1].type;
 states=[[],[{id:'a',name:'A'},{id:'b',name:'B'}],false,'',candidate,false,''];refs=[];
 const props={event:{id:'event'},teamId:'team',seasonId:'season',identity:{profile:{id:'coach',role:'coach'}}};
 function render(){cursor=0;refCursor=0;return Body(props);}
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
 let tree=render();const save=find(tree,n=>n.type==='button'&&n.props.children==='Guardar resultado');
 const p1=save.props.onClick(),p2=save.props.onClick();assert.equal(calls,1);finish({error:{message:'Connection interrupted'}});await Promise.all([p1,p2]);assert.equal(states[4].id,'retry-id');assert.ok(states[3].includes('Connection'));
 db.from=()=>({insert(){calls++;return {select:()=>({single:async()=>({data:{...candidate,updated_at:'confirmed',events:{status:'scheduled'}},error:null})})};}});
 tree=render();await find(tree,n=>n.type==='button'&&n.props.children==='Guardar resultado').props.onClick();assert.equal(states[4],null);assert.equal(states[0].length,1);assert.equal(states[6],'Resultado guardado.');assert.equal(japoStandings(states[0],[])[0].points,2);
});
