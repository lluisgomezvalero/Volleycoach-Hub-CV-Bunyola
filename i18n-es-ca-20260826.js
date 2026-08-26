(function(){
'use strict';

const FLAG='__volleyI18nEsCa20260826';
if(window[FLAG])return;
window[FLAG]=true;

const STORAGE_KEY='volleycoach_preferred_language';
const SUPPORTED=['es','ca'];
const LOCALES={es:'es-ES',ca:'ca-ES'};
let language=SUPPORTED.includes(localStorage.getItem(STORAGE_KEY))?localStorage.getItem(STORAGE_KEY):'es';
let applying=false;
let scheduled=false;
let remoteUserKey='';

const PAIRS=[
  ['Inicio','Inici'],['Volver','Tornar'],['Mi Perfil','El meu perfil'],['Mi perfil','El meu perfil'],['Calendario','Calendari'],['Plantilla','Plantilla'],
  ['Entrenos','Entrenaments'],['Entrenamiento','Entrenament'],['Entrenamientos','Entrenaments'],['Bienestar y Carga','Benestar i Càrrega'],
  ['Plan de juego','Pla de joc'],['Plan','Pla'],['Estadísticas','Estadístiques'],['Competición','Competició'],['Usuarios','Usuaris'],
  ['Objetivos','Objectius'],['Planificación','Planificació'],['Rendimiento','Rendiment'],['Hoy','Avui'],['Agenda','Agenda'],
  ['Agendar Evento','Afegir esdeveniment'],['+ Agendar Evento','+ Afegir esdeveniment'],['Añadir evento','Afegir esdeveniment'],
  ['Próxima sesión','Pròxima sessió'],['Completados','Completats'],['Nueva sesión','Nova sessió'],['Nueva Jugadora','Nova jugadora'],['+ Nueva Jugadora','+ Nova jugadora'],
  ['Exportar CSV','Exportar CSV'],['Todas','Totes'],['Colocadoras','Col·locadores'],['Receptoras','Receptores'],['Centrales','Centrals'],['Opuestas','Oposades'],
  ['Partido','Partit'],['Amistoso','Amistós'],['Torneo','Torneig'],['Cumpleaños','Aniversari'],['Liga','Lliga'],['Todo el día','Tot el dia'],
  ['Sin eventos este día','Sense esdeveniments aquest dia'],['Pulsa otro día del calendario para consultar su agenda.','Prem un altre dia del calendari per consultar-ne l’agenda.'],
  ['Sin accesos registrados','Sense accessos registrats'],['Sin cuenta vinculada','Sense compte vinculat'],['Último acceso:','Darrer accés:'],
  ['Mi Perfil Privado','El meu perfil privat'],['Información Privada de la Cuenta','Informació privada del compte'],
  ['Toca la imagen para cambiar tu foto de perfil','Toca la imatge per canviar la foto de perfil'],
  ['Registro de Asistencia a Entrenamientos','Registre d’assistència als entrenaments'],['Recompensas y Logros Desbloqueados','Recompenses i assoliments desbloquejats'],
  ['Nombre Completo','Nom complet'],['Dorsal / Camiseta','Dorsal / Samarreta'],['Fecha de nacimiento','Data de naixement'],['Posición','Posició'],['Posición Principal','Posició principal'],
  ['Estado','Estat'],['Disponible','Disponible'],['Lesionada','Lesionada'],['Baja','Baixa'],['Altura','Alçada'],['Notas','Notes'],
  ['Cancelar','Cancel·lar'],['Guardar','Desar'],['Guardar Cambios','Desar canvis'],['Cerrar','Tancar'],['Editar','Editar'],['Eliminar','Eliminar'],
  ['Usuario','Usuari'],['Contraseña','Contrasenya'],['Iniciar Sesión','Iniciar sessió'],['Usuario o contraseña incorrectos.','Usuari o contrasenya incorrectes.'],
  ['Comprobando conexión segura…','Comprovant connexió segura…'],['Preparando tu sesión…','Preparant la teva sessió…'],
  ['Buenas noches','Bona nit'],['Buenas tardes','Bona tarda'],['Buenos días','Bon dia'],['Entrenador principal','Entrenador principal'],['Jugadora','Jugadora'],
  ['Añadir Nueva Jugadora','Afegir nova jugadora'],['Editar Jugadora','Editar jugadora'],['Dorsal (#)','Dorsal (#)'],['Fecha de Nacimiento','Data de naixement'],
  ['Agendar Evento','Afegir esdeveniment'],['Fecha','Data'],['Hora de Inicio','Hora d’inici'],['Ubicación','Ubicació'],['Plan Táctico / Objetivos','Pla tàctic / Objectius'],
  ['Tipo de Evento','Tipus d’esdeveniment'],['Título','Títol'],['Entreno','Entrenament'],['evento','esdeveniment'],['eventos','esdeveniments'],
  ['Todos los cambios guardados','Tots els canvis desats'],['Sin inicios de sesión registrados','Sense inicis de sessió registrats'],['Último Inicio de Sesión','Darrer inici de sessió'],
  ['Información Privada de la Cuenta','Informació privada del compte'],['Cuerpo Técnico','Cos tècnic'],['Mi Registro Semanal','El meu registre setmanal'],
  ['Pasar lista','Passar llista'],['Asistencia','Assistència'],['Confirmar asistencia','Confirmar assistència'],['Sí, asistiré','Sí, hi assistiré'],['No podré asistir','No hi podré assistir'],
  ['Ver detalle','Veure detall'],['Ver más','Veure més'],['Ver todo','Veure-ho tot'],['Próximos eventos','Pròxims esdeveniments'],['Último resultado','Darrer resultat'],
  ['Seguimiento semanal','Seguiment setmanal'],['Pendientes','Pendents'],['Sin pendientes','Sense pendents'],['Sin datos','Sense dades'],['No hay datos disponibles','No hi ha dades disponibles'],
  ['Sesión','Sessió'],['Sesiones','Sessions'],['Sesión de entrenamiento','Sessió d’entrenament'],['Sesiones de entrenamiento','Sessions d’entrenament'],
  ['Próximas sesiones','Pròximes sessions'],['Sesión completada','Sessió completada'],['Entrenamiento completado','Entrenament completat'],['Historial','Historial'],
  ['Duración','Durada'],['Objetivo de la sesión','Objectiu de la sessió'],['Plan de entrenamiento','Pla d’entrenament'],['Material de la sesión','Material de la sessió'],
  ['Comentarios de jugadoras','Comentaris de jugadores'],['Valoración del entrenador','Valoració de l’entrenador'],['Valoración','Valoració'],['Observaciones','Observacions'],
  ['Pendiente','Pendent'],['Confirmado','Confirmat'],['Asistirá','Hi assistirà'],['No asistirá','No hi assistirà'],['Presente','Present'],['Ausente','Absent'],['Retraso','Retard'],['Lesión','Lesió'],
  ['Validar asistencia','Validar assistència'],['Lista validada','Llista validada'],['Responder','Respondre'],['Confirmado por jugadora','Confirmat per la jugadora'],
  ['Bienestar','Benestar'],['Mi bienestar','El meu benestar'],['Cuestionario de bienestar','Qüestionari de benestar'],['Registro semanal','Registre setmanal'],
  ['Estado general','Estat general'],['Fatiga','Fatiga'],['Dolor muscular','Dolor muscular'],['Estrés','Estrès'],['Sueño','Son'],['Horas de sueño','Hores de son'],['Dolor','Dolor'],
  ['¿Cómo te encuentras hoy?','Com et trobes avui?'],['Guardar bienestar','Desar benestar'],['Carga','Càrrega'],['Carga de entrenamiento','Càrrega d’entrenament'],
  ['Carga de sesión','Càrrega de sessió'],['Carga semanal','Càrrega setmanal'],['Carga habitual','Càrrega habitual'],['Carga reciente','Càrrega recent'],['RPE de la sesión','RPE de la sessió'],
  ['Estadísticas del partido','Estadístiques del partit'],['Estadísticas de partido','Estadístiques del partit'],['Resumen del partido','Resum del partit'],['Resumen','Resum'],
  ['Individual','Individual'],['Equipo','Equip'],['Recepción','Recepció'],['Ataque','Atac'],['Bloqueo','Bloqueig'],['Saque','Servei'],['Defensa','Defensa'],['Colocación','Col·locació'],
  ['Errores','Errors'],['Puntos','Punts'],['Intentos','Intents'],['Aces','Aces'],['Eficiencia','Eficiència'],['Partidos jugados','Partits jugats'],
  ['Publicar estadísticas','Publicar estadístiques'],['Estadísticas publicadas','Estadístiques publicades'],['Borrador','Esborrany'],['Datos del partido','Dades del partit'],
  ['Plan de Juego','Pla de joc'],['Objetivos del partido','Objectius del partit'],['Claves del partido','Claus del partit'],['Rival','Rival'],['Rotación','Rotació'],['Rotaciones','Rotacions'],
  ['Sistema de recepción','Sistema de recepció'],['Sistema de bloqueo','Sistema de bloqueig'],['Visto','Vist'],['No visto','No vist'],['Marcar como visto','Marcar com a vist'],
  ['Clasificación','Classificació'],['Jornada','Jornada'],['Resultados','Resultats'],['Próximos partidos','Pròxims partits'],['Editar equipo','Editar equip'],['Añadir equipo','Afegir equip'],
  ['Guardar equipo','Desar equip'],['Local','Local'],['Visitante','Visitant'],['Partidos','Partits'],['Próximo partido','Pròxim partit'],
  ['Cambiar contraseña','Canviar contrasenya'],['Nueva contraseña','Nova contrasenya'],['Confirmar contraseña','Confirmar contrasenya'],['Guardar contraseña','Desar contrasenya'],
  ['Foto de Perfil','Foto de perfil'],['Información de la cuenta','Informació del compte'],['Editar Evento','Editar esdeveniment'],['Guardar Evento','Desar esdeveniment'],
  ['Eliminar Evento','Eliminar esdeveniment'],['Hora de Fin','Hora de fi'],['Descripción','Descripció'],['Próximo','Pròxim'],['Finalizado','Finalitzat'],['Completado','Completat'],
  ['Fecha pendiente','Data pendent'],['Posición sin asignar','Posició sense assignar'],['Plantilla del equipo','Plantilla de l’equip'],['Nueva jugadora','Nova jugadora'],
  ['Usuarios del Equipo','Usuaris de l’equip'],['Usuarios Registrados','Usuaris registrats'],['Usuario de Acceso','Usuari d’accés'],['Rol / Función','Rol / Funció'],['Última Conexión','Darrera connexió'],
  ['Rendimiento individual','Rendiment individual'],['Salto','Salt'],['Altura de salto','Alçada de salt'],['Fuerza','Força'],['Velocidad','Velocitat'],['Potencia','Potència'],
  ['Evolución','Evolució'],['Mejor marca','Millor marca'],['Último test','Darrer test'],['Registrar test','Registrar test'],['Planificación semanal','Planificació setmanal'],
  ['Semana','Setmana'],['Microciclo','Microcicle'],['Objetivo principal','Objectiu principal'],['Contenido','Contingut'],['Guardar cambios','Desar canvis'],
  ['Cambios guardados correctamente','Canvis desats correctament'],['Guardado correctamente','Desat correctament'],['Evento guardado correctamente','Esdeveniment desat correctament'],
  ['Sin sesiones programadas','Sense sessions programades'],['No hay sesiones completadas','No hi ha sessions completades'],['Sin partidos registrados','Sense partits registrats']
];

const ES_TO_CA=new Map(PAIRS.map(([es,ca])=>[es,ca]));
const CA_TO_ES=new Map(PAIRS.map(([es,ca])=>[ca,es]));
const MONTHS={
  es:['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
  ca:['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre']
};
const SHORT_WEEK={es:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],ca:['Dl','Dt','Dc','Dj','Dv','Ds','Dg']};

function locale(){return LOCALES[language]||LOCALES.es;}
function translateExact(value){
  const raw=String(value??'');
  const trimmed=raw.trim();
  if(!trimmed)return raw;
  const map=language==='ca'?ES_TO_CA:CA_TO_ES;
  let translated=map.get(trimmed);
  if(!translated){
    const eventMatch=trimmed.match(/^(\d+)\s+(evento|eventos|esdeveniment|esdeveniments)$/i);
    if(eventMatch){
      const n=Number(eventMatch[1]);
      translated=language==='ca'?`${n} ${n===1?'esdeveniment':'esdeveniments'}`:`${n} ${n===1?'evento':'eventos'}`;
    }
    const playerMatch=trimmed.match(/^(\d+)\s+(jugadora|jugadoras|jugadores)$/i);
    if(!translated&&playerMatch){
      const n=Number(playerMatch[1]);
      translated=language==='ca'?`${n} ${n===1?'jugadora':'jugadores'}`:`${n} ${n===1?'jugadora':'jugadoras'}`;
    }
  }
  if(!translated)return raw;
  const lead=raw.match(/^\s*/)?.[0]||'';
  const tail=raw.match(/\s*$/)?.[0]||'';
  return `${lead}${translated}${tail}`;
}

function shouldSkipText(node){
  const parent=node?.parentElement;
  if(!parent)return true;
  if(parent.closest('script,style,textarea,input,select,option,[contenteditable="true"]'))return true;
  return false;
}

function translateTree(root){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){
    if(!shouldSkipText(root)){
      const next=translateExact(root.nodeValue);
      if(next!==root.nodeValue)root.nodeValue=next;
    }
    return;
  }
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    if(shouldSkipText(node))return;
    const next=translateExact(node.nodeValue);
    if(next!==node.nodeValue)node.nodeValue=next;
  });

  const elements=[];
  if(root.matches?.('[title],[aria-label],[placeholder]'))elements.push(root);
  if(root.querySelectorAll)elements.push(...root.querySelectorAll('[title],[aria-label],[placeholder]'));
  elements.forEach(el=>{
    ['title','aria-label','placeholder'].forEach(attr=>{
      if(!el.hasAttribute(attr))return;
      const current=el.getAttribute(attr);
      const next=translateExact(current);
      if(next!==current)el.setAttribute(attr,next);
    });
  });
}

