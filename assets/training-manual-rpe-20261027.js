import {loadAdditionalPlayerLoads,createManualPlayerRpe} from './manual-player-rpe-20261022.js?v=runtime-20261028-close-fatigue';
export function createTrainingManualRpe(React,jsx,db){
 const h=jsx.jsx,hs=jsx.jsxs,Form=createManualPlayerRpe(React,jsx,db);
 return function TrainingManualRpe({identity,players,event,rpes=[],attendance=[],onSaved}){
  const staff=['coach','administrator'].includes(identity?.profile?.role),ids=players.map(p=>p.id).sort().join(','),generation=React.useRef(0);
  const [data,setData]=React.useState({records:[],rpes,attendance}),[busy,setBusy]=React.useState(true),[error,setError]=React.useState('');
  const refresh=React.useCallback(async()=>{
   if(!staff)return null;const token=++generation.current;setBusy(true);setError('');
   try{
    const [records,r,a]=await Promise.all([loadAdditionalPlayerLoads(db,ids?ids.split(','):[]),db.from('rpe_entries').select('id,event_id,player_id,coach_profile_id,score,source,recorded_by,created_at,updated_at').eq('event_id',event.id),db.from('attendance').select('event_id,player_id,official_status,effective_minutes').eq('event_id',event.id)]);
    if(r.error)throw r.error;if(a.error)throw a.error;if(token!==generation.current)return null;
    const next={records,rpes:r.data||[],attendance:a.data||[]};setData(next);return next;
   }catch(e){if(token===generation.current)setError('No se pudieron actualizar los registros. Vuelve a intentarlo.');return null;}
   finally{if(token===generation.current)setBusy(false);}
  },[staff,ids,event.id,identity?.profile?.id]);
  React.useEffect(()=>{refresh();return()=>{generation.current++;};},[refresh]);
  async function saved(){onSaved?.(null);const next=await refresh();if(next)onSaved?.(next.rpes);}
  if(!staff)return null;
  return hs('div',{className:'training-manual-rpe',children:[busy?h('p',{className:'training-manual-status',role:'status',children:'Actualizando registros…'}):null,error?hs('div',{className:'training-manual-error',role:'alert',children:[h('span',{children:error}),h('button',{type:'button',onClick:refresh,disabled:busy,children:'Reintentar'})]}):null,h(Form,{identity,players,events:[event],attendance:data.attendance,rpes:data.rpes,records:data.records,currentEventId:event.id,loading:busy||!!error,onSaved:saved})]});
 };
}
