(function(){
'use strict';

const FLAG='__calendarProfileRosterFixes20260825';
if(window[FLAG])return;
window[FLAG]=true;

let hoveredCalendarDate='';
let calendarButtonBound=false;
let playerFormBound=false;
let profileRefreshBusy=false;
let rosterEnhanceScheduled=false;

function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function currentUser(){try{return typeof getCurrentUser==='function'?getCurrentUser():null;}catch(_){return null;}}
function isCoach(){
  try{if(typeof window.isCoachUser==='function')return Boolean(window.isCoachUser());}catch(_){}
  return ['administrator','admin','coach'].includes(String(currentUser()?.role||'').toLowerCase());
}
function client(){try{return window.VolleySupabase?.getClient?.()||null;}catch(_){return null;}}
function pad(value){return String(value).padStart(2,'0');}
function monthPrefix(){
  try{return `${currentCalendarYear}-${pad(Number(currentCalendarMonth)+1)}-`;}
  catch(_){return '';}
}
function dateFromCurrentMonthDay(day){
  const n=Number(day);
  if(!Number.isInteger(n)||n<1||n>31)return '';
  try{return `${currentCalendarYear}-${pad(Number(currentCalendarMonth)+1)}-${pad(n)}`;}
  catch(_){return '';}
}
function dateFromDesktopCell(cell){
  const list=cell?.querySelector?.('.gcal-events-list[id^="events-date-"]');
  const id=String(list?.id||'');
  return id.startsWith('events-date-')?id.slice('events-date-'.length):'';
}
function selectedCalendarDate(){
  const prefix=monthPrefix();
  if(hoveredCalendarDate&&(!prefix||hoveredCalendarDate.startsWith(prefix)))return hoveredCalendarDate;
  const selected=document.querySelector('#view-calendar .cal-month-day.is-selected .cal-month-day-number');
  const mobileDate=dateFromCurrentMonthDay(selected?.textContent?.trim());
  if(mobileDate)return mobileDate;
  return '';
}

function trackCalendarSelection(event){
  const desktopCell=event.target?.closest?.('#view-calendar .gcal-day-cell:not(.other-month)');
  if(desktopCell){
    const key=dateFromDesktopCell(desktopCell);
    if(key){
      hoveredCalendarDate=key;
      document.querySelectorAll('#view-calendar .gcal-day-cell.is-cvb-selected').forEach(el=>el.classList.remove('is-cvb-selected'));
      desktopCell.classList.add('is-cvb-selected');
    }
  }
  const mobileDay=event.target?.closest?.('#view-calendar .cal-month-day');
  if(mobileDay){
    const key=dateFromCurrentMonthDay(mobileDay.querySelector('.cal-month-day-number')?.textContent?.trim());
    if(key)hoveredCalendarDate=key;
  }
}

function handleCalendarAdd(event){
  if(!isCoach()){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  const key=selectedCalendarDate();
  if(!key)return;
  try{
    if(typeof openAddEventModalForDate==='function'){
      event.preventDefault();
      event.stopImmediatePropagation();
      openAddEventModalForDate(key);
    }
  }catch(error){console.warn('[CalendarFix] No se pudo abrir el día seleccionado.',error);}
}

function syncCalendarAddButton(){
  const button=document.getElementById('btn-add-event');
  if(!button)return false;
  button.classList.add('coach-only-view');
  const coach=isCoach();
  button.hidden=!coach;
  button.setAttribute('aria-hidden',coach?'false':'true');
  if(coach){
    button.style.removeProperty('display');
    button.removeAttribute('tabindex');
  }else{
    button.style.setProperty('display','none','important');
    button.setAttribute('tabindex','-1');
  }
  if(!calendarButtonBound){
    calendarButtonBound=true;
    button.addEventListener('click',handleCalendarAdd,true);
    button.addEventListener('touchend',handleCalendarAdd,{capture:true,passive:false});
  }
  return true;
}

function parseLoginDate(value){
  if(!value)return null;
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value;
  const text=String(value).trim();
  if(!text||/nunca|sin acceso|sin inicio/i.test(text))return null;
  const direct=new Date(text);
  if(!Number.isNaN(direct.getTime()))return direct;
  const local=text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4}).*?(\d{1,2}):(\d{2})/);
  if(local){
    const d=new Date(Number(local[3]),Number(local[2])-1,Number(local[1]),Number(local[4]),Number(local[5]));
    if(!Number.isNaN(d.getTime()))return d;
  }
  return null;
}
function formatLogin(value){
  const date=parseLoginDate(value);
  if(!date)return 'Sin accesos registrados';
  const datePart=new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
  const timePart=new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
  return `${datePart} · ${timePart}`;
}

