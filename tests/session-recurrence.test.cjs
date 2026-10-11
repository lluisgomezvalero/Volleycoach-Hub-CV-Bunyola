const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let states=[],cursor=0,calls=[],result={data:[{id:'saved'}],error:null};
const React={useState(init){const n=cursor++;if(!(n in states))states[n]=typeof init==='function'?init():init;return [states[n],v=>states[n]=typeof v==='function'?v(states[n]):v]}};
const jsx={Fragment:'Fragment',jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})};
const db={rpc:async(name,args)=>{calls.push({name,args});return result}};
const source=fs.readFileSync('assets/session-recurrence-20261011.js','utf8').replace(/^import .*;\n/,'').replace(/export /g,'');
const context={React,jsx,db,Date,Set,Error,Number};vm.createContext(context);vm.runInContext(source,context);
const base={date:'2026-10-19',time:'18:30',duration:120,repeat_weekly:true,repeat_days:[1,3],repeat_until:'2026-11-02'};
assert.deepEqual(Array.from(context.repeatDates(base)),['2026-10-19','2026-10-21','2026-10-26','2026-10-28','2026-11-02']);
assert.throws(()=>context.repeatDates({...base,repeat_days:[]}));assert.throws(()=>context.repeatDates({...base,repeat_until:'2026-10-01'}));
assert.throws(()=>context.repeatDates({...base,repeat_until:'2027-10-21'}));
function nodes(tree){return [tree,...(Array.isArray(tree?.props?.children)?tree.props.children:[tree?.props?.children]).filter(x=>x&&typeof x==='object').flatMap(nodes)]}
function render(fn,props){cursor=0;return fn(props)}
(async()=>{
 await context.saveTraining(base,{id:'existing'},{season:{id:'season'}},'team');assert.equal(calls[0].name,'save_training_session');assert.equal(calls[0].args.p_event_id,'existing');assert.equal(calls[0].args.p_form.team_id,'team');
 const invalidCount=calls.length;await assert.rejects(()=>context.saveTraining({...base,repeat_days:[]},null,{},'team'));assert.equal(calls.length,invalidCount);
 states=[];let invalidated=0,saved,deleted;
 const event={id:'existing',payload:{recurrence_id:'series'}};
 const props={event,identity:{},Editor:'Editor',formFrom:()=>({...base,repeat_weekly:false}),invalidate:()=>invalidated++,onSaved:r=>saved=r,onDeleted:r=>deleted=r};
 let tree=render(context.SessionActions,props);assert(nodes(tree).some(n=>n.props?.children==='Editar sesión'));
 nodes(tree).find(n=>n.props?.children==='Editar sesión').props.onClick();tree=render(context.SessionActions,props);
 const editor=nodes(tree).find(n=>n.type==='Editor');assert.equal(editor.props.open,true);await editor.props.onSubmit({preventDefault(){}});assert.equal(saved[0].id,'saved');assert.equal(invalidated,1);
 tree=render(context.SessionActions,props);assert.equal(nodes(tree).find(n=>n.type==='Editor').props.open,false);assert(nodes(tree).some(n=>n.props?.children==='Cambios guardados'));
 states=[];result={data:[{id:'one'},{id:'two'}],error:null};tree=render(context.DeleteSessionDialog,{event,invalidate:()=>invalidated++,onClose(){},onDeleted:r=>deleted=r});
 const following=nodes(tree).find(n=>n.props?.children==='Eliminar esta y todas las posteriores');assert(following);await following.props.onClick();assert.equal(calls.at(-1).args.p_scope,'following');assert.deepEqual(Array.from(deleted),['one','two']);
 states=[];tree=render(context.DeleteSessionDialog,{event:{id:'solo',payload:{}},onClose(){},onDeleted(){}});assert(!nodes(tree).some(n=>n.props?.children==='Eliminar esta y todas las posteriores'));
 const main=fs.readFileSync('assets/index-sessions-20261011.js','utf8');assert(main.includes('m?i.jsx(SessionActions'));assert(main.includes('i.jsx(RecurrenceFields,{form:J,setForm:K})'));assert(main.includes('i.jsx(RecurrenceFields,{form:l,setForm:c})'));assert(main.includes('await saveTraining(te,re,a,s[0])'));
 console.log('PASS weekly dates, validation before save, shared RPC, in-session editor closes with confirmation, scoped delete controls, staff-only integration');
})();
