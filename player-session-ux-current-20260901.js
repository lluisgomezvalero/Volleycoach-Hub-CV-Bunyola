(function(){
'use strict';

const FLAG='__playerSessionUxCurrent20260901';
let editingEventId=null;

function isPlayer(){
  try{return typeof getCurrentUser==='function'&&getCurrentUser()?.role==='player';}catch(_){return false;}
}
function esc(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function currentEventId(){
  try{return typeof activeSessionId!=='undefined'&&activeSessionId?String(activeSessionId):null;}catch(_){return null;}
}
function currentComment(eventId){
  try{
    const u=getCurrentUser?.();
    return (appState?.sessionPlayerComments||[]).find(row=>String(row.eventId)===String(eventId)&&String(row.playerId)===String(u?.playerId))||null;
  }catch(_){return null;}
}
function sectionForComment(){
  const root=document.getElementById('session-center-detail');
  if(!root)return null;
  return [...root.querySelectorAll('.session-panel')].find(sec=>sec.querySelector('h3')?.textContent?.includes('Mi comentario'))||null;
}
function ensureStyle(){
  if(document.getElementById('player-session-ux-current-style'))return;
  const style=document.createElement('style');
  style.id='player-session-ux-current-style';
  style.textContent=`
.current-comment-edit-action{margin-top:.8rem;display:inline-flex;align-items:center;gap:.45rem}.current-comment-editor-note{margin:.2rem 0 .7rem;color:#64748b;font-size:.82rem}.current-comment-editor-actions{display:flex;gap:.55rem;flex-wrap:wrap;margin-top:.75rem}
`;
  document.head.appendChild(style);
}
function renderEditor(sec,eventId,comment){
  const text=comment?.text||'';
  sec.innerHTML=`<div class="session-panel-title"><i data-lucide="message-square-text"></i><div><span>Opcional y privado</span><h3>Mi comentario</h3></div></div><p class="current-comment-editor-note">Puedes modificar el comentario que ya enviaste.</p><textarea id="session-player-comment" class="form-control" rows="3" placeholder="Puedes explicar cómo te sentiste o añadir una observación para el entrenador.">${esc(text)}</textarea><div class="current-comment-editor-actions"><button type="button" class="btn btn-primary btn-sm" onclick="saveSessionPlayerComment('${esc(eventId)}')"><i data-lucide="save"></i> Guardar cambios</button><button type="button" class="btn btn-outline btn-sm" onclick="cancelCurrentSessionCommentEdit()">Cancelar</button></div>`;
}
function apply(){
  if(!isPlayer())return;
  const eventId=currentEventId();
  if(!eventId)return;
  const comment=currentComment(eventId);
  if(!comment||!String(comment.text||'').trim())return;
  const sec=sectionForComment();
  if(!sec)return;
  if(String(editingEventId)===String(eventId)){
    renderEditor(sec,eventId,comment);
  }else{
    const completed=sec.querySelector('.correction-completed');
    if(completed&&!sec.querySelector('.current-comment-edit-action')){
      const button=document.createElement('button');
      button.type='button';
      button.className='btn btn-outline btn-sm current-comment-edit-action';
      button.innerHTML='<i data-lucide="pencil"></i> Editar comentario';
      button.addEventListener('click',()=>window.editCurrentSessionComment(eventId));
      sec.appendChild(button);
    }
  }
  try{window.lucide?.createIcons?.();}catch(_){}
}
window.editCurrentSessionComment=function(eventId){
  editingEventId=String(eventId||currentEventId()||'');
  try{window.renderSessionCenterDetail?.();}catch(_){}
};
window.cancelCurrentSessionCommentEdit=function(){
  editingEventId=null;
  try{window.renderSessionCenterDetail?.();}catch(_){}
};
function install(){
  if(window[FLAG])return;
  if(!window.__appCorrections20260809Installed||typeof window.renderSessionCenterDetail!=='function'||typeof window.saveSessionPlayerComment!=='function'){
    setTimeout(install,150);return;
  }
  window[FLAG]=true;
  ensureStyle();
  const renderBase=window.renderSessionCenterDetail;
  window.renderSessionCenterDetail=function(){const result=renderBase.apply(this,arguments);apply();return result;};
  const saveBase=window.saveSessionPlayerComment;
  window.saveSessionPlayerComment=async function(){editingEventId=null;return await saveBase.apply(this,arguments);};
  try{apply();}catch(_){}
}
setTimeout(install,0);
})();
