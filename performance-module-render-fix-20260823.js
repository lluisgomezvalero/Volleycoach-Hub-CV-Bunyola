(function(){
'use strict';

const FLAG='__performanceModuleRenderFix20260823';
if(window[FLAG])return;
window[FLAG]=true;

function install(attempt=0){
  if(typeof window.openModule!=='function'||typeof window.renderPerformanceModule!=='function'){
    if(attempt<160)setTimeout(()=>install(attempt+1),50);
    return;
  }
  if(window.openModule.__performanceRenderFixed)return;
  const base=window.openModule;
  const wrapped=function(moduleName){
    const result=base.apply(this,arguments);
    if(moduleName==='fitness'){
      requestAnimationFrame(()=>{
        try{
          const panel=document.getElementById('training-performance-panel');
          if(panel)panel.hidden=false;
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

  const view=document.getElementById('view-fitness');
  if(view?.classList.contains('active')){
    requestAnimationFrame(()=>{
      try{window.renderPerformanceModule();}catch(_){}
    });
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});
else install();
})();
