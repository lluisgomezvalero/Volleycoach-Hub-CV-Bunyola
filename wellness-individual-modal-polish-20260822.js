(function(){
'use strict';
const FLAG='__wellnessIndividualModalPolish20260822';
if(window[FLAG])return;
window[FLAG]=true;
let syncQueued=false;
let syncing=false;

function ensureStyles(){
  if(document.getElementById('wellness-individual-modal-polish-20260822-style'))return;
  const style=document.createElement('style');
  style.id='wellness-individual-modal-polish-20260822-style';
  style.textContent=`
  @media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
    body.wellness-player-modal-open #mobile-bottom-nav{visibility:hidden!important;opacity:0!important;pointer-events:none!important;transform:translateY(100%)!important}
    .wellness-player-tracking-modal{z-index:2147483000!important}
    .wellness-player-tracking-modal .modal-content{position:relative!important;z-index:1!important}
    .wellness-player-modal-meta{display:flex!important;align-items:center!important;gap:.42rem!important;flex-wrap:wrap!important}
    .wellness-player-status{display:inline-flex!important;align-items:center!important;gap:.22rem!important;padding:.24rem .44rem!important;border-radius:999px!important;font-size:.56rem!important;font-weight:900!important}
    .wellness-player-status::before{content:'●';font-size:.54rem;line-height:1}
    .wellness-player-spark{height:112px!important}
    .wellness-player-spark-head span{font-size:.58rem!important;font-weight:850!important}
    .wellness-spark-date-row{display:flex;justify-content:space-between;gap:.3rem;margin:.18rem .15rem 0;color:#7c8998;font-size:.52rem;font-weight:750}
  }
  `;
  document.head.appendChild(style);
}
function numberFrom(text){
  const match=String(text||'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
  return match?Number(match[0]):null;
}
function prettyTrend(text){
  const raw=String(text||'').trim();
  if(/[↑↓→]/.test(raw))return raw;
  const value=numberFrom(raw);
  if(value==null)return raw||'Sin tendencia';
  if(Math.abs(value)<.25)return'→ estable';
  const shown=Math.abs(value).toFixed(1).replace('.',',');
  return value>0?`↑ ${shown} · aumentando`:`↓ ${shown} · mejorando`;
}
function metricValue(modal,label){
  const cards=[...modal.querySelectorAll('.wellness-player-modal-metric')];
  const card=cards.find(el=>String(el.querySelector('small')?.textContent||'').toLowerCase().includes(label));
  return numberFrom(card?.querySelector('strong')?.textContent);
}
function statusFromModal(modal){
  const fatigue=metricValue(modal,'fatiga');
  const sleep=metricValue(modal,'sueño');
  const discomfort=metricValue(modal,'molest')??metricValue(modal,'dolor');
  if((fatigue!=null&&fatigue>=4)||(sleep!=null&&sleep<=2)||(discomfort!=null&&discomfort>=4))return{label:'Atención',tone:'attn'};
  if((fatigue!=null&&fatigue>=3)||(sleep!=null&&sleep<=3)||(discomfort!=null&&discomfort>=3))return{label:'Vigilar',tone:'warm'};
  if(fatigue!=null||sleep!=null||discomfort!=null)return{label:'Buen estado',tone:'good'};
  return{label:'Sin datos',tone:'neutral'};
}
function ensureStatus(modal){
  const meta=modal.querySelector('.wellness-player-modal-meta');
  if(!meta)return;
  let chip=meta.querySelector('.wellness-player-status');
  const status=statusFromModal(modal);
  if(!chip){
    chip=document.createElement('span');
    chip.className='wellness-player-status';
    meta.appendChild(chip);
  }
  const wanted=`wellness-player-status ${status.tone}`;
  if(chip.className!==wanted)chip.className=wanted;
  if(chip.textContent!==status.label)chip.textContent=status.label;
}
function ensureDates(modal){
  const wrap=modal.querySelector('.wellness-player-spark-wrap');
  if(!wrap||wrap.querySelector('.wellness-spark-date-row'))return;
  const svg=wrap.querySelector('svg');
  if(svg?.querySelector('text'))return;
  const dates=[...modal.querySelectorAll('.wellness-player-record-top strong')].slice(0,4).map(el=>el.textContent.trim()).reverse();
  if(dates.length<2)return;
  const row=document.createElement('div');
  row.className='wellness-spark-date-row';
  row.innerHTML=`<span>${dates[0]}</span><span>${dates[dates.length-1]}</span>`;
  wrap.appendChild(row);
}
function polishModal(modal){
  if(!modal)return;
  if(!document.body.classList.contains('wellness-player-modal-open'))document.body.classList.add('wellness-player-modal-open');
  const trend=modal.querySelector('.wellness-player-spark-head span');
  if(trend){
    const next=prettyTrend(trend.textContent);
    if(trend.textContent!==next)trend.textContent=next;
  }
  ensureStatus(modal);
  ensureDates(modal);
}
function syncNow(){
  if(syncing)return;
  syncing=true;
  try{
    ensureStyles();
    const modal=document.querySelector('.wellness-player-tracking-modal');
    if(modal)polishModal(modal);
    else if(document.body.classList.contains('wellness-player-modal-open'))document.body.classList.remove('wellness-player-modal-open');
  }finally{syncing=false;}
}
function queueSync(){
  if(syncQueued)return;
  syncQueued=true;
  requestAnimationFrame(()=>{syncQueued=false;syncNow();});
}
const observer=new MutationObserver(mutations=>{
  if(syncing)return;
  const relevant=mutations.some(m=>m.type==='childList'&&(
    [...m.addedNodes,...m.removedNodes].some(node=>node.nodeType===1&&(
      node.matches?.('.wellness-player-tracking-modal')||node.querySelector?.('.wellness-player-tracking-modal')||
      node.matches?.('.wellness-player-modal-meta,.wellness-player-spark-wrap')
    ))
  ));
  if(relevant)queueSync();
});
function install(){
  ensureStyles();
  observer.observe(document.body,{childList:true,subtree:true});
  syncNow();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
