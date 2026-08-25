(function(){
'use strict';

const FLAG='__calendarProfileRosterFixes20260825';
if(window[FLAG])return;
window[FLAG]=true;

let selectedCalendarDateKey='';
let calendarButton=null;
let playerForm=null;
let rosterEnhanceQueued=false;
let profileRefreshBusy=false;

function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function currentUser(){try{return typeof getCurrentUser==='function'?getCurrentUser():null;}catch(_){return null;}}
function isCoach(){
  try{if(typeof window.isCoachUser==='function')return Boolean(window.isCoachUser());}catch(_){}
  return ['administrator','admin','coach'].includes(String(currentUser()?.role||'').toLowerCase());
}
function db(){try{return window.VolleySupabase?.getClient?.()||null;}catch(_){return null;}}
function pad(v){return String(v).padStart(2,'0');}
function currentMonthPrefix(){
  try{return `${currentCalendarYear}-${pad(Number(currentCalendarMonth)+1)}-`;}
  catch(_){return '';}
}
function dateForVisibleDay(day){
  const n=Number(day);
  if(!Number.isInteger(n)||n<1||n>31)return '';
  try{return `${currentCalendarYear}-${pad(Number(currentCalendarMonth)+1)}-${pad(n)}`;}
  catch(_){return '';}
}
function desktopCellDate(cell){
  const list=cell?.querySelector?.('.gcal-events-list[id^="events-date-"]');
  const id=String(list?.id||'');
  return id.startsWith('events-date-')?id.slice(12):'';
}
function selectedDate(){
  const prefix=currentMonthPrefix();
  if(selectedCalendarDateKey&&(!prefix||selectedCalendarDateKey.startsWith(prefix)))return selectedCalendarDateKey;
  const mobileSelected=document.querySelector('#view-calendar .cal-month-day.is-selected .cal-month-day-number');
  return dateForVisibleDay(mobileSelected?.textContent?.trim())||'';
}

function markCalendarSelection(event){
  const desktopCell=event.target?.closest?.('#view-calendar .gcal-day-cell:not(.other-month)');
  if(desktopCell){
    const key=desktopCellDate(desktopCell);
    if(key){
      selectedCalendarDateKey=key;
      document.querySelectorAll('#view-calendar .gcal-day-cell.is-cvb-selected').forEach(el=>{
        if(el!==desktopCell)el.classList.remove('is-cvb-selected');
      });
      desktopCell.classList.add('is-cvb-selected');
    }
    return;
  }
  const mobileDay=event.target?.closest?.('#view-calendar .cal-month-day');
  if(mobileDay){
    const key=dateForVisibleDay(mobileDay.querySelector('.cal-month-day-number')?.textContent?.trim());
    if(key)selectedCalendarDateKey=key;
  }
}

function handleCalendarAdd(event){
  if(!isCoach()){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  const key=selectedDate();
  if(!key)return;
  if(typeof openAddEventModalForDate==='function'){
    event.preventDefault();
    event.stopImmediatePropagation();
    openAddEventModalForDate(key);
  }
}

function syncCalendarAddButton(){
  const button=document.getElementById('btn-add-event');
  if(!button)return;
  button.classList.add('coach-only-view');
  const coach=isCoach();
  button.hidden=!coach;
  button.setAttribute('aria-hidden',coach?'false':'true');
  if(coach){
    if(button.style.getPropertyValue('display')==='none')button.style.removeProperty('display');
    button.removeAttribute('tabindex');
  }else{
    button.style.setProperty('display','none','important');
    button.setAttribute('tabindex','-1');
  }
  if(calendarButton!==button){
    if(calendarButton){
      calendarButton.removeEventListener('click',handleCalendarAdd,true);
      calendarButton.removeEventListener('touchend',handleCalendarAdd,true);
    }
    calendarButton=button;
    button.addEventListener('click',handleCalendarAdd,true);
    button.addEventListener('touchend',handleCalendarAdd,{capture:true,passive:false});
  }
}

function parseLoginDate(value){
  if(!value)return null;
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value;
  const text=String(value).trim();
  if(!text||/nunca|sin acceso|sin inicio|sin cuenta/i.test(text))return null;
  const iso=new Date(text);
  if(!Number.isNaN(iso.getTime()))return iso;
  const match=text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4}).*?(\d{1,2}):(\d{2})/);
  if(!match)return null;
  const local=new Date(Number(match[3]),Number(match[2])-1,Number(match[1]),Number(match[4]),Number(match[5]));
  return Number.isNaN(local.getTime())?null:local;
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
    #view-calendar .gcal-day-cell.is-cvb-selected:not(.other-month){outline:2px solid rgba(217,145,23,.32);outline-offset:-2px;background:rgba(255,247,231,.74)}

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
    if(!span)return;
    const formatted=formatLogin(span.textContent);
    if(span.textContent!==formatted)span.textContent=formatted;
  });
}
async function refreshCoachOwnLogin(){
  if(profileRefreshBusy||!isCoach())return;
  const user=currentUser(),client=db();
  if(!user?.username||!client)return;
  profileRefreshBusy=true;
  try{
    const {data,error}=await client.from('profiles').select('last_login_at').ilike('username',String(user.username)).maybeSingle();
    if(error||!data)return;
    const info=document.getElementById('profile-private-info');
    if(!info)return;
    [...info.children].forEach(item=>{
      const label=String(item.querySelector('label')?.textContent||'');
      if(!/último\s+inicio|última\s+conexión|último\s+acceso/i.test(label))return;
      const span=item.querySelector('span');
      if(!span)return;
      const formatted=formatLogin(data.last_login_at);
      if(span.textContent!==formatted)span.textContent=formatted;
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
  rosterEnhanceQueued=false;
  const view=document.getElementById('view-roster');
  if(!view)return;
  if(!isCoach()){
    view.querySelectorAll('.coach-player-last-login').forEach(node=>node.remove());
    return;
  }
  view.querySelectorAll('.player-trading-card').forEach(card=>{
    const player=playerForCard(card);
    const info=card.querySelector('.trading-card-info');
    if(!player||!info)return;
    const linked=Boolean(player.profile_id||player.profileId);
    const raw=player.lastLoginAt||player.last_login_at||null;
    const text=raw?formatLogin(raw):(linked?'Sin accesos registrados':'Sin cuenta vinculada');
    const signature=`${raw?'1':'0'}|${text}`;
    let row=info.querySelector('.coach-player-last-login');
    if(!row){
      row=document.createElement('div');
      row.className='coach-player-last-login';
      info.appendChild(row);
    }
    row.classList.toggle('is-empty',!raw);
    if(row.dataset.signature!==signature){
      row.dataset.signature=signature;
      row.innerHTML=`<i data-lucide="clock-3"></i><span><strong>Último acceso:</strong> ${text}</span>`;
    }
  });
  try{window.lucide?.createIcons?.();}catch(_){}
}
function queueRosterEnhance(){
  if(rosterEnhanceQueued)return;
  rosterEnhanceQueued=true;
  requestAnimationFrame(enhanceRosterLogins);
}
function wrapRosterRender(){
  const original=window.renderRoster;
  if(typeof original!=='function'||original.__calendarProfileRosterWrapped)return;
  const wrapped=function(){
    const result=original.apply(this,arguments);
    queueRosterEnhance();
    return result;
  };
  wrapped.__calendarProfileRosterWrapped=true;
  window.renderRoster=wrapped;
}

async function persistDorsal(snapshot){
  const client=db();
  if(!client||!snapshot||!Number.isInteger(snapshot.number))return;
  let query=client.from('players').update({dorsal:snapshot.number});
  if(snapshot.supabaseId)query=query.eq('id',snapshot.supabaseId);
  else if(snapshot.profileId)query=query.eq('profile_id',snapshot.profileId);
  else query=query.eq('legacy_id',snapshot.legacyId||snapshot.localId);
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
  if(!form||playerForm===form)return;
  playerForm=form;
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
}

function observeUi(){
  const profileInfo=document.getElementById('profile-private-info');
  if(profileInfo)new MutationObserver(()=>queueMicrotask(polishProfile)).observe(profileInfo,{childList:true});
  const profileModal=document.getElementById('modal-my-profile');
  if(profileModal)new MutationObserver(()=>{if(profileModal.classList.contains('active'))setTimeout(polishProfile,0);}).observe(profileModal,{attributes:true,attributeFilter:['class']});
  const roster=document.getElementById('roster-grid-container');
  if(roster)new MutationObserver(queueRosterEnhance).observe(roster,{childList:true});
}
function syncAll(){
  injectStyles();
  syncCalendarAddButton();
  wrapRosterRender();
  bindPlayerForm();
  polishProfile();
  queueRosterEnhance();
}
function install(){
  injectStyles();
  document.addEventListener('pointerover',markCalendarSelection,true);
  document.addEventListener('click',markCalendarSelection,true);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#btn-my-profile-header,#btn-my-profile-home'))setTimeout(polishProfile,0);
  });
  observeUi();
  syncAll();
  let tries=0;
  const timer=setInterval(()=>{
    syncAll();
    tries+=1;
    if(tries>=30)clearInterval(timer);
  },180);
  window.addEventListener('focus',syncAll);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncAll();});
  console.info('[UXFixes] Calendario, perfil privado, último acceso y dorsal sincronizado activos.');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
