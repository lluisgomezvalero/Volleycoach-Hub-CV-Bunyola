from pathlib import Path
import re

path = Path('i18n-es-ca-20260826.js')
s = path.read_text(encoding='utf-8')

old_apply = """function applyLanguage(){
  try{pendingRoots.clear();}catch(_){}
  applying=true;
  try{
    document.documentElement.lang=language==='ca'?'ca':'es';
    translateTree(document.body);
    ensureLanguageSelector();
    refreshDates();
  }finally{applying=false;}
  window.dispatchEvent(new CustomEvent('volley:language-applied',{detail:{language}}));
}
"""

new_apply = """function activeTranslationRoots(){
  const roots=[];
  const add=root=>{if(root&&root.isConnected!==false&&!roots.includes(root))roots.push(root);};
  add(document.getElementById('view-login'));
  add(document.getElementById('module-header-nav'));
  add(document.querySelector('.page-view.active'));
  document.querySelectorAll('.modal.show,.modal.active,.modal[style*=\"display: block\"],[role=\"dialog\"]:not([hidden])').forEach(add);
  add(document.getElementById('profile-language-card'));
  return roots;
}

function translateActiveSurfaces(){
  if(applying)return;
  applying=true;
  try{
    activeTranslationRoots().forEach(translateTree);
    ensureLanguageSelector();
    refreshDates();
  }finally{applying=false;}
}

const surfaceTranslationTimers=new Set();
function scheduleSurfaceTranslation(delays=[50,350]){
  if(language!=='ca')return;
  for(const delay of delays){
    const timer=setTimeout(()=>{
      surfaceTranslationTimers.delete(timer);
      translateActiveSurfaces();
    },delay);
    surfaceTranslationTimers.add(timer);
  }
}

function applyLanguage(){
  try{pendingRoots.clear();}catch(_){}
  for(const timer of surfaceTranslationTimers)clearTimeout(timer);
  surfaceTranslationTimers.clear();
  document.documentElement.lang=language==='ca'?'ca':'es';
  translateActiveSurfaces();
  window.dispatchEvent(new CustomEvent('volley:language-applied',{detail:{language}}));
}
"""

if old_apply not in s:
    raise SystemExit('applyLanguage block not found')
s = s.replace(old_apply, new_apply, 1)

old_install = """  const observer=new MutationObserver(queueMutationWork);
  observer.observe(document.body||document.documentElement,{childList:true,subtree:true});

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#btn-my-profile-header,#btn-my-profile-home')){
      setTimeout(()=>{ensureLanguageSelector();translateTree(document.getElementById('modal-my-profile'));void syncFromProfile();},0);
    }
  },true);
  window.addEventListener('focus',()=>void syncFromProfile());

  [250,900,2200].forEach(delay=>setTimeout(()=>{ensureLanguageSelector();void syncFromProfile();},delay));
"""

new_install = """  // Performance: no global MutationObserver. The app replaces large DOM blocks often,
  // and observing the whole subtree made Catalan mode block normal interaction.
  const scheduleFromInteraction=()=>scheduleSurfaceTranslation();
  document.addEventListener('click',event=>{
    scheduleFromInteraction();
    if(event.target?.closest?.('#btn-my-profile-header,#btn-my-profile-home')){
      setTimeout(()=>{ensureLanguageSelector();translateActiveSurfaces();void syncFromProfile();},0);
    }
  },true);
  document.addEventListener('change',scheduleFromInteraction,true);
  document.addEventListener('submit',scheduleFromInteraction,true);
  window.addEventListener('focus',()=>{void syncFromProfile();scheduleSurfaceTranslation([120]);});

  [250,900,2200].forEach(delay=>setTimeout(()=>{ensureLanguageSelector();void syncFromProfile();scheduleSurfaceTranslation([0]);},delay));
"""

if old_install not in s:
    raise SystemExit('install observer block not found')
s = s.replace(old_install, new_install, 1)
path.write_text(s, encoding='utf-8')

cfg = Path('supabase-config.js')
c = cfg.read_text(encoding='utf-8')
c, count = re.subn(r"i18n-es-ca-20260826\.js\?v=[^']+", "i18n-es-ca-20260826.js?v=20260826i18n5", c, count=1)
if count != 1:
    raise SystemExit('i18n cache marker not found')
cfg.write_text(c, encoding='utf-8')