function capitalize(value){return value?value.charAt(0).toUpperCase()+value.slice(1):value;}
function refreshDates(){
  try{
    if(typeof currentCalendarYear!=='undefined'&&typeof currentCalendarMonth!=='undefined'){
      const date=new Date(Number(currentCalendarYear),Number(currentCalendarMonth),1,12);
      const monthTitle=document.getElementById('gcal-month-title');
      if(monthTitle)monthTitle.textContent=capitalize(new Intl.DateTimeFormat(locale(),{month:'long',year:'numeric'}).format(date));
      const selected=document.querySelector('#view-calendar .cal-month-day.is-selected .cal-month-day-number');
      const selectedTitle=document.querySelector('#view-calendar .cal-selected-head strong');
      const day=Number(selected?.textContent||0);
      if(selectedTitle&&day){
        const selectedDate=new Date(Number(currentCalendarYear),Number(currentCalendarMonth),day,12);
        selectedTitle.textContent=new Intl.DateTimeFormat(locale(),{weekday:'long',day:'numeric',month:'long'}).format(selectedDate);
      }
    }
  }catch(_){}
  const currentDate=document.getElementById('current-date-display');
  if(currentDate){
    try{currentDate.textContent=new Intl.DateTimeFormat(locale(),{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());}catch(_){}
  }
  const weekdays=document.querySelectorAll('#view-calendar .gcal-weekdays-header>div');
  if(weekdays.length===7)weekdays.forEach((el,i)=>{el.textContent=SHORT_WEEK[language][i];});
  const mobileWeekdays=document.querySelectorAll('#view-calendar .cal-month-weekdays>span');
  if(mobileWeekdays.length===7)mobileWeekdays.forEach((el,i)=>{el.textContent=SHORT_WEEK[language][i].replace('Dt','M').replace('Dl','L').replace('Dc','X').replace('Dj','J').replace('Dv','V').replace('Ds','S').replace('Dg','D');});
  const monthSelect=document.getElementById('gcal-select-month');
  if(monthSelect){[...monthSelect.options].forEach((option,i)=>{if(MONTHS[language][i])option.textContent=capitalize(MONTHS[language][i]);});}
}

function injectStyles(){
  if(document.getElementById('volley-i18n-es-ca-style'))return;
  const style=document.createElement('style');
  style.id='volley-i18n-es-ca-style';
  style.textContent=`
    #profile-language-card .profile-language-copy{display:flex;flex-direction:column;gap:.12rem;margin-bottom:.72rem}
    #profile-language-card .profile-language-copy strong{font-size:.82rem;color:#0f172a}
    #profile-language-card .profile-language-copy span{font-size:.7rem;color:#64748b;line-height:1.35}
    #profile-language-card .profile-language-switch{display:grid;grid-template-columns:1fr 1fr;gap:.45rem;padding:.25rem;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px}
    #profile-language-card .profile-language-switch button{min-height:40px;border:0;border-radius:9px;background:transparent;color:#64748b;font:inherit;font-size:.78rem;font-weight:800;cursor:pointer}
    #profile-language-card .profile-language-switch button.is-active{background:#fff;color:#92400e;box-shadow:0 2px 8px rgba(15,23,42,.08)}
  `;
  document.head.appendChild(style);
}

function ensureLanguageSelector(){
  const form=document.getElementById('form-my-profile');
  if(!form)return null;
  let card=document.getElementById('profile-language-card');
  if(!card){
    card=document.createElement('div');
    card.id='profile-language-card';
    card.className='profile-private-card';
    card.innerHTML=`
      <div class="profile-private-header"><i data-lucide="languages"></i><span data-lang-title></span></div>
      <div class="profile-language-copy"><strong data-lang-subtitle></strong><span data-lang-help></span></div>
      <div class="profile-language-switch" role="group" aria-label="Idioma de la aplicación">
        <button type="button" data-language="es">Castellano</button>
        <button type="button" data-language="ca">Català</button>
      </div>`;
    const privateInfo=document.getElementById('profile-private-info')?.closest('.profile-private-card');
    if(privateInfo)privateInfo.insertAdjacentElement('afterend',card);else form.prepend(card);
    card.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>void setLanguage(button.dataset.language,{persist:true})));
    try{window.lucide?.createIcons?.();}catch(_){}
  }
  syncLanguageSelector();
  return card;
}

