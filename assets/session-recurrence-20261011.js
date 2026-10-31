import {r as React,j as jsx,s as db} from './index-NTH10f-r.js?v=runtime-20261031-stats-fix';
const days=[[1,'Lunes'],[2,'Martes'],[3,'Miércoles'],[4,'Jueves'],[5,'Viernes'],[6,'Sábado'],[0,'Domingo']];
export function repeatDates(form){
 if(!form.repeat_weekly)return [form.date];
 if(!form.date||!form.repeat_until||!form.repeat_days?.length)throw Error('Selecciona los días y una fecha de fin.');
 const first=new Date(form.date+'T12:00:00Z'),last=new Date(form.repeat_until+'T12:00:00Z');
 if(!Number.isFinite(+first)||!Number.isFinite(+last)||last<first||last-first>366*86400000)throw Error('La fecha de fin debe estar dentro del próximo año de la sesión.');
 const result=[form.date];
 for(let date=new Date(+first+86400000);date<=last;date.setUTCDate(date.getUTCDate()+1))if(form.repeat_days.includes(date.getUTCDay()))result.push(date.toISOString().slice(0,10));
 if(result.length>120)throw Error('Máximo 120 sesiones. Acorta la fecha de fin.');
 return result;
}
export function RecurrenceFields({form,setForm}){
 if(form.type&&form.type!=='training')return null;
 if(form.recurrence_id)return jsx.jsxs('div',{className:'session-repeat-box',children:[jsx.jsx('strong',{children:'Sesión de una serie semanal'}),jsx.jsx('p',{children:'Los cambios se aplican solo a esta sesión. Las demás conservan su fecha y contenido.'})]});
 let count='';try{count=repeatDates(form).length}catch{}
 return jsx.jsxs('fieldset',{className:'session-repeat-box',children:[jsx.jsx('legend',{children:'Repetir sesión'}),jsx.jsxs('label',{children:[jsx.jsx('input',{type:'checkbox',checked:!!form.repeat_weekly,onChange:e=>{const enabled=e.target.checked;setForm(f=>{const date=new Date(f.date+'T12:00:00Z');const until=new Date(+date+56*86400000);return {...f,repeat_weekly:enabled,repeat_days:f.repeat_days||[date.getUTCDay()],repeat_until:f.repeat_until||(Number.isFinite(+until)?until.toISOString().slice(0,10):'')};})}}),'Cada semana']}),form.repeat_weekly?jsx.jsxs('div',{children:[jsx.jsx('div',{className:'session-repeat-days',children:days.map(([day,label])=>jsx.jsxs('label',{children:[jsx.jsx('input',{type:'checkbox',checked:form.repeat_days?.includes(day)||false,onChange:e=>setForm(f=>({...f,repeat_days:e.target.checked?[...new Set([...(f.repeat_days||[]),day])]:(f.repeat_days||[]).filter(n=>n!==day)}))}),label]},day))}),jsx.jsxs('label',{children:['Hasta (incluido)',jsx.jsx('input',{type:'date',required:true,min:form.date,value:form.repeat_until||'',onChange:e=>setForm(f=>({...f,repeat_until:e.target.value}))})]}),jsx.jsx('small',{children:count?`${count} sesiones · hora de Mallorca · incluye la fecha inicial`:'Selecciona los días y la fecha de fin.'})]}):null]});
}
export async function saveTraining(form,event,identity,teamId){
 repeatDates(form);
 const {data,error}=await db.rpc('save_training_session',{p_event_id:event?.id||null,p_form:{...form,team_id:form.team_id||teamId,season_id:identity.season?.id||null}});
 if(error)throw error;
 if(!data?.length)throw Error('No se pudo guardar la sesión.');
 return data;
}
export function DeleteSessionDialog({event,onClose,onDeleted,invalidate}){
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 async function remove(scope){setBusy(true);setError('');try{const {data,error}=await db.rpc('delete_training_sessions',{p_event_id:event.id,p_scope:scope});if(error)throw error;invalidate?.();onDeleted((data||[]).map(x=>x.id));onClose();}catch(e){setError(e.message||'No se pudo eliminar.');}finally{setBusy(false)}}
 return jsx.jsx('div',{className:'calendar-modal-backdrop',children:jsx.jsxs('section',{className:'calendar-modal session-delete-modal',role:'dialog','aria-modal':true,'aria-label':'Eliminar sesión',children:[jsx.jsx('h2',{children:'Eliminar sesión'}),jsx.jsx('p',{children:event.title||'Entrenamiento'}),jsx.jsx('p',{children:'Se eliminarán también la asistencia, RPE y comentarios de las sesiones seleccionadas.'}),error?jsx.jsx('p',{role:'alert',className:'calendar-form-error',children:error}):null,jsx.jsx('button',{type:'button',className:'calendar-secondary-action danger',disabled:busy,onClick:()=>remove('one'),children:busy?'Eliminando…':'Eliminar solo esta sesión'}),event.payload?.recurrence_id?jsx.jsx('button',{type:'button',className:'calendar-secondary-action danger',disabled:busy,onClick:()=>remove('following'),children:'Eliminar esta y todas las posteriores'}):null,jsx.jsx('button',{type:'button',className:'calendar-secondary-action',disabled:busy,onClick:onClose,children:'Cancelar'})]})});
}
export function SessionActions({event,identity,Editor,formFrom,onSaved,onDeleted,invalidate}){
 const [open,setOpen]=React.useState(false),[deleting,setDeleting]=React.useState(false),[form,setForm]=React.useState(()=>formFrom(event)),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{const rows=await saveTraining(form,event,identity,event.team_id);invalidate();onSaved(rows);setOpen(false);setNotice(rows.length>1?`Guardado · ${rows.length} sesiones`:'Cambios guardados');}catch(e){setError(e.message||'No se pudo guardar.');}finally{setBusy(false)}}
 return jsx.jsxs(jsx.Fragment,{children:[jsx.jsxs('div',{className:'session-inline-actions',children:[jsx.jsx('button',{type:'button',className:'pro-primary-action',onClick:()=>{setForm(formFrom(event));setError('');setOpen(true)},children:'Editar sesión'}),jsx.jsx('button',{type:'button',className:'pro-outline-action',onClick:()=>setDeleting(true),children:'Eliminar sesión'}),notice?jsx.jsx('span',{role:'status',children:notice}):null]}),jsx.jsx(Editor,{open,teams:[],leagueTeams:[],form,setForm,saving:busy,error,editing:true,onClose:()=>!busy&&setOpen(false),onSubmit:submit}),deleting?jsx.jsx(DeleteSessionDialog,{event,invalidate,onClose:()=>setDeleting(false),onDeleted}):null]});
}