function injectStyles(){
  if(document.getElementById('calendar-profile-roster-fixes-20260825-css'))return;
  const style=document.createElement('style');
  style.id='calendar-profile-roster-fixes-20260825-css';
  style.textContent=`
    #view-calendar .gcal-day-cell.is-cvb-selected:not(.other-month){outline:2px solid rgba(217,145,23,.28);outline-offset:-2px;background:rgba(255,247,231,.72)}

    #modal-my-profile .modal-content{width:min(520px,calc(100vw - 18px))!important;max-width:520px!important;max-height:min(92dvh,860px)!important;overflow:hidden!important}
    #modal-my-profile .modal-body{max-width:100%!important;overflow-y:auto!important;overflow-x:hidden!important;padding-left:clamp(.75rem,3vw,1.25rem)!important;padding-right:clamp(.75rem,3vw,1.25rem)!important}
    #modal-my-profile #form-my-profile,#modal-my-profile .profile-private-card,#modal-my-profile .profile-info-grid,#modal-my-profile #profile-attendance-stats,#modal-my-profile #profile-achievements-list{min-width:0!important;max-width:100%!important;width:100%!important}
    #modal-my-profile .profile-private-card{overflow:hidden!important;background:#fff!important;border:1px solid #e2e8f0!important;box-shadow:0 4px 14px rgba(15,23,42,.035)!important;padding:1rem!important;margin-bottom:.85rem!important}
    #modal-my-profile .profile-private-header{min-width:0!important;color:#334155!important;font-size:.78rem!important;font-weight:850!important;gap:.45rem!important;overflow-wrap:anywhere!important}
    #modal-my-profile #profile-private-info{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:.6rem!important}
    #modal-my-profile .profile-info-item{min-width:0!important;max-width:100%!important;background:#f8fafc!important;border:1px solid #e2e8f0!important;border-left:3px solid #d99117!important;border-radius:11px!important;padding:.7rem .75rem!important;overflow:hidden!important}
    #modal-my-profile .profile-info-item label{color:#64748b!important;font-size:.65rem!important;line-height:1.2!important;letter-spacing:.035em!important;margin-bottom:.25rem!important;overflow-wrap:anywhere!important}
    #modal-my-profile .profile-info-item span{display:block!important;min-width:0!important;max-width:100%!important;color:#0f172a!important;font-size:.86rem!important;line-height:1.25!important;font-weight:750!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}
    #modal-my-profile #profile-attendance-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:.5rem!important}
    #modal-my-profile #profile-attendance-stats>*{min-width:0!important;max-width:100%!important;overflow:hidden!important;padding:.55rem .35rem!important}
    #modal-my-profile #profile-achievements-list>*{min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important}
    #modal-my-profile input,#modal-my-profile select,#modal-my-profile textarea,#modal-my-profile button{max-width:100%}

    #view-roster .coach-player-last-login{display:flex;align-items:center;gap:.3rem;min-width:0;margin-top:.45rem;padding-top:.45rem;border-top:1px solid #edf1f5;color:#64748b;font-size:.66rem;line-height:1.25;font-weight:650}
    #view-roster .coach-player-last-login svg{width:13px;height:13px;flex:0 0 auto}
    #view-roster .coach-player-last-login span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #view-roster .coach-player-last-login strong{font-weight:850;color:#475569}
    #view-roster .coach-player-last-login.is-empty{color:#94a3b8}

    @media(max-width:460px){
      #modal-my-profile .modal-content{width:calc(100vw - 12px)!important;border-radius:18px!important}
      #modal-my-profile #profile-private-info{grid-template-columns:minmax(0,1fr)!important}
      #modal-my-profile #profile-attendance-stats{gap:.35rem!important}
      #modal-my-profile .profile-private-card{padding:.8rem!important}
      #modal-my-profile .profile-info-item{padding:.62rem .68rem!important}
    }
  `;
  document.head.appendChild(style);
}

