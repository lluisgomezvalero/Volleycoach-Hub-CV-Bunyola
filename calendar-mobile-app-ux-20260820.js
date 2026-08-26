(function(){
'use strict';

const FLAG='__calendarMobileAppUx20260820';
if(window[FLAG])return;
window[FLAG]=true;

let selectedDateKey='';

function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function cleanTitle(value){return String(value||'').replace(/^[\s🏋️🏐🏆🎂]+/u,'').trim();}
function dateObj(value){const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?null:d;}
function dateKey(year,month,day){return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function localTodayKey(){const d=new Date();return dateKey(d.getFullYear(),d.getMonth(),d.getDate());}
function typeMeta(evt){
  if(evt?.isBirthday)return {key:'birthday',label:'Cumpleaños',icon:'cake'};
  if(evt?.type==='Torneo')return {key:'tournament',label:'Torneo',icon:'trophy'};
  if(evt?.type==='Amistoso')return {key:'friendly',label:'Amistoso',icon:'shield'};
  if(evt?.type==='Partido')return {key:'league',label:'Liga',icon:'trophy'};
  return {key:'training',label:'Entreno',icon:'dumbbell'};
}
function monthEvents(){
  try{
    if(typeof getCalendarEventsForMonth==='function')return [...getCalendarEventsForMonth(currentCalendarYear,currentCalendarMonth)];
  }catch(_){}
  try{
    return (appState?.events||[]).filter(evt=>{
      const d=dateObj(evt.date);return d&&d.getFullYear()===currentCalendarYear&&d.getMonth()===currentCalendarMonth;
    });
  }catch(_){return [];}
}
function ownLogo(){
  try{
    const info=appState?.teamInfo||{};
    if(info.customLogo)return info.customLogo;
    if(info.logo)return info.logo;
    const own=(appState?.leagueTable||[]).find(team=>String(team?.name||'').toLowerCase().includes('bunyola'));
    if(own?.logo)return own.logo;
  }catch(_){}
  return 'assets/club_logo.png';
}
function matchLogos(evt){
  try{if(typeof getMatchLogosData==='function')return getMatchLogosData(evt);}catch(_){}
  return null;
}
function eventVisual(evt,meta){
  if(['league','friendly'].includes(meta.key)){
    const logos=matchLogos(evt);
    const first=logos?.team1?.logo||ownLogo();
    const second=logos?.team2?.logo||'assets/default_avatar.svg';
    return `<div class="cal-app-visual cal-app-match-visual"><img src="${esc(first)}" alt=""><span>VS</span><img src="${esc(second)}" alt=""></div>`;
  }
  if(meta.key==='training'||meta.key==='tournament'){
    return `<div class="cal-app-visual cal-app-club-visual"><img src="${esc(ownLogo())}" alt="CV Bunyola"></div>`;
  }
  return `<div class="cal-app-visual cal-app-icon"><i data-lucide="${meta.icon}"></i></div>`;
}
function renderEvent(evt){
  const meta=typeMeta(evt);
  const card=document.createElement(evt.isBirthday?'div':'button');
  if(!evt.isBirthday)card.type='button';
  card.className=`cal-app-event is-${meta.key}`;
  if(evt.id)card.dataset.eventId=String(evt.id);
  const title=cleanTitle(evt.title)||(meta.key==='training'?'Entrenamiento':meta.label);
  const location=String(evt.location||'').trim();
  const time=evt.isBirthday?'Todo el día':String(evt.time||'').trim();
  const tournamentCount=meta.key==='tournament'&&Array.isArray(evt.tournamentMatches)?`${evt.tournamentMatches.length} partidos`:'';
  card.innerHTML=`
    ${eventVisual(evt,meta)}
    <div class="cal-app-event-copy">
      <div class="cal-app-event-top"><span class="cal-app-kind">${esc(meta.label)}</span>${time?`<span class="cal-app-time">${esc(time)}</span>`:''}</div>
      <strong>${esc(title)}</strong>
      ${tournamentCount?`<small>${esc(tournamentCount)}</small>`:''}
      ${location?`<small><i data-lucide="map-pin"></i>${esc(location)}</small>`:''}
    </div>
    ${evt.isBirthday?'':'<i data-lucide="chevron-right" class="cal-app-arrow"></i>'}`;
  if(!evt.isBirthday)card.addEventListener('click',()=>{try{openSeasonEvent(evt.id);}catch(_){}});
  return card;
}
function chooseDate(events){
  const prefix=`${currentCalendarYear}-${String(currentCalendarMonth+1).padStart(2,'0')}-`;
  if(selectedDateKey.startsWith(prefix))return selectedDateKey;
  const today=localTodayKey();
  const eventDays=[...new Set(events.map(evt=>String(evt.date||'')).filter(Boolean))].sort();
  if(today.startsWith(prefix)){
    if(eventDays.includes(today))return today;
    const next=eventDays.find(key=>key>today);
    if(next)return next;
    const previous=[...eventDays].reverse().find(key=>key<today);
    if(previous)return previous;
    return today;
  }
  return eventDays[0]||dateKey(currentCalendarYear,currentCalendarMonth,1);
}
function renderMonthGrid(events){
  const eventMap=new Map();
  events.forEach(evt=>{const key=String(evt.date||'');if(!key)return;if(!eventMap.has(key))eventMap.set(key,[]);eventMap.get(key).push(evt);});
  selectedDateKey=chooseDate(events);
  const first=new Date(currentCalendarYear,currentCalendarMonth,1,12);
  const days=new Date(currentCalendarYear,currentCalendarMonth+1,0,12).getDate();
  const offset=(first.getDay()+6)%7;
  const total=Math.ceil((offset+days)/7)*7;
  const today=localTodayKey();
  const wrap=document.createElement('section');
  wrap.className='cal-month-card';
  wrap.innerHTML=`<div class="cal-month-weekdays"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="cal-month-days"></div>`;
  const grid=wrap.querySelector('.cal-month-days');
  for(let cell=0;cell<total;cell++){
    const day=cell-offset+1;
    if(day<1||day>days){const empty=document.createElement('span');empty.className='cal-month-empty-day';grid.appendChild(empty);continue;}
    const key=dateKey(currentCalendarYear,currentCalendarMonth,day);
    const items=eventMap.get(key)||[];
    const button=document.createElement('button');
    button.type='button';
    button.className='cal-month-day';
    if(key===selectedDateKey)button.classList.add('is-selected');
    if(key===today)button.classList.add('is-today');
    if(items.length)button.classList.add('has-events');
    const dotTypes=[...new Set(items.map(item=>typeMeta(item).key))].slice(0,3);
    button.innerHTML=`<span class="cal-month-day-number">${day}</span><span class="cal-month-dots">${dotTypes.map(type=>`<i class="dot-${type}"></i>`).join('')}</span>`;
    button.setAttribute('aria-label',`${day} de ${new Intl.DateTimeFormat('es-ES',{month:'long'}).format(first)}${items.length?`, ${items.length} eventos`:''}`);
    button.addEventListener('click',()=>{selectedDateKey=key;renderCalendarMobile();});
    grid.appendChild(button);
  }
  return wrap;
}
function renderSelectedAgenda(events){
  const section=document.createElement('section');
  section.className='cal-selected-agenda';
  const selected=dateObj(selectedDateKey);
  const items=events.filter(evt=>String(evt.date||'')===selectedDateKey).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
  const dateText=selected?new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(selected):'';
  section.innerHTML=`<header class="cal-selected-head"><div><span>Agenda</span><strong>${esc(dateText)}</strong></div><small>${items.length} ${items.length===1?'evento':'eventos'}</small></header><div class="cal-selected-events"></div>`;
  const list=section.querySelector('.cal-selected-events');
  if(items.length)items.forEach(evt=>list.appendChild(renderEvent(evt)));
  else list.innerHTML=`<div class="cal-app-empty is-day-empty"><i data-lucide="calendar-check"></i><strong>Sin eventos este día</strong><span>Pulsa otro día del calendario para consultar su agenda.</span></div>`;
  return section;
}
function renderCalendarMobile(){
  const container=document.getElementById('gcal-agenda-view');
  if(!container)return;
  const events=monthEvents().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.time||'').localeCompare(String(b.time||'')));
  container.className='gcal-agenda-view cal-app-agenda';
  container.innerHTML='';
  container.appendChild(renderMonthGrid(events));
  container.appendChild(renderSelectedAgenda(events));
  if(window.lucide)window.lucide.createIcons();
}
function polishToolbar(){
  const add=document.getElementById('btn-add-event');
  if(add){add.setAttribute('aria-label','Añadir evento');add.title='Añadir evento';}
}
function ensureStyles(){
  if(document.getElementById('calendar-mobile-app-ux-20260820-style'))return;
  const style=document.createElement('style');
  style.id='calendar-mobile-app-ux-20260820-style';
  style.textContent=`
    @media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
      #view-calendar .gcal-toolbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:.55rem!important;margin-bottom:.75rem!important;padding:0!important}
      #view-calendar .gcal-toolbar-left{display:grid!important;grid-template-columns:auto auto auto minmax(0,1fr)!important;align-items:center!important;gap:.3rem!important;min-width:0!important}
      #view-calendar .gcal-toolbar-right{display:flex!important;align-items:center!important;justify-content:center!important}
      #view-calendar #gcal-select-month{display:none!important}
      #view-calendar #gcal-btn-today{height:38px!important;min-width:52px!important;padding:0 .68rem!important;border-radius:11px!important;font-size:.7rem!important;font-weight:800!important}
      #view-calendar #gcal-btn-prev,#view-calendar #gcal-btn-next{width:38px!important;height:38px!important;min-width:38px!important;padding:0!important;border-radius:11px!important;display:grid!important;place-items:center!important}
      #view-calendar #gcal-month-title{min-width:0!important;margin:0 .12rem!important;font-size:1.02rem!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #view-calendar #btn-add-event{width:40px!important;height:40px!important;min-width:40px!important;max-width:40px!important;padding:0!important;margin:0!important;border-radius:12px!important;font-size:0!important;display:grid!important;place-items:center!important;box-shadow:none!important}
      #view-calendar #btn-add-event svg{width:18px!important;height:18px!important;margin:0!important}
      #view-calendar .gcal-weekdays-header,#view-calendar .gcal-month-grid{display:none!important}
      #view-calendar #gcal-agenda-view.cal-app-agenda{display:flex!important;flex-direction:column!important;gap:.78rem!important;padding:0 0 calc(90px + env(safe-area-inset-bottom))!important}
      #view-calendar .cal-month-card{padding:.72rem .72rem .62rem!important;border:1px solid #e4e9ef!important;border-radius:17px!important;background:rgba(255,255,255,.96)!important;box-shadow:0 5px 18px rgba(15,23,42,.035)!important}
      #view-calendar .cal-month-weekdays,#view-calendar .cal-month-days{display:grid!important;grid-template-columns:repeat(7,1fr)!important;gap:.18rem!important}
      #view-calendar .cal-month-weekdays{margin-bottom:.22rem!important}
      #view-calendar .cal-month-weekdays span{display:grid!important;place-items:center!important;height:24px!important;color:#8e99a8!important;font-size:.56rem!important;font-weight:850!important;text-transform:uppercase!important}
      #view-calendar .cal-month-day,#view-calendar .cal-month-empty-day{min-width:0!important;aspect-ratio:1/1!important}
      #view-calendar .cal-month-day{appearance:none!important;position:relative!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:.12rem!important;padding:0!important;border:0!important;border-radius:11px!important;background:transparent!important;color:#263247!important;font:inherit!important}
      #view-calendar .cal-month-day-number{display:grid!important;place-items:center!important;width:27px!important;height:27px!important;border-radius:50%!important;font-family:var(--font-heading)!important;font-size:.7rem!important;font-weight:800!important}
      #view-calendar .cal-month-day.is-today:not(.is-selected) .cal-month-day-number{box-shadow:inset 0 0 0 1.5px #d89b2b!important;color:#9a6510!important}
      #view-calendar .cal-month-day.is-selected{background:#fff7e7!important}
      #view-calendar .cal-month-day.is-selected .cal-month-day-number{background:#d99117!important;color:#fff!important}
      #view-calendar .cal-month-dots{display:flex!important;align-items:center!important;justify-content:center!important;gap:2px!important;height:5px!important}
      #view-calendar .cal-month-dots i{display:block!important;width:4px!important;height:4px!important;border-radius:50%!important}
      #view-calendar .dot-training{background:#6ea5c9!important}.dot-league{background:#d0a03c!important}.dot-friendly{background:#8e9bab!important}.dot-tournament{background:#a97d35!important}.dot-birthday{background:#bc87a8!important}
      #view-calendar .cal-selected-agenda{display:block!important}
      #view-calendar .cal-selected-head{display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:.75rem!important;padding:0 .15rem .08rem!important}
      #view-calendar .cal-selected-head>div{min-width:0!important}
      #view-calendar .cal-selected-head span{display:block!important;margin-bottom:.08rem!important;color:#a0a9b5!important;font-size:.5rem!important;font-weight:850!important;text-transform:uppercase!important;letter-spacing:.055em!important}
      #view-calendar .cal-selected-head strong{display:block!important;text-transform:capitalize!important;color:#1d293a!important;font-family:var(--font-heading)!important;font-size:.88rem!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #view-calendar .cal-selected-head small{flex:0 0 auto!important;color:#8d98a7!important;font-size:.56rem!important;font-weight:750!important}
      #view-calendar .cal-selected-events{display:flex!important;flex-direction:column!important;gap:.42rem!important;margin-top:.4rem!important}
      #view-calendar .cal-app-event{appearance:none!important;width:100%!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;gap:.7rem!important;padding:.72rem .74rem!important;min-height:68px!important;border:1px solid #e5eaf0!important;border-left-width:3px!important;border-radius:15px!important;background:rgba(255,255,255,.98)!important;text-align:left!important;color:inherit!important;box-shadow:0 4px 14px rgba(15,23,42,.03)!important;font:inherit!important}
      #view-calendar .cal-app-event.is-training{border-left-color:#72a7ca!important}.cal-app-event.is-league{border-left-color:#d4a23d!important}.cal-app-event.is-friendly{border-left-color:#8f9cac!important}.cal-app-event.is-tournament{border-left-color:#a9803d!important}.cal-app-event.is-birthday{border-left-color:#bd8fab!important}
      #view-calendar .cal-app-visual{width:46px!important;height:46px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid #e9edf2!important;border-radius:12px!important;background:#fff!important;overflow:hidden!important}
      #view-calendar .cal-app-club-visual img{width:39px!important;height:39px!important;object-fit:contain!important}
      #view-calendar .cal-app-icon svg{width:19px!important;height:19px!important;color:#6d7b8d!important}
      #view-calendar .cal-app-match-visual{width:78px!important;gap:3px!important;padding:3px!important}
      #view-calendar .cal-app-match-visual img{width:29px!important;height:29px!important;object-fit:contain!important}
      #view-calendar .cal-app-match-visual span{font-size:.43rem!important;font-weight:850!important;color:#9ba5b2!important}
      #view-calendar .cal-app-event-copy{min-width:0!important}
      #view-calendar .cal-app-event-top{display:flex!important;align-items:center!important;gap:.42rem!important;margin-bottom:.15rem!important}
      #view-calendar .cal-app-kind{display:inline-flex!important;align-items:center!important;min-height:19px!important;padding:.15rem .34rem!important;border-radius:6px!important;background:#f4f6f8!important;color:#6f7b8a!important;font-size:.49rem!important;font-weight:850!important;text-transform:uppercase!important;letter-spacing:.02em!important}
      #view-calendar .is-league .cal-app-kind{background:#fff6dc!important;color:#946513!important}.is-training .cal-app-kind{background:#edf6fb!important;color:#527c9a!important}.is-friendly .cal-app-kind{background:#f1f5f9!important;color:#64748b!important}.is-tournament .cal-app-kind{background:#fbf1dd!important;color:#866225!important}
      #view-calendar .cal-app-time{font-size:.57rem!important;font-weight:760!important;color:#8793a3!important;font-variant-numeric:tabular-nums!important}
      #view-calendar .cal-app-event-copy>strong{display:block!important;min-width:0!important;font-family:var(--font-heading)!important;font-size:.82rem!important;line-height:1.12!important;color:#1f2a3a!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #view-calendar .cal-app-event-copy>small{display:flex!important;align-items:center!important;gap:.22rem!important;min-width:0!important;margin-top:.16rem!important;font-size:.57rem!important;color:#8793a3!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #view-calendar .cal-app-event-copy>small svg{width:10px!important;height:10px!important;flex:0 0 10px!important}
      #view-calendar .cal-app-arrow{width:16px!important;height:16px!important;color:#a1acb8!important}
      #view-calendar .cal-app-empty{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:.3rem!important;min-height:120px!important;padding:1rem!important;border:1px dashed #dce3ea!important;border-radius:15px!important;background:rgba(255,255,255,.7)!important;text-align:center!important;color:#8490a0!important}
      #view-calendar .cal-app-empty.is-day-empty{min-height:104px!important}
      #view-calendar .cal-app-empty svg{width:21px!important;height:21px!important}.cal-app-empty strong{font-size:.75rem!important;color:#465366!important}.cal-app-empty span{max-width:250px!important;font-size:.58rem!important;line-height:1.35!important}
    }
  `;
  document.head.appendChild(style);
}
function wrapRender(){
  const current=window.renderGoogleCalendar;
  if(typeof current!=='function'||current.__calendarMobileAppUx20260820)return;
  const wrapped=function(){const out=current.apply(this,arguments);try{renderCalendarMobile();polishToolbar();}catch(error){console.warn('[Calendar UX]',error);}return out;};
  wrapped.__calendarMobileAppUx20260820=true;
  window.renderGoogleCalendar=wrapped;
  try{renderGoogleCalendar=wrapped;}catch(_){}
}
function install(){ensureStyles();wrapRender();polishToolbar();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();