function syncLanguageSelector(){
  const card=document.getElementById('profile-language-card');
  if(!card)return;
  const text=language==='ca'
    ?{title:'Idioma de l’aplicació',subtitle:'Català o castellà',help:'La teva elecció queda desada al teu perfil i s’aplica en iniciar sessió.'}
    :{title:'Idioma de la aplicación',subtitle:'Castellano o catalán',help:'Tu elección queda guardada en tu perfil y se aplica al iniciar sesión.'};
  const title=card.querySelector('[data-lang-title]');if(title)title.textContent=text.title;
  const subtitle=card.querySelector('[data-lang-subtitle]');if(subtitle)subtitle.textContent=text.subtitle;
  const help=card.querySelector('[data-lang-help]');if(help)help.textContent=text.help;
  card.querySelectorAll('[data-language]').forEach(button=>{
    const active=button.dataset.language===language;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
}

function applyLanguage(){
  applying=true;
  try{
    document.documentElement.lang=language==='ca'?'ca':'es';
    translateTree(document.body);
    ensureLanguageSelector();
    refreshDates();
  }finally{applying=false;}
  window.dispatchEvent(new CustomEvent('volley:language-applied',{detail:{language}}));
}

async function persistRemote(lang){
  try{
    if(!window.VolleySupabase?.updateOwnProfile)return;
    const {error}=await window.VolleySupabase.updateOwnProfile({preferred_language:lang});
    if(error)throw error;
  }catch(error){
    console.warn('[I18N] No se pudo guardar el idioma en Supabase.',error);
    try{window.showToast?.(lang==='ca'?'Idioma canviat en aquest dispositiu; no s’ha pogut desar al perfil.':'Idioma cambiado en este dispositivo; no se ha podido guardar en el perfil.','error');}catch(_){}
  }
}

async function setLanguage(next,{persist=true}={}){
  if(!SUPPORTED.includes(next))next='es';
  const changed=language!==next;
  language=next;
  localStorage.setItem(STORAGE_KEY,language);
  applyLanguage();
  if(persist)await persistRemote(language);
  if(changed){
    try{window.showToast?.(language==='ca'?'Idioma canviat a català.':'Idioma cambiado a castellano.');}catch(_){}
    window.dispatchEvent(new CustomEvent('volley:language-change',{detail:{language}}));
  }
  return language;
}

function t(es,ca){return language==='ca'?(ca??es):es;}
function formatDate(value,options={day:'2-digit',month:'2-digit',year:'numeric'}){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return String(value??'');
  return new Intl.DateTimeFormat(locale(),options).format(date);
}

async function syncFromProfile(){
  const user=(()=>{try{return typeof getCurrentUser==='function'?getCurrentUser():null;}catch(_){return null;}})();
  const key=String(user?.username||'').toLowerCase();
  if(!key||key===remoteUserKey||!window.VolleySupabase?.getIdentity)return;
  try{
    const {data,error}=await window.VolleySupabase.getIdentity();
    if(error||!data?.profile)return;
    remoteUserKey=key;
    const preferred=data.profile.preferred_language;
    if(SUPPORTED.includes(preferred))await setLanguage(preferred,{persist:false});
    else applyLanguage();
  }catch(error){console.warn('[I18N] No se pudo cargar el idioma del perfil.',error);}
}

const pendingRoots=new Set();
let pendingCalendarRefresh=false;

function queueMutationWork(mutations){
  if(applying)return;
  let hasWork=false;
  for(const mutation of mutations){
    if(mutation.type!=='childList'||!mutation.addedNodes?.length)continue;
    const target=mutation.target?.nodeType===Node.ELEMENT_NODE?mutation.target:null;
    if(target?.closest?.('#view-calendar'))pendingCalendarRefresh=true;
    mutation.addedNodes.forEach(node=>{
      if(node.nodeType!==Node.TEXT_NODE&&node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
      if(node.nodeType===Node.ELEMENT_NODE&&(node.id==='volley-i18n-es-ca-style'||node.closest?.('#profile-language-card')))return;
      if(node.nodeType===Node.ELEMENT_NODE&&(node.matches?.('#view-calendar *')||node.querySelector?.('#view-calendar')))pendingCalendarRefresh=true;
      pendingRoots.add(node);
      hasWork=true;
    });
  }
  if(!hasWork||scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    if(applying)return;
    const roots=[...pendingRoots];
    pendingRoots.clear();
    applying=true;
    try{
      for(const root of roots){
        if(root.nodeType===Node.TEXT_NODE||root.isConnected)translateTree(root);
      }
      if(pendingCalendarRefresh){refreshDates();pendingCalendarRefresh=false;}
      syncLanguageSelector();
    }finally{applying=false;}
  });
}

function install(){
  injectStyles();
  applyLanguage();
  void syncFromProfile();

  const observer=new MutationObserver(queueMutationWork);
  observer.observe(document.body||document.documentElement,{childList:true,subtree:true});

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#btn-my-profile-header,#btn-my-profile-home')){
      setTimeout(()=>{ensureLanguageSelector();translateTree(document.getElementById('modal-my-profile'));void syncFromProfile();},0);
    }
  },true);
  window.addEventListener('focus',()=>void syncFromProfile());

  [250,900,2200].forEach(delay=>setTimeout(()=>{ensureLanguageSelector();void syncFromProfile();},delay));
}

window.VolleyI18n=Object.freeze({
  getLanguage:()=>language,
  setLanguage,
  t,
  formatDate,
  locale,
  apply:applyLanguage
});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
