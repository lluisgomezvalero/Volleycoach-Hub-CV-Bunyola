(function(){
'use strict';

const FLAG='__performanceModuleRenderFix20260823';
if(window[FLAG])return;
window[FLAG]=true;

function getView(){return document.getElementById('view-fitness');}
function getPanel(){return document.getElementById('training-performance-panel');}
function keepPanelVisible(){
  const view=getView();
  const panel=getPanel();
  if(!view||!panel||!view.classList.contains('active'))return;
  if(panel.hidden)panel.hidden=false;
}
function loadMobilePerformanceUx(){
  if(window.__performanceMobileUx20260823)return;
  if(document.querySelector('script[src^="performance-mobile-ux-20260823.js"]'))return;
  const script=document.createElement('script');
  script.src='performance-mobile-ux-20260823.js?v=20260823a';
  script.async=false;
  document.head.appendChild(script);
}
function installVisibilityGuard(){
  const panel=getPanel();
  const view=getView();
  if(!panel||!view)return;
  if(panel.dataset.performanceVisibilityGuard!=='1'){
    panel.dataset.performanceVisibilityGuard='1';
    new MutationObserver(()=>keepPanelVisible()).observe(panel,{attributes:true,attributeFilter:['hidden']});
  }
  if(view.dataset.performanceVisibilityGuard!=='1'){
    view.dataset.performanceVisibilityGuard='1';
    new MutationObserver(()=>{
      if(view.classList.contains('active')){
        keepPanelVisible();
        requestAnimationFrame(()=>{try{window.renderPerformanceModule();}catch(_){}});
      }
    }).observe(view,{attributes:true,attributeFilter:['class']});
  }
  keepPanelVisible();
}

function install(attempt=0){
  loadMobilePerformanceUx();
  if(typeof window.openModule!=='function'||typeof window.renderPerformanceModule!=='function'){
    if(attempt<160)setTimeout(()=>install(attempt+1),50);
    return;
  }
  installVisibilityGuard();
  if(window.openModule.__performanceRenderFixed)return;
  const base=window.openModule;
  const wrapped=function(moduleName){
    const result=base.apply(this,arguments);
    if(moduleName==='fitness'){
      requestAnimationFrame(()=>{
        try{
          installVisibilityGuard();
          keepPanelVisible();
          window.renderPerformanceModule();
        }
        catch(error){console.error('[VolleyCoach] No se pudo renderizar Rendimiento:',error);}
      });
    }
    return result;
  };
  wrapped.__performanceRenderFixed=true;
  wrapped.__baseOpenModule=base;
  window.openModule=wrapped;

  const view=getView();
  if(view?.classList.contains('active')){
    requestAnimationFrame(()=>{
      try{keepPanelVisible();window.renderPerformanceModule();}catch(_){}
    });
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});
else install();
})();
