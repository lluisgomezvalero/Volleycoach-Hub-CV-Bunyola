import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeTactics,createTacticsComponents,ROTATIONS,DEFENSES} from '../assets/game-plan-tactics-20261101.js';
const source=readFileSync('assets/GamePlanPage-uOL4d24E.js','utf8');
const keys=['z4a','z4b','z2','z3a','z3b'].map(key=>({key,dirs:['line','tip']}));
const load=Function('C','$','normalizeTactics',source.slice(source.indexOf('function Ae('),source.indexOf('function R('))+';return L;')([4,3,2,7,8,9,5,6,1],keys,normalizeTactics);
test('old plans retain their complete attack, reception and generic serve data',()=>{
 const old={attackers:{z4a:{name:'Rival',directions:['line'],visibleToPlayers:true}},servePct:{z1:50},serveTargets:{z6:'primary'},servePlayerTarget:'8',opponentReceivers:[{name:'Ana',level:'red'}]};
 const p=load(old);assert.equal(p.servePct.z1,50);assert.equal(p.serveTargets.z6,'primary');assert.equal(p.attackers.z4a.name,'Rival');assert.equal(p.opponentReceivers[0].name,'Ana');assert.equal(p.servePlayerTarget,'8');assert.deepEqual(p.serveByRotation,Object.fromEntries(ROTATIONS.map(r=>[r,null])));
});
test('all defensive systems, independent rotation targets and optional rival servers survive save/load',()=>{
 for(const opponentDefense of Object.keys(DEFENSES)){
  const p=load({opponentDefense,serveByRotation:{R1:1,R2:7,R3:4,R4:2,R5:9,R6:6},opponentServers:[{dorsal:'8',name:'Ana',type:'jump_float',zone:5,notes:'Entre 5 y 6'},{dorsal:'12',type:'topspin',notes:'Profundo'}]});
  assert.deepEqual(load(JSON.parse(JSON.stringify(p))),p);assert.equal(p.opponentServers.length,2);assert.equal(p.serveByRotation.R2,7);
 }
 assert.equal(load({}).opponentServers.length,0);
});
test('invalid zones and enum values normalize without discarding valid records',()=>{
 const p=normalizeTactics({opponentDefense:'invalid',serveByRotation:{R1:10,R2:'5'},opponentServers:[null,{dorsal:'4',type:'bad',zone:99}]});assert.equal(p.opponentDefense,'');assert.equal(p.serveByRotation.R1,null);assert.equal(p.serveByRotation.R2,5);assert.deepEqual(p.opponentServers,[{name:'',dorsal:'4',type:'',zone:null,notes:''}]);
});
function fixture(){let state='R1';const jsx={jsx:(type,props)=>({type,props})},React={Fragment:'fragment',useState:()=>[state,value=>{state=value}]};return createTacticsComponents(React,jsx,'Court');}
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(typeof tree!=='object')return String(tree);return [tree.props?.children].flat(Infinity).map(text).join(' ');}
test('rotation editor switches rival rotation and changes only its selected target; second tap clears',()=>{
 const c=fixture(),plan={...normalizeTactics(),hideServeObjectives:false},onChange=fn=>fn(plan);
 let tree=c.RotationEditor({plan,onChange});nodes(tree).find(n=>n.type==='button'&&text(n).trim()==='R3').props.onClick();tree=c.RotationEditor({plan,onChange});nodes(tree).find(n=>n.type==='Court').props.onZone(7);assert.equal(plan.serveByRotation.R3,7);assert.equal(plan.serveByRotation.R1,null);
 tree=c.RotationEditor({plan,onChange});nodes(tree).find(n=>n.type==='Court').props.onZone(7);assert.equal(plan.serveByRotation.R3,null);
});
test('rival list allows adding just one identified server, editing it and removing it',()=>{
 const c=fixture(),plan=normalizeTactics(),onChange=fn=>fn(plan);let tree=c.ServersEditor({plan,onChange});nodes(tree).find(n=>n.type==='button'&&text(n).includes('Añadir')).props.onClick();assert.equal(plan.opponentServers.length,1);
 tree=c.ServersEditor({plan,onChange});nodes(tree).find(n=>n.type==='input'&&n.props.placeholder==='Ej. 8').props.onChange({target:{value:'8'}});assert.equal(plan.opponentServers[0].dorsal,'8');nodes(tree).find(n=>n.type==='button'&&text(n)==='Eliminar').props.onClick();assert.equal(plan.opponentServers.length,0);
});
test('player view shows only identified useful server notes, honors hidden serve objectives and keeps defense visible',()=>{
 const c=fixture(),plan={...normalizeTactics({opponentDefense:'box_free6',serveByRotation:{R1:5},opponentServers:[{name:'Ana',type:'float',notes:'Largo'},{notes:'Unidentified'},{name:'Empty'}]}),hideServeObjectives:true};
 let out=text(c.TacticsView({plan}));assert.ok(out.includes('Caja con 6 libre'));assert.ok(out.includes('Ana'));assert.ok(!out.includes('Unidentified'));assert.ok(!out.includes('Empty'));assert.ok(!out.includes('Nuestro saque por rotación rival'));
 plan.hideServeObjectives=false;out=text(c.TacticsView({plan}));assert.ok(out.includes('Nuestro saque por rotación rival'));assert.ok(out.includes('Zona 5'));assert.ok(out.includes('Sin definir'));
});
test('preview uses unsaved editor state, while players still read the published plan',()=>{assert.ok(source.includes('plan:N,event:x,preview:!0'));assert.ok(source.includes('plan:u.payload.plan,event:x,activeAttack:W'));assert.ok(source.includes('modelVersion:ze'));});
