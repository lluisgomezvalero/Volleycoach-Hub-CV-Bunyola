(function(){
'use strict';

const FLAG='__performanceMobilePolish20260823';
if(window[FLAG])return;
window[FLAG]=true;
let raf=0;

function mobileViewport(){
  try{return window.matchMedia('(max-width:760px), (max-width:1366px) and (any-pointer:coarse)').matches;}
  catch(_){return window.innerWidth<=1366;}
}
function view(){return document.getElementById('view-fitness');}
function schedule(){
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(decorate);
}
function replaceRatio(article){
  const value=article?.querySelector('strong');
  if(!value)return;
  const text=(value.textContent||'').trim();
  const match=text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if(match)value.textContent=`${match[1]} de ${match[2]}`;
}
function decorateSummary(root){
  const summary=root.querySelector('#performance-mobile-summary');
  if(!summary)return;
  summary.querySelectorAll('.performance-mobile-kpis article').forEach(article=>{
    const label=(article.querySelector('small')?.textContent||'').trim().toLowerCase();
    if(label==='evaluadas'||label==='jugadoras')replaceRatio(article);
    if(label==='media actual'){
      const hint=article.querySelector('em');
      if(hint&&hint.textContent!=='Último registro por jugadora')hint.textContent='Último registro por jugadora';
    }
  });
}
function decorateCards(root){
  root.querySelectorAll('.performance-result-card.performance-mobile-player-card').forEach(card=>{
    const date=card.querySelector('.performance-result-date');
    const hasRecord=Boolean(date&&!/sin registros/i.test(date.textContent||''));
    card.classList.toggle('performance-polish-has-record',hasRecord);
  });
}
function decorate(){
  if(!mobileViewport())return;
  const root=view();
  if(!root)return;
  decorateSummary(root);
  decorateCards(root);
}
function styles(){
  if(document.getElementById('performance-mobile-polish-20260823-style'))return;
  const style=document.createElement('style');
  style.id='performance-mobile-polish-20260823-style';
  style.textContent=`
@media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
  #view-fitness .performance-results-grid{gap:.42rem!important;margin-top:.65rem!important}
  #view-fitness .performance-result-card.performance-mobile-player-card{grid-template-columns:minmax(0,1fr) minmax(132px,auto)!important;grid-template-areas:"player metrics"!important;padding:.56rem .68rem!important;gap:.2rem .55rem!important}
  #view-fitness .performance-result-card.performance-mobile-player-card.performance-polish-has-record{grid-template-areas:"player metrics" "date metrics"!important}
  #view-fitness .performance-result-player img{width:38px!important;height:38px!important;min-width:38px!important}
  #view-fitness .performance-result-player strong{font-size:.88rem!important}
  #view-fitness .performance-result-metrics>div{padding:.38rem .44rem!important}
  #view-fitness .performance-result-date{display:none!important;margin-left:43px!important}
  #view-fitness .performance-result-card.performance-polish-has-record .performance-result-date{display:flex!important}
}
@media(max-width:420px){
  #view-fitness .performance-result-card.performance-mobile-player-card{grid-template-columns:minmax(0,1fr) minmax(118px,auto)!important;grid-template-areas:"player metrics"!important}
  #view-fitness .performance-result-card.performance-mobile-player-card.performance-polish-has-record{grid-template-areas:"player metrics" "date metrics"!important}
  #view-fitness .performance-result-metrics{margin:0 1rem 0 0!important;grid-template-columns:1fr 1fr!important}
  #view-fitness .performance-result-date{margin-left:43px!important}
}
`;
  document.head.appendChild(style);
}
function install(){
  styles();
  const root=view();
  if(!root){setTimeout(install,80);return;}
  const current=document.getElementById('performance-current-view');
  if(current&&current.dataset.performanceMobilePolishObserved!=='1'){
    current.dataset.performanceMobilePolishObserved='1';
    new MutationObserver(schedule).observe(current,{childList:true,subtree:false});
  }
  if(root.dataset.performanceMobilePolishObserved!=='1'){
    root.dataset.performanceMobilePolishObserved='1';
    new MutationObserver(()=>{if(root.classList.contains('active'))schedule();}).observe(root,{attributes:true,attributeFilter:['class']});
  }
  schedule();
}

window.addEventListener('resize',schedule,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
