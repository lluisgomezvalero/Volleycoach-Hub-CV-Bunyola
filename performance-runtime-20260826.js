(function(){
'use strict';

const FLAG='__volleyPerformanceRuntime20260826';
if(window[FLAG])return;
window[FLAG]=true;

function injectPerformanceCss(){
  if(document.getElementById('volley-performance-runtime-css'))return;
  const style=document.createElement('style');
  style.id='volley-performance-runtime-css';
  style.textContent=`
    @media(max-width:960px), (any-pointer:coarse){
      html,body{
        background:#f8fafc!important;
        background-image:none!important;
        background-attachment:scroll!important;
      }
      body::before,body::after{display:none!important}

      /* Backdrop blur sobre superficies grandes/fijas provoca repintados caros en Android. */
      .app-portal-wrapper *,
      .modal-backdrop *,
      #volley-navigation-shell *,
      #volley-mobile-quick-nav,
      .volley-mobile-bar,
      .volley-side-nav,
      .volley-nav-overlay{
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
      }

      #volley-mobile-quick-nav,
      .volley-mobile-bar,
      .volley-side-nav{background:#fff!important}

      /* Las tarjetas se mantienen visualmente iguales, pero sin animaciones de layout costosas. */
      .dashboard-card,
      .dashboard-summary-card,
      .dashboard-quick-access .island-card,
      .island-card,
      .player-card,
      .player-trading-card,
      .profile-private-card,
      .modal-content,
      .card{
        transition-property:opacity,background-color,border-color,color!important;
        transition-duration:.12s!important;
        will-change:auto!important;
      }

      .dashboard-card:hover,
      .dashboard-summary-card:hover,
      .dashboard-quick-access .island-card:hover,
      .island-card:hover,
      .player-card:hover,
      .player-trading-card:hover{
        transform:none!important;
      }

      .modal-backdrop.active{
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function throttleLucide(){
  const lib=window.lucide;
  if(!lib||typeof lib.createIcons!=='function'||lib.createIcons.__volleyPerfWrapped)return;
  const original=lib.createIcons.bind(lib);
  let timer=0;
  let queued=false;

  function flush(){
    timer=0;
    if(!queued)return;
    queued=false;
    if(document.hidden)return;
    try{original();}catch(error){console.warn('[VolleyPerf] lucide refresh',error);}
  }

  function wrappedCreateIcons(){
    queued=true;
    if(timer)return;
    timer=window.setTimeout(flush,40);
  }
  wrappedCreateIcons.__volleyPerfWrapped=true;
  wrappedCreateIcons.__volleyPerfOriginal=original;
  lib.createIcons=wrappedCreateIcons;

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){queued=true;if(!timer)timer=window.setTimeout(flush,0);}
  });
}

function markRuntime(){
  document.documentElement.classList.add('volley-performance-runtime');
  window.VolleyPerf=Object.freeze({
    version:'20260826perf1',
    coarse:window.matchMedia?.('(any-pointer:coarse)')?.matches||false
  });
}

injectPerformanceCss();
throttleLucide();
markRuntime();
})();
