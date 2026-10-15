// Individual minutes only; keep the app's current full-session fallback for present.
export function individualMinutes(attendance,sessionMinutes){
  if(!['present','late'].includes(attendance?.official_status))return null;
  const value=attendance.effective_minutes;
  if(value===null||value===undefined||value==='')return attendance.official_status==='present'?sessionMinutes:null;
  const minutes=Number(value);
  return Number.isFinite(minutes)&&minutes>0?Math.min(sessionMinutes,Math.round(minutes)):null;
}
export function saveIndividualMinutes(status,value,sessionMinutes){
  if(!['present','late'].includes(status))return null;
  if(value===null||value===undefined||value===''){
    if(status==='late')throw Error('Indica los minutos realizados.');
    return null;
  }
  const minutes=Number(value);
  if(!Number.isFinite(minutes)||minutes<=0)throw Error('Indica una duración válida en minutos.');
  if(minutes>sessionMinutes)throw Error(`Los minutos individuales no pueden superar los ${sessionMinutes} min de la sesión.`);
  return Math.round(minutes);
}
