const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
(async()=>{
  const {deriveStats,validateReport,reportExample}=await import('../assets/match-report-model-feedback-20261004.js');
  const {explainStats}=await import('../assets/report-feedback-20261004.js');
  const feedback=explainStats(reportExample.totals,true);assert.match(feedback.headline,/49 puntos/);assert.ok(feedback.key_issue);
  const withFeedback=structuredClone(reportExample);withFeedback.players=[{name:'Paula',stats:{serve:{int:10,aces:2,errors:1}},feedback:{positive:'Buen trabajo',next_objective:'Objetivo próximo partido'}}];assert.equal(validateReport(withFeedback).report.players[0].feedback.positive,'Buen trabajo');
  const fixture=structuredClone(reportExample);
  fixture.sets=[0,1,2,3].map(i=>({number:i+1,score:['25-21','18-25','20-25','15-25'][i],stats:{reception:{positive:5,exclamative:[8,8,7,7][i],errors:[3,3,2,2][i]},attack:{int:[29,20,20,20][i],points:[12,8,7,6][i],errors:[3,4,5,5][i]},serve:{int:20,aces:[3,3,2,2][i],errors:[3,2,2,2][i]},block:{points:[2,2,1,1][i]},opponent_errors:[8,7,7,7][i]}}));
  const d=deriveStats(fixture.totals);
  assert.equal(d.attackPoint,33/89*100);assert.equal(d.attackError,17/89*100);assert.equal(d.attackEfficiency,16/89*100);assert.equal(d.attackContinuities,39);
  assert.equal(d.serveAce,10/80*100);assert.equal(d.serveError,9/80*100);assert.equal(d.serveContinuities,61);assert.equal(d.ownPoints,49);assert.equal(d.receptionTotal,60);
  assert.equal(validateReport(fixture).errors.length,0);
  assert.equal(deriveStats({attack:{int:10,points:1,errors:5}}).attackEfficiency,-40);
  assert.equal(deriveStats({attack:{int:0,points:0,errors:0}}).attackEfficiency,null);
  assert.ok(validateReport('{').errors.length);
  for(const mutation of [v=>v.totals.attack.int=40,v=>v.totals.serve.int=10,v=>v.totals.attack.points=-1,v=>v.sets[0].stats.attack.int++,v=>v.totals.reception.percent=50,v=>v.players=[{name:'X',stats:{attack:{int:100,points:0,errors:0}}}],v=>v.sets[0].number=2,v=>v.match.result.ours=8]){
    const invalid=structuredClone(fixture);mutation(invalid);assert.ok(validateReport(invalid).errors.length);
  }
  let states=[],cursor=0,effects=[],saved=null,upserts=0;
  const roster=[{id:'player-1',position:'Receptora',profiles:{full_name:'Paula Fuentes'}}];
  let current={id:'statistics-1',status:'published',published_at:'2026-10-01T12:00:00Z',created_by:'coach',visible_metrics:['aces'],payload:{notes:'Legacy notes',report:fixture}};
  const db={from(table){const query={select(){return this},eq(){return this},then(fn){return Promise.resolve(fn({data:roster,error:null}))},async maybeSingle(){return{data:current,error:null}},upsert(row,options){assert.equal(options.onConflict,'event_id');upserts++;saved=row;return this},async single(){return{data:{id:'statistics-1',...saved},error:null}}};return query}};
  const React={Fragment:'fragment',useState(initial){const index=cursor++;if(!(index in states))states[index]=initial;return[states[index],v=>states[index]=v]},useEffect(fn){effects.push(fn)}};
  const jsx={jsxs:(type,props)=>({type,props})};
  const context={React,jsx,db,deriveStats,validateReport,reportExample,explainStats,structuredClone,console};vm.createContext(context);
  let source=fs.readFileSync('assets/match-report-ui-feedback-20261004.js','utf8').replace(/^import .*;\n/gm,'').replace(/export function /g,'function ');
  vm.runInContext(source,context);
  function walk(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=walk(child,predicate);if(found)return found}return null}
  const props={items:[{label:'Jornada 1',opponent:'CV CIDE',event:{id:'event-1'}}],team:{id:'team-1'},profile:{id:'coach',club_id:'club-1'},onClose(){},onSaved(){}};
  function render(){cursor=0;return context.MatchReportImporter(props)}
  render();effects.shift()();await Promise.resolve();
  states[0]=JSON.stringify(fixture);states[3]='event-1';
  let tree=render();walk(tree,n=>n.type==='button'&&n.props.children==='Validar y previsualizar').props.onClick();
  assert.equal(states[2].length,0);assert.ok(states[1]);assert.equal(upserts,0,'preview must not write');
  tree=render();await walk(tree,n=>n.type==='button'&&n.props.children==='Publicar informe').props.onClick();
  assert.equal(upserts,1);assert.equal(saved.published_at,current.published_at,'editing a published report preserves the publication date');assert.equal(saved.payload.notes,'Legacy notes');assert.equal(saved.payload.report.totals.attack.int,89);
  current={...current,payload:{notes:'Legacy notes'}};tree=render();await walk(tree,n=>n.type==='button'&&n.props.children==='Publicar informe').props.onClick();assert.notEqual(saved.published_at,current.published_at,'first report publication gets a new publication date');
  states[0]='bad JSON';tree=render();walk(tree,n=>n.type==='button'&&n.props.children==='Validar y previsualizar').props.onClick();assert.equal(states[1],null);assert.ok(states[2].length);tree=render();assert.equal(walk(tree,n=>n.type==='button'&&n.props.children==='Publicar informe').props.disabled,true);
  states=[];cursor=0;let view=context.MatchReportView({report:fixture,staff:false});assert.equal(walk(view,n=>n.type==='button'&&n.props.children==='Datos completos'),null);
  states=[];cursor=0;view=context.MatchReportView({report:fixture,staff:true});assert.ok(walk(view,n=>n.type==='button'&&n.props.children==='Datos completos'));
  states=[];cursor=0;let feedbackUpdate=null;
  context.db={from(){let patch=null;return{select(){return this},eq(){return this},update(value){patch=value;feedbackUpdate=value;return this},async single(){return{data:{id:'statistics-1',payload:{report:fixture,notes:'Keep'},published_at:'original-date',...(patch||{})},error:null}}}}};
  const fp={report:fixture,record:{id:'statistics-1'},staff:true,onSaved(){}};
  function renderFeedback(){cursor=0;return context.FeedbackBlock(fp)}
  let block=renderFeedback();walk(block,n=>n.type==='button'&&n.props.children==='Editar feedback').props.onClick();
  block=renderFeedback();walk(block,n=>n.type==='textarea').props.onChange({target:{value:'Un resumen que entiende el equipo'}});
  block=renderFeedback();await walk(block,n=>n.type==='button'&&n.props.children==='Guardar feedback').props.onClick();
  assert.equal(feedbackUpdate.payload.report.conclusions.headline,'Un resumen que entiende el equipo');assert.equal(feedbackUpdate.payload.notes,'Keep');assert.equal(feedbackUpdate.published_at,undefined,'feedback edit must not reset publication');
  console.log('PASS: INT formulas, zero/negative efficacy, sets/totals validation, preview without writes, upsert, preserved legacy fields/publication date, invalid import blocked, coach-only raw tab');
})().catch(error=>{console.error(error);process.exit(1)});