function removePlayerLastLoginFromProfile(){
  const info=document.getElementById('profile-private-info');
  if(!info)return;
  [...info.children].forEach(item=>{
    const label=String(item.querySelector('label')?.textContent||'');
    if(/último\s+inicio|última\s+conexión|último\s+acceso/i.test(label))item.remove();
  });
}

function formatCoachOwnLogin(){
  const info=document.getElementById('profile-private-info');
  if(!info)return;
  [...info.children].forEach(item=>{
    const label=String(item.querySelector('label')?.textContent||'');
    if(!/último\s+inicio|última\s+conexión|último\s+acceso/i.test(label))return;
    const span=item.querySelector('span');
    if(span)span.textContent=formatLogin(span.textContent);
  });
}

async function refreshCoachOwnLogin(){
  if(profileRefreshBusy||!isCoach())return;
  const user=currentUser();
  const db=client();
  if(!user?.username||!db)return;
  profileRefreshBusy=true;
  try{
    const {data,error}=await db.from('profiles').select('last_login_at').ilike('username',String(user.username)).maybeSingle();
    if(error||!data)return;
    const info=document.getElementById('profile-private-info');
    if(!info)return;
    [...info.children].forEach(item=>{
      const label=String(item.querySelector('label')?.textContent||'');
      if(/último\s+inicio|última\s+conexión|último\s+acceso/i.test(label)){
        const span=item.querySelector('span');
        if(span)span.textContent=formatLogin(data.last_login_at);
      }
    });
  }catch(error){console.warn('[ProfileFix] No se pudo refrescar el último acceso.',error);}
  finally{profileRefreshBusy=false;}
}

function polishProfile(){
  const modal=document.getElementById('modal-my-profile');
  if(!modal)return;
  const role=String(currentUser()?.role||'').toLowerCase();
  if(role==='player')removePlayerLastLoginFromProfile();
  else if(['administrator','admin','coach'].includes(role)){
    formatCoachOwnLogin();
    if(modal.classList.contains('active'))void refreshCoachOwnLogin();
  }
}

function playerForCard(card){
  const name=String(card?.querySelector('.trading-card-name')?.textContent||'').trim();
  if(!name)return null;
  return (state()?.players||[]).find(player=>String(player?.name||'').trim()===name)||null;
}
function enhanceRosterLogins(){
  rosterEnhanceScheduled=false;
  const view=document.getElementById('view-roster');
  if(!view)return;
  view.querySelectorAll('.coach-player-last-login').forEach(node=>node.remove());
  if(!isCoach())return;
  view.querySelectorAll('.player-trading-card').forEach(card=>{
    const player=playerForCard(card);
    const info=card.querySelector('.trading-card-info');
    if(!player||!info)return;
    const linked=Boolean(player.profile_id||player.profileId||player.username);
    const raw=player.lastLoginAt||player.last_login_at||null;
    const text=raw?formatLogin(raw):(linked?'Sin accesos registrados':'Sin cuenta vinculada');
    const row=document.createElement('div');
    row.className=`coach-player-last-login${raw?'':' is-empty'}`;
    row.innerHTML=`<i data-lucide="clock-3"></i><span><strong>Último acceso:</strong> ${text}</span>`;
    info.appendChild(row);
  });
  try{window.lucide?.createIcons?.();}catch(_){}
}
function scheduleRosterEnhance(){
  if(rosterEnhanceScheduled)return;
  rosterEnhanceScheduled=true;
  requestAnimationFrame(enhanceRosterLogins);
}
function wrapRosterRender(){
  const original=window.renderRoster;
  if(typeof original!=='function'||original.__calendarProfileRosterWrapped)return false;
  const wrapped=function(){
    const result=original.apply(this,arguments);
    scheduleRosterEnhance();
    return result;
  };
  wrapped.__calendarProfileRosterWrapped=true;
  window.renderRoster=wrapped;
  return true;
}

