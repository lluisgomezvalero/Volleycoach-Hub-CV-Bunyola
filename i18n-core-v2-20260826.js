(function(){
'use strict';

const FLAG='__volleyI18nCoreV2_20260826';
if(window[FLAG])return;
window[FLAG]=true;

const STORAGE_KEY='volleycoach_preferred_language';
const SUPPORTED=['es','ca'];
const LOCALES={es:'es-ES',ca:'ca-ES'};
let language=SUPPORTED.includes(localStorage.getItem(STORAGE_KEY))?localStorage.getItem(STORAGE_KEY):'es';
let remoteUserKey='';

function locale(){return LOCALES[language]||LOCALES.es;}
function t(es,ca){return language==='ca'?(ca??es):es;}
function formatDate(value,options={day:'2-digit',month:'2-digit',year:'numeric'}){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return String(value??'');
  return new Intl.DateTimeFormat(locale(),options).format(date);
}

function setText(selector,es,ca){
  document.querySelectorAll(selector).forEach(el=>{el.textContent=t(es,ca);});
}
function setAttr(selector,attr,es,ca){
  document.querySelectorAll(selector).forEach(el=>el.setAttribute(attr,t(es,ca)));
}

function applyChrome(){
  document.documentElement.lang=language;

  const navLabels={
    home:['Inicio','Inici'],
    roster:['Plantilla','Plantilla'],
    calendar:['Calendario','Calendari'],
    training:['Entrenos','Entrenaments'],
    wellness:['Bienestar y Carga','Benestar i Càrrega'],
    tactics:['Plan','Pla'],
    statistics:['Estadísticas','Estadístiques'],
    competition:['Competición','Competició'],
    performance:['Rendimiento','Rendiment'],
    planning:['Planificación','Planificació']
  };
  document.querySelectorAll('[data-target]').forEach(button=>{
    const pair=navLabels[String(button.dataset.target||'')];
    if(!pair)return;
    const label=button.querySelector('span')||button;
    if(label)label.textContent=t(pair[0],pair[1]);
  });

  setText('#module-back-btn + #mobile-module-title','Volver','Tornar');
  setAttr('#module-back-btn','title','Volver','Tornar');
  setAttr('#module-back-btn','aria-label','Volver','Tornar');
  setText('#gcal-btn-today','Hoy','Avui');
  setText('#btn-add-event','+ Agendar Evento','+ Afegir esdeveniment');
  setText('#btn-export-csv','Exportar CSV','Exportar CSV');
  setText('#btn-add-player','+ Nueva Jugadora','+ Nova jugadora');
  setText('#nav-user-name-header','Mi Perfil','El meu perfil');
  setText('#nav-user-name-home','Mi perfil','El meu perfil');
  setText('[data-save-status] span','Todos los cambios guardados','Tots els canvis desats');
  syncLanguageSelector();
}

function injectStyles(){
  if(document.getElementById('volley-i18n-v2-style'))return;
  const style=document.createElement('style');
  style.id='volley-i18n-v2-style';
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
    ?{title:'Idioma de l’aplicació',subtitle:'Català o castellà',help:'La teva elecció queda desada al teu perfil.'}
    :{title:'Idioma de la aplicación',subtitle:'Castellano o catalán',help:'Tu elección queda guardada en tu perfil.'};
  const title=card.querySelector('[data-lang-title]');if(title)title.textContent=text.title;
  const subtitle=card.querySelector('[data-lang-subtitle]');if(subtitle)subtitle.textContent=text.subtitle;
  const help=card.querySelector('[data-lang-help]');if(help)help.textContent=text.help;
  card.querySelectorAll('[data-language]').forEach(button=>{
    const active=button.dataset.language===language;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
}

async function persistRemote(lang){
  try{
    if(!window.VolleySupabase?.updateOwnProfile)return;
    const {error}=await window.VolleySupabase.updateOwnProfile({preferred_language:lang});
    if(error)throw error;
  }catch(error){console.warn('[I18N v2] No se pudo guardar el idioma.',error);}
}

function rerenderKnownModules(){
  const candidates=['renderDashboard','renderCalendar','renderTraining','renderWellness','renderStatistics','renderCompetition','renderPerformance','renderGamePlan'];
  candidates.forEach(name=>{
    try{
      const fn=window[name];
      const active=document.querySelector('.page-view.active');
      if(typeof fn==='function'&&active&&active.id.toLowerCase().includes(name.replace('render','').toLowerCase()))fn();
    }catch(_){}
  });
}

async function setLanguage(next,{persist=true}={}){
  if(!SUPPORTED.includes(next))next='es';
  const changed=language!==next;
  language=next;
  localStorage.setItem(STORAGE_KEY,language);
  applyChrome();
  if(persist)void persistRemote(language);
  if(changed){
    window.dispatchEvent(new CustomEvent('volley:language-change',{detail:{language}}));
    setTimeout(()=>{applyChrome();rerenderKnownModules();},0);
  }
  return language;
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
  }catch(error){console.warn('[I18N v2] No se pudo cargar el idioma.',error);}
}

function install(){
  injectStyles();
  applyChrome();
  void syncFromProfile();

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#btn-my-profile-header,#btn-my-profile-home')){
      setTimeout(()=>{ensureLanguageSelector();applyChrome();void syncFromProfile();},0);
    }else{
      setTimeout(applyChrome,0);
    }
  },true);
  window.addEventListener('focus',()=>void syncFromProfile());
  window.addEventListener('volley:language-applied',applyChrome);
  [250,900,2200].forEach(delay=>setTimeout(()=>{ensureLanguageSelector();applyChrome();void syncFromProfile();},delay));
}

window.VolleyI18n=Object.freeze({
  getLanguage:()=>language,
  setLanguage,
  t,
  formatDate,
  locale,
  apply:applyChrome
});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
