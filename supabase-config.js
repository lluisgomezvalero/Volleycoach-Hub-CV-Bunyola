/**
 * Configuración pública de Supabase.
 * La publishable key es segura en el navegador SIEMPRE que las tablas tengan RLS.
 * Nunca pongas aquí la service_role ni una secret key.
 */
window.VOLLEY_ASSET_VERSION = '20260826perf2';
window.VOLLEY_SUPABASE_CONFIG = Object.freeze({
  url: 'https://zpvlkdjdfnvamfcjihyt.supabase.co',
  publishableKey: 'sb_publishable_seL2H6gAGBrUDR0O1vhJDA_Y9d7Ky-u',
  enabled: true,
  authMode: 'supabase',
  syncMode: 'off',
  usernameDomain: 'cvbunyola.app',
  clubId: 'b0000000-0000-4000-8000-000000000001'
});

/* Performance runtime: reduce GPU repaint cost and coalesce repeated Lucide scans. */
(function installVolleyPerformanceRuntime(){
  if(window.__volleyPerformanceRuntime20260826)return;
  window.__volleyPerformanceRuntime20260826=true;

  if(!document.getElementById('volley-performance-runtime-css')){
    const style=document.createElement('style');
    style.id='volley-performance-runtime-css';
    style.textContent=`
@media(max-width:960px), (any-pointer:coarse){
  html,body{background:#f8fafc!important;background-image:none!important;background-attachment:scroll!important}
  body::before,body::after{display:none!important}
  .app-portal-wrapper *,
  .modal-backdrop *,
  #volley-navigation-shell *,
  #volley-mobile-quick-nav,
  .volley-mobile-bar,
  .volley-side-nav,
  .volley-nav-overlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
  #volley-mobile-quick-nav,.volley-mobile-bar,.volley-side-nav{background:#fff!important}
  .dashboard-card,.dashboard-summary-card,.dashboard-quick-access .island-card,.island-card,.player-card,.player-trading-card,.profile-private-card,.modal-content,.card{
    transition-property:opacity,background-color,border-color,color!important;
    transition-duration:.12s!important;
    will-change:auto!important
  }
  .dashboard-card:hover,.dashboard-summary-card:hover,.dashboard-quick-access .island-card:hover,.island-card:hover,.player-card:hover,.player-trading-card:hover{transform:none!important}
  .modal-backdrop.active{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
}`;
    document.head.appendChild(style);
  }

  const lib=window.lucide;
  if(lib&&typeof lib.createIcons==='function'&&!lib.createIcons.__volleyPerfWrapped){
    const original=lib.createIcons.bind(lib);
    let timer=0;
    let queued=false;
    const flush=()=>{
      timer=0;
      if(!queued||document.hidden)return;
      queued=false;
      try{original();}catch(error){console.warn('[VolleyPerf] lucide refresh',error);}
    };
    const wrapped=()=>{
      queued=true;
      if(!timer)timer=window.setTimeout(flush,40);
    };
    wrapped.__volleyPerfWrapped=true;
    lib.createIcons=wrapped;
  }
})();

(function primeAttendanceLoadingState(){document.documentElement.classList.remove('attendance-ready');if(!document.getElementById('attendance-preload-css')){const style=document.createElement('style');style.id='attendance-preload-css';style.textContent=`
html:not(.attendance-ready) button[onclick*="confirmTrainingAttendance"],
html:not(.attendance-ready) .btn-rsvp-yes,
html:not(.attendance-ready) .btn-rsvp-no{visibility:hidden!important;pointer-events:none!important}
`;document.head.appendChild(style);}})();
(function primeWellnessUnifiedState(){document.documentElement.classList.add('wellness-unified-ready');})();

/*
 * Antes se lanzaban todos los parches mientras aún se estaban descargando app.js,
 * Supabase y los datos. Eso provocaba decenas de retries/MutationObservers a la vez.
 * Ahora esperan a que el DOM y app.js estén listos y se inicializan en lotes pequeños.
 */