async function persistDorsal(snapshot){
  const db=client();
  if(!db||!snapshot||!Number.isInteger(snapshot.number))return;
  let query=db.from('players').update({dorsal:snapshot.number});
  if(snapshot.supabaseId)query=query.eq('id',snapshot.supabaseId);
  else if(snapshot.profileId)query=query.eq('profile_id',snapshot.profileId);
  else if(snapshot.legacyId)query=query.eq('legacy_id',snapshot.legacyId);
  else query=query.eq('legacy_id',snapshot.localId);

  try{
    const {data,error}=await query.select('id,legacy_id,dorsal').maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('No se encontró la jugadora en Supabase.');
    const s=state();
    const local=s?.players?.find(player=>String(player.id)===String(snapshot.localId));
    if(local){
      local.supabaseId=data.id||local.supabaseId;
      local.legacy_id=data.legacy_id||local.legacy_id;
      local.number=Number(data.dorsal);
      local.dorsal=Number(data.dorsal);
      try{saveAppData(s);}catch(_){}
    }
    if(typeof window.syncRosterFromSupabase==='function')setTimeout(()=>void window.syncRosterFromSupabase(),120);
  }catch(error){
    console.error('[RosterFix] No se pudo guardar el dorsal en Supabase.',error);
    try{window.showToast?.('El dorsal se cambió en pantalla, pero no se pudo guardar en la nube.','error');}catch(_){}
  }
}

function bindPlayerForm(){
  const form=document.getElementById('form-player');
  if(!form||playerFormBound)return Boolean(form);
  playerFormBound=true;
  form.addEventListener('submit',()=>{
    if(!isCoach())return;
    const localId=String(document.getElementById('player-id-input')?.value||'');
    const number=Number(document.getElementById('player-num-input')?.value);
    if(!localId||!Number.isInteger(number))return;
    const player=(state()?.players||[]).find(item=>String(item.id)===localId)||{};
    const snapshot={
      localId,
      number,
      supabaseId:player.supabaseId||player.supabase_id||null,
      profileId:player.profile_id||player.profileId||null,
      legacyId:player.legacy_id||player.legacyId||null
    };
    setTimeout(()=>void persistDorsal(snapshot),0);
  },true);
  return true;
}

function observeUi(){
  const profile=document.getElementById('modal-my-profile');
  if(profile){
    new MutationObserver(()=>queueMicrotask(polishProfile)).observe(profile,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }
  const roster=document.getElementById('roster-grid-container');
  if(roster){new MutationObserver(scheduleRosterEnhance).observe(roster,{childList:true,subtree:true});}
  const calendar=document.getElementById('view-calendar');
  if(calendar){
    new MutationObserver(()=>{syncCalendarAddButton();}).observe(calendar,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }
}

function syncAll(){
  injectStyles();
  syncCalendarAddButton();
  wrapRosterRender();
  bindPlayerForm();
  polishProfile();
  scheduleRosterEnhance();
}

function install(){
  injectStyles();
  document.addEventListener('pointerover',trackCalendarSelection,true);
  document.addEventListener('click',trackCalendarSelection,true);
  observeUi();
  syncAll();
  let tries=0;
  const timer=setInterval(()=>{
    syncAll();
    tries+=1;
    if(tries>40)clearInterval(timer);
  },180);
  window.addEventListener('focus',syncAll);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncAll();});
  console.info('[UXFixes] Calendario, perfil privado, último acceso y dorsal sincronizado activos.');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
