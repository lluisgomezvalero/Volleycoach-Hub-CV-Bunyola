(function(){
'use strict';

const FLAG='__matchStatisticsIndividual20260824';
if(window[FLAG])return;
window[FLAG]=true;

const ROW_SELECT='id,event_id,player_id,club_id,team_id,status,visible_metrics,payload,published_at,created_by,created_at,updated_at';
const GENERAL_FIELDS={
  'stats-rec-perfect-pct':'recPerfectPct',
  'stats-rec-exclam-pct':'recExclamPct',
  'stats-rec-error-pct':'recErrorPct',
  'stats-rec-total':'recTotal',
  'stats-attack-efficiency':'attackEfficiencyPct',
  'stats-attack-errors':'attackErrors',
  'stats-attack-total':'attackTotal',
  'stats-aces':'aces',
  'stats-serve-errors':'serveErrorPct',
  'stats-serve-total':'serveTotal',
  'stats-bloqueos':'bloqueos',
  'stats-block-total':'blockTotal',
  'stats-own-errors':'ownErrors',
  'stats-opponent-errors':'opponentErrors'
};
const PERCENT_IDS=['stats-rec-perfect-pct','stats-rec-exclam-pct','stats-rec-error-pct','stats-attack-efficiency','stats-serve-errors'];
const PLAYER_VISIBLE=['recPerfectPct','recExclamPct','recErrorPct','recTotal','attackEfficiencyPct','attackErrors','attackTotal','aces','serveErrorPct','serveTotal','bloqueos','blockTotal'];
const playerRowsByEvent=new Map();
const remoteEventByLocal=new Map();
let activeMatchId=null;
let activePlayerId=null;
let pendingGeneralSave=null;
let observerInstalled=false;

function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function db(){return window.VolleySupabase?.getClient?.()||null;}
function coach(){try{return typeof isCoachUser==='function'&&isCoachUser();}catch(_){return false;}}
function currentUser(){try{return typeof getCurrentUser==='function'?getCurrentUser():null;}catch(_){return null;}}
function toast(message,type){try{if(typeof showToast==='function')showToast(message,type);}catch(_){}}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function matches(){return (state()?.events||[]).filter(e=>e&&['Partido','Amistoso'].includes(String(e.type||'')));}
function findMatch(id){return matches().find(m=>[m.id,m.legacyId,m.legacy_id,m.supabaseId,m.supabase_id].filter(Boolean).some(v=>String(v)===String(id)))||null;}
function players(){return (state()?.players||[]).filter(p=>p&&p.active!==false).slice().sort((a,b)=>(Number(a.number??a.dorsal??999)-Number(b.number??b.dorsal??999))||String(a.name||a.full_name||'').localeCompare(String(b.name||b.full_name||''),'es'));}
function findPlayer(id){return players().find(p=>[p.id,p.legacyId,p.legacy_id,p.supabaseId].filter(Boolean).some(v=>String(v)===String(id)))||null;}
function prettyDate(value){const raw=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const [y,m,d]=raw.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');}
function statusLabel(value){return value==='published'?'Publicado':value==='draft'?'Borrador':value==='archived'?'Archivado':'Sin datos';}
function statusClass(value){return value==='published'?'is-published':value==='draft'?'is-draft':value==='archived'?'is-archived':'is-empty';}

async function identity(){
  const result=await window.VolleySupabase?.getIdentity?.();
  if(result?.error)throw result.error;
  if(!result?.data?.profile?.id)throw new Error('No se ha podido identificar al usuario.');
  return result.data;
}
async function remoteEventId(match){
  if(!match)return null;
  const key=String(match.id||match.legacyId||match.legacy_id||'');
  if(key&&remoteEventByLocal.has(key))return remoteEventByLocal.get(key);
  for(const value of [match.id,match.supabaseId,match.supabase_id]){
    if(isUuid(value)){if(key)remoteEventByLocal.set(key,String(value));return String(value);}
  }
  const legacy=match.legacyId||match.legacy_id||match.id;
  const client=db();if(!client||!legacy)return null;
  const {data,error}=await client.from('events').select('id').eq('legacy_id',String(legacy)).maybeSingle();
  if(error)throw error;
  if(data?.id&&key)remoteEventByLocal.set(key,String(data.id));
  return data?.id||null;
}
async function remotePlayerId(player){
  if(!player)return null;
  for(const value of [player.supabaseId,player.supabase_id])if(isUuid(value))return String(value);
  if(isUuid(player.id))return String(player.id);
  const client=db();if(!client)return null;
  const legacy=player.legacy_id||player.legacyId||player.id;
  if(legacy){
    const {data,error}=await client.from('players').select('id').eq('legacy_id',String(legacy)).maybeSingle();
    if(error)throw error;
    if(data?.id){player.supabaseId=data.id;return data.id;}
  }
  const username=String(player.username||'').trim();
  if(username){
    const {data,error}=await client.from('players').select('id,profiles:profile_id(username)').eq('profiles.username',username).maybeSingle();
    if(!error&&data?.id){player.supabaseId=data.id;return data.id;}
  }
  return null;
}

function ensureStyles(){
  if(document.getElementById('match-statistics-individual-20260824-style'))return;
  const style=document.createElement('style');
  style.id='match-statistics-individual-20260824-style';
  style.textContent=`
    #form-match-stats .stats-percent-wrap{display:grid!important;grid-template-columns:minmax(0,1fr) 38px!important;align-items:stretch!important;width:100%!important}
    #form-match-stats .stats-percent-wrap .form-control{border-radius:11px 0 0 11px!important;border-right:0!important}
    #form-match-stats .stats-percent-suffix{display:grid;place-items:center;border:1px solid #cbd5e1;border-left:0;border-radius:0 11px 11px 0;background:#f8fafc;color:#475569;font-size:.78rem;font-weight:850}
    #form-match-stats .stats-optional-note{margin:.1rem 0 .65rem;padding:.58rem .68rem;border:1px solid #dbeafe;border-radius:11px;background:#f8fbff;color:#64748b;font-size:.64rem;line-height:1.3}
    #form-match-stats .stats-optional-note strong{color:#334155}
    #form-match-stats .stats-modal-actions{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)!important}
    #form-match-stats .stats-modal-actions button[type="submit"]{font-size:0!important}
    #form-match-stats .stats-modal-actions button[type="submit"]::after{content:'Guardar generales';font-size:.76rem!important}

    #stats-matches-list .individual-stats-open-btn{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;min-height:38px;padding:.46rem .68rem;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font-size:.68rem;font-weight:800;cursor:pointer}
    #stats-matches-list .individual-stats-open-btn:hover{background:#f8fafc}

    #modal-match-player-stats{z-index:100020!important}
    #modal-match-player-stats .modal-content{width:min(94vw,720px);max-width:720px;max-height:min(94dvh,900px);display:flex;flex-direction:column;overflow:hidden}
    #modal-match-player-stats .modal-header{flex:0 0 auto;padding:.9rem 1rem;border-bottom:1px solid #e2e8f0;background:#fff}
    #modal-match-player-stats .modal-header h3{font-family:var(--font-heading);font-size:1rem;color:#0f172a}
    #modal-match-player-stats .modal-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:.9rem 1rem 1rem;background:#fbfcfe}
    #modal-match-player-stats .individual-optional-banner{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:.8rem;padding:.7rem .75rem;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff;color:#475569;font-size:.68rem;line-height:1.25}
    #modal-match-player-stats .individual-optional-banner strong{display:block;color:#0f172a;font-size:.74rem;margin-bottom:.15rem}
    #modal-match-player-stats .individual-optional-banner button{flex:0 0 auto;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#334155;min-height:36px;padding:.4rem .6rem;font-weight:800;font-size:.64rem;cursor:pointer}
    #modal-match-player-stats .individual-player-list{display:grid;gap:.45rem}
    #modal-match-player-stats .individual-player-row{display:grid;grid-template-columns:36px minmax(0,1fr) auto auto;align-items:center;gap:.5rem;border:1px solid #e2e8f0;border-radius:11px;background:#fff;padding:.5rem .55rem}
    #modal-match-player-stats .individual-player-avatar{width:36px;height:36px;border-radius:10px;background:#f1f5f9;display:grid;place-items:center;color:#64748b;font-weight:850;fo