(function loadVolleySyncPatches(){const scripts=[
  'wellness-v2-20260811.js?v=20260811n',
  'wellness-unified-mobile-20260820.js?v=20260821b',
  'wellness-svg-chart-20260822.js?v=20260822a',
  'wellness-svg-point-tooltip-20260823.js?v=20260823b',
  'wellness-rpe-session-detail-20260822.js?v=20260822a',
  'attendance-fix.js?v=20260810n',
  'app-corrections-20260809.js?v=20260822b',
  'wellness-authoritative-clean-20260824.js?v=20260824b',
  'wellness-individual-tracking-20260822.js?v=20260822b',
  'wellness-individual-modal-polish-20260822.js?v=20260824freeze1',
  'app-corrections-live.js?v=20260810n',
  'hotfix-20260809c.js?v=20260810n',
  'supabase-event-recovery.js?v=20260812f',
  'supabase-roster-sync.js?v=20260812f',
  'player-avatar-authoritative-20260812.js?v=20260812x',
  'roster-card-priority-20260813.js?v=20260813a',
  'roster-mobile-cleanup-20260813.js?v=20260813b',
  'attendance-authoritative-20260809.js?v=20260812f',
  'training-duration-authoritative-20260809.js?v=20260810n',
  'training-load-engine-20260809.js?v=20260811b',
  'training-load-player-dashboard-20260809.js?v=20260811l',
  'training-load-team-dashboard-20260809.js?v=20260811h',
  'attendance-transition-guard-20260809.js?v=20260810n',
  'roll-call-form-clean-20260810.js?v=20260810n',
  'roll-call-mobile-ui-20260810.js?v=20260810n',
  'roll-call-effective-minutes-20260811.js?v=20260812f',
  'attendance-late-count-20260811.js?v=20260812f',
  'team-attendance-overview-20260812.js?v=20260823a',
  'training-attendance-mobile-ux-20260820.js?v=20260820tablet1',
  'training-mobile-app-ux-20260820.js?v=20260820tablet1',
  'training-top-add-hide-20260820.js?v=20260820a',
  'training-session-detail-ux-20260820.js?v=20260820tablet1',
  'training-session-header-fix-20260820.js?v=20260820tablet1',
  'rpe-authoritative-20260810.js?v=20260812i',
  'rpe-pending-overview-authoritative-20260810.js?v=20260810p',
  'coach-training-windows-20260810.js?v=20260812f',
  'coach-dashboard-compact-summary-20260810.js?v=20260812f',
  'dashboard-ux-20260811.js?v=20260811j',
  'dashboard-home-priority-20260812.js?v=20260812o',
  'player-dashboard-priority-20260812.js?v=20260812r',
  'navigation-shell-20260812.js?v=20260812k',
  'performance-module-render-fix-20260823.js?v=20260823d',
  'performance-mobile-ux-20260823.js?v=20260823a',
  'performance-mobile-polish-20260823.js?v=20260823a',
  'player-detail-global-dismiss-20260820.js?v=20260820a',
  'session-header-actions-fix-20260812.js?v=20260812c',
  'app-shell-polish-20260812.js?v=20260812w',
  'sidebar-viewport-stability-20260812.js?v=20260812y',
  'mobile-menu-greeting-20260813.js?v=20260813c',
  'player-passport-priority-20260813.js?v=20260813d',
  'tablet-player-passport-fit-20260820.js?v=20260820a',
  'player-wellness-summary-20260813.js?v=20260813e',
  'player-passport-remove-commitment-20260813.js?v=20260813f',
  'roster-context-layout-20260813.js?v=20260813g',
  'roster-mobile-app-ux-20260820.js?v=20260820tablet1',
  'global-context-shell-20260813.js?v=20260813p',
  'mobile-modal-balance-20260813.js?v=20260813p',
  'modal-surface-clarity-20260813.js?v=20260813j',
  'responsive-layout-polish-20260813.js?v=20260813n',
  'match-attendance-mobile-opponent-fix-20260813.js?v=20260813p',
  'match-callup-20260813.js?v=20260813s',
  'match-callup-player-view-20260813.js?v=20260813q',
  'match-callup-card-status-20260814.js?v=20260814b',
  'match-opponent-persistence-20260814.js?v=20260814p',
  'match-opponent-legacy-repair-20260814.js?v=20260814p',
  'match-result-persistence-20260819.js?v=20260819e',
  'league-standings-authoritative-20260819.js?v=20260819a',
  'competition-app-ux-20260820.js?v=20260820tablet1',
  'competition-admin-reset-guard-20260820.js?v=20260820b',
  'competition-team-editor-ux-20260820.js?v=20260820tablet1',
  'competition-logo-display-sync-20260820.js?v=20260820b',
  'calendar-mobile-app-ux-20260820.js?v=20260820tablet1',
  'calendar-toolbar-polish-20260820.js?v=20260820tablet1',
  'calendar-add-button-polish-20260820.js?v=20260820tablet1',
  'calendar-profile-roster-fixes-20260825.js?v=20260826stability1',
  'match-statistics-authoritative-20260817.js?v=20260818b',
  'match-statistics-priority-ux-20260818.js?v=20260820tablet1',
  'match-statistics-form-ux-20260818.js?v=20260820tablet1',
  'match-statistics-extended-fields-20260818.js?v=20260818b',
  'match-statistics-coach-app-ux-20260819.js?v=20260820tablet1',
  'match-statistics-coach-final-polish-20260819.js?v=20260820tablet1',
  'match-statistics-coach-chart-tabs-20260820.js?v=20260820tablet1',
  'match-statistics-coach-publish-ux-20260820.js?v=20260820tablet1',
  'match-statistics-performance-20260820.js?v=20260820a',
  'match-statistics-player-overview-20260819.js?v=20260819a',
  'match-statistics-player-mobile-ux-20260824.js?v=20260824c',
  'match-statistics-player-polish-20260819.js?v=20260824c',
  'match-statistics-player-modal-scroll-fix-20260819.js?v=20260819b',
  'match-statistics-player-navigation-close-20260819.js?v=20260819a',
  'match-statistics-optional-v2-20260825.js?v=20260825stats1',
  'match-statistics-player-individual-priority-20260825.js?v=20260825stats4',
  'game-plan-canonical-20260817.js?v=20260817g',
];

  function appendScript(src){
    if(document.querySelector(`script[src^="${src.split('?')[0]}"]`))return;
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    document.head.appendChild(script);
  }
  function start(){
    let index=0;
    const batchSize=10;
    const next=()=>{
      const end=Math.min(index+batchSize,scripts.length);
      for(;index<end;index+=1)appendScript(scripts[index]);
      if(index<scripts.length)window.setTimeout(next,55);
    };
    next();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();