(function(){
'use strict';

const FLAG='__wellnessSvgPointTooltip20260823';
if(window[FLAG])return;
window[FLAG]=true;

let hideTimer=null;
let observer=null;
let scheduled=false;

function mobileViewport(){
  try{return window.matchMedia('(max-width:760px), (max-width:1366px) and (any-pointer:coarse)').matches;}
  catch(_){return window.innerWidth<=1366;}
}
function view(){return document.getElementById('view-wellness');}
function shortDate(raw){
  const m=String(raw||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return raw||'';
  const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12);
  return new Intl.DateTimeFormat(window.VolleyI18n?.locale?.() || 'es-ES',{day:'numeric',month:'short'}).format(d).replace(/\./g,'');
}
function ensureStyles(){
  if(document.getElementById('wellness-svg-point-tooltip-20260823-style'))return;
  const style=document.createElement('style');
  style.id='wellness-svg-point-tooltip-20260823-style';
  style.textContent=`
    .wellness-svg-point-tooltip{position:fixed;z-index:2147483000;max-width:min(260px,calc(100vw - 20px));padding:.52rem .62rem;border:1px solid rgba(15,23,42,.12);border-radius:12px;background:rgba(30,41,59,.96);color:#fff;box-shadow:0 10px 28px rgba(15,23,42,.22);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .wellness-svg-point-tooltip.is-visible{opacity:1;transform:translateY(0)}
    .wellness-svg-point-tooltip strong{display:block;font-size:.72rem;line-height:1.2}
    .wellness-svg-point-tooltip span{display:block;margin-top:.14rem;color:#dbe4ee;font-size:.58rem;line-height:1.35}
    @media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
      #view-wellness .wellness-svg-chart circle{cursor:pointer;touch-action:manipulation;outline:none}
      #view-wellness .wellness-svg-chart circle:focus{stroke:#253044!important;stroke-width:2.6!important}
    }
  `;
  document.head.appendChild(style);
}
function tooltip(){
  let node=document.getElementById('wellness-svg-point-tooltip-20260823');
  if(node)return node;
  node=document.createElement('div');
  node.id='wellness-svg-point-tooltip-20260823';
  node.className='wellness-svg-point-tooltip';
  node.setAttribute('role','status');
  node.setAttribute('aria-live','polite');
  document.body.appendChild(node);
  return node;
}
function hide(){
  clearTimeout(hideTimer);
  const node=document.getElementById('wellness-svg-point-tooltip-20260823');
  node?.classList.remove('is-visible');
}
function parseTitle(text){
  const parts=String(text||'').split(' · ').map(x=>x.trim()).filter(Boolean);
  return{name:parts[0]||'Jugadora',fatigue:parts[1]||'',date:shortDate(parts[2]||'')};
}
function show(circle){
  const text=circle?.querySelector('title')?.textContent?.trim();
  if(!text)return;
  const data=parseTitle(text);
  const node=tooltip();
  node.replaceChildren();
  const strong=document.createElement('strong');strong.textContent=data.name;
  const span=document.createElement('span');span.textContent=[data.fatigue?`Fatiga ${data.fatigue}`:'',data.date].filter(Boolean).join(' · ');
  node.append(strong,span);
  node.style.left='8px';node.style.top='8px';node.classList.add('is-visible');
  const point=circle.getBoundingClientRect();
  const box=node.getBoundingClientRect();
  let left=point.left+point.width/2-box.width/2;
  left=Math.max(8,Math.min(window.innerWidth-box.width-8,left));
  let top=point.top-box.height-10;
  if(top<8)top=Math.min(window.innerHeight-box.height-8,point.bottom+10);
  node.style.left=`${Math.round(left)}px`;
  node.style.top=`${Math.round(top)}px`;
  clearTimeout(hideTimer);
  hideTimer=setTimeout(hide,3200);
}
function bindSvg(svg){
  if(!svg||svg.dataset.playerTooltipBound==='1')return;
  svg.dataset.playerTooltipBound='1';
  svg.querySelectorAll('circle').forEach(circle=>{
    const title=circle.querySelector('title')?.textContent?.trim();
    if(!title)return;
    circle.setAttribute('tabindex','0');
    circle.setAttribute('role','button');
    circle.setAttribute('aria-label',title);
  });
  svg.addEventListener('click',event=>{
    const circle=event.target.closest?.('circle');
    if(circle&&svg.contains(circle))show(circle);
  });
  svg.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const circle=event.target.closest?.('circle');
    if(!circle||!svg.contains(circle))return;
    event.preventDefault();show(circle);
  });
}
function refresh(){
  if(!mobileViewport())return;
  const root=view();if(!root)return;
  ensureStyles();
  root.querySelectorAll('.wellness-svg-chart').forEach(bindSvg);
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;refresh();});
}
function install(attempt=0){
  const root=view();
  if(!root){if(attempt<120)setTimeout(()=>install(attempt+1),50);return;}
  refresh();
  if(!observer){
    observer=new MutationObserver(mutations=>{
      if(!mutations.some(m=>m.type==='childList'&&(m.addedNodes.length||m.removedNodes.length)))return;
      schedule();
    });
    observer.observe(root,{childList:true,subtree:true});
  }
}

document.addEventListener('pointerdown',event=>{
  const tip=document.getElementById('wellness-svg-point-tooltip-20260823');
  if(!tip?.classList.contains('is-visible'))return;
  if(event.target.closest?.('.wellness-svg-chart circle'))return;
  hide();
},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();else schedule();});
window.addEventListener('resize',hide,{passive:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});
else install();
})();
