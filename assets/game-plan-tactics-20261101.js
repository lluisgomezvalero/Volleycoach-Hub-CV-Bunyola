export const DEFENSES={box:'Caja',diamond:'Rombo',open:'Defensa abierta',box_free6:'Caja con 6 libre'};
export const SERVES={float:'Flotante en apoyo',jump_float:'Flotante en salto',topspin:'Potencia en salto',hybrid:'Híbrido',other:'Otro'};
export const ROTATIONS=['R1','R2','R3','R4','R5','R6'];
const zones=[1,2,3,4,5,6,7,8,9];
export function normalizeTactics(plan={}){
 const rotations={};for(const r of ROTATIONS){const zone=Number(plan.serveByRotation?.[r]);rotations[r]=zones.includes(zone)?zone:null;}
 return {opponentDefense:Object.hasOwn(DEFENSES,plan.opponentDefense)?plan.opponentDefense:'',serveByRotation:rotations,
 opponentServers:(Array.isArray(plan.opponentServers)?plan.opponentServers:[]).filter(s=>s&&typeof s==='object').map(s=>({name:String(s.name||''),dorsal:String(s.dorsal||''),type:Object.hasOwn(SERVES,s.type)?s.type:'',zone:zones.includes(Number(s.zone))?Number(s.zone):null,notes:String(s.notes||'')}))};
}
export function createTacticsComponents(React,jsx,Court){
 const h=(tag,props,...children)=>jsx.jsx(tag,children.length?{...props,children:children.length===1?children[0]:children}:(props||{}));
 const field=(label,control)=>h('label',{className:'gp-field'},h('span',null,label),control);
 const option=(value,label)=>h('option',{value,key:value},label);
 const zoneSelect=(value,onChange,label)=>h('select',{value:value??'',onChange:event=>onChange(event.target.value?Number(event.target.value):null),'aria-label':label},option('','Sin definir'),...zones.map(z=>option(z,`Zona ${z}`)));
 const section=(title,description,...body)=>h('section',{className:'gp-editor-section gp-tactics-section'},h('div',{className:'gp-section-title'},h('div',null,h('h2',null,title),description?h('p',null,description):null)),...body);
 const foldSection=(title,status,...body)=>h('details',{className:'gp-editor-section gp-tactics-section gp-fold-section',open:true},
  h('summary',{className:'gp-section-title gp-fold-summary'},h('div',null,h('h2',null,title),h('p',null,status))),...body);
 function DefenseEditor({plan,onChange}){
  return foldSection('Defensa rival',DEFENSES[plan.opponentDefense]||'Sin definir',
   h('div',{className:'gp-defense-options',role:'group','aria-label':'Tipo de defensa'},
    ...Object.entries(DEFENSES).map(([value,label])=>h('button',{
     type:'button',key:value,className:plan.opponentDefense===value?'selected':'',
     'aria-pressed':plan.opponentDefense===value,
     onClick:()=>onChange(p=>{p.opponentDefense=p.opponentDefense===value?'':value})
    },label))));
 }
 function RotationEditor({plan,onChange}){
  const [active,setActive]=React.useState('R1'),zone=plan.serveByRotation[active];
  const targets=Object.fromEntries(zones.map(z=>[`z${z}`,z===zone?'primary':'none']));
  return foldSection('Nuestro saque',`${Object.values(plan.serveByRotation).filter(Boolean).length}/6 rotaciones del rival configuradas`,
   h('div',{className:'gp-rotation-tabs',role:'group','aria-label':'Rotación rival'},
    ...ROTATIONS.map(r=>h('button',{
     type:'button',key:r,className:[r===active?'active':'',plan.serveByRotation[r]?'is-configured':''].filter(Boolean).join(' '),
     'aria-label':`${r} · ${plan.serveByRotation[r]?`Zona ${plan.serveByRotation[r]}`:'Sin definir'}`,
     'aria-pressed':r===active,onClick:()=>setActive(r)
    },h('span',{className:'gp-rotation-label'},r),h('strong',null,plan.serveByRotation[r]?`Z${plan.serveByRotation[r]}`:'—')))),
   h('div',{className:'gp-rotation-board'},
    h('div',{className:'gp-rotation-context','aria-live':'polite'},
     h('span',null,`Rival en ${active}`),h('strong',null,zone?`Sacar a zona ${zone}`:'Elige una zona en la pista')),
    h(Court,{plan:{serveTargets:targets},mode:'ours',interactive:true,
     onZone:z=>onChange(p=>{p.serveByRotation[active]=p.serveByRotation[active]===z?null:z})}),
    h('p',{className:'gp-rotation-help'},zone?'Toca la zona marcada para quitar el objetivo.':'Toca la zona a la que queremos sacar.')),
   h('label',{className:'gp-switch-row gp-visibility-toggle'},
    h('span',null,'Ocultar objetivos a las jugadoras'),
    h('input',{type:'checkbox',checked:plan.hideServeObjectives,onChange:event=>onChange(p=>{p.hideServeObjectives=event.target.checked})})));
 }
 function ServersEditor({plan,onChange}){
  const [openIndex,setOpenIndex]=React.useState(null);
  const update=(index,key,value)=>onChange(p=>{p.opponentServers[index][key]=value});
  return foldSection('Saque rival por jugadora',plan.opponentServers.length?`${plan.opponentServers.length} sacadora${plan.opponentServers.length===1?'':'s'} · pulsa para editar`:'Añade solo las sacadoras que quieras destacar',
   h('div',{className:'gp-server-list'},...plan.opponentServers.map((s,index)=>{
    const name=[s.dorsal?`#${s.dorsal}`:'',s.name.trim()].filter(Boolean).join(' · ')||`Sacadora ${index+1}`;
    return h('details',{className:'gp-server-card is-editable',key:index,open:openIndex===index},
     h('summary',{className:'gp-server-summary',onClick:event=>{event.preventDefault();setOpenIndex(openIndex===index?null:index)}},
      h('span',{className:'gp-server-monogram','aria-hidden':'true'},s.dorsal||s.name.trim().slice(0,1).toUpperCase()||'·'),
      h('span',{className:'gp-server-overview'},h('strong',null,name),
       h('span',{className:'gp-server-tags'},h('span',null,SERVES[s.type]||'Tipo sin definir'),s.zone?h('b',null,`Z${s.zone}`):null),
       s.notes.trim()?h('span',{className:'gp-server-note-preview'},s.notes):null),
      h('span',{className:'gp-server-expand','aria-hidden':'true'},openIndex===index?'Cerrar':'Editar')),
     h('div',{className:'gp-server-edit-body'},
      h('div',{className:'gp-server-fields'},
       field('Nombre',h('input',{value:s.name,placeholder:'Nombre rival',onChange:event=>update(index,'name',event.target.value)})),
       field('Dorsal',h('input',{value:s.dorsal,inputMode:'numeric',placeholder:'Ej. 8',onChange:event=>update(index,'dorsal',event.target.value)})),
       field('Tipo de saque',h('select',{value:s.type,onChange:event=>update(index,'type',event.target.value)},option('','Sin definir'),...Object.entries(SERVES).map(([v,l])=>option(v,l)))),
       field('Zona habitual de destino',zoneSelect(s.zone,v=>update(index,'zone',v),`Zona de saque de ${s.name||s.dorsal||index+1}`))),
      field('Indicaciones',h('textarea',{rows:2,value:s.notes,placeholder:'Ej. Corto a Z2 o profundo entre 5 y 6',onChange:event=>update(index,'notes',event.target.value)})),
      h('button',{type:'button',className:'gp-server-remove',
       onClick:()=>{onChange(p=>{p.opponentServers.splice(index,1)});setOpenIndex(current=>current===index?null:current>index?current-1:current)},
       'aria-label':`Eliminar sacadora ${s.name||s.dorsal||index+1}`},'Eliminar')));
   })),
   h('button',{type:'button',className:'gp-action-secondary gp-add-server',onClick:()=>{
    setOpenIndex(plan.opponentServers.length);
    onChange(p=>{p.opponentServers.push({name:'',dorsal:'',type:'',zone:null,notes:''})});
   }},'+ Añadir sacadora'));
 }
 function TacticsView({plan}){const p=normalizeTactics(plan),servers=p.opponentServers.filter(s=>(s.name.trim()||s.dorsal.trim())&&(s.type||s.zone||s.notes.trim()));return h(React.Fragment,null,p.opponentDefense?section('Defensa rival','',h('strong',{className:'gp-defense-value'},DEFENSES[p.opponentDefense])):null,!plan.hideServeObjectives&&ROTATIONS.some(r=>p.serveByRotation[r])?section('Nuestro saque por rotación rival','La rotación indicada corresponde al rival.',h('div',{className:'gp-rotation-summary'},...ROTATIONS.map(r=>h('span',{key:r},h('b',null,r),p.serveByRotation[r]?`Zona ${p.serveByRotation[r]}`:'Sin definir')))):null,servers.length?section('Saque rival por jugadora','',h('div',{className:'gp-server-list'},...servers.map((s,index)=>h('article',{className:'gp-server-card',key:index},h('strong',null,[s.dorsal?`#${s.dorsal}`:'',s.name].filter(Boolean).join(' · ')),s.type||s.zone?h('p',null,[SERVES[s.type],s.zone?`Destino habitual: Z${s.zone}`:''].filter(Boolean).join(' · ')):null,s.notes.trim()?h('p',{className:'gp-server-notes'},s.notes):null)))):null);}
 return {DefenseEditor,RotationEditor,ServersEditor,TacticsView};
}
