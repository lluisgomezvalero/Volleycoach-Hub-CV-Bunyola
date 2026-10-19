export function createSubmitLock(){let busy=false;return {acquire(){if(busy)return false;busy=true;return true;},release(){busy=false;}};}
export function mergeWellnessRows(rows,row){return [row,...rows.filter(r=>r.player_id!==row.player_id||r.entry_date!==row.entry_date)].sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date)));}
export function updateWellnessCache(cache,row){
 for(const [key,entry] of cache){if(entry.players?.some(player=>player.id===row.player_id))cache.set(key,{...entry,wellnessRows:mergeWellnessRows(entry.wellnessRows||[],row),cachedAt:Date.now()});}
}
export const wellnessFields='id,player_id,entry_date,general_state,fatigue,sleep,pain_score,notes,created_at,updated_at';
const rpeFields='id,event_id,player_id,coach_profile_id,score,source,created_at,updated_at';
export async function saveOwnWellness(db,payload){
 const response=await db.from('wellness_entries').insert(payload).select(wellnessFields).single();
 if(!response.error)return {row:response.data,existing:false};
 if(response.error.code!=='23505')throw response.error;
 // A lost response/retry must read the stored record, never invent a successful save.
 const stored=await db.from('wellness_entries').select(wellnessFields).eq('player_id',payload.player_id).eq('entry_date',payload.entry_date).single();
 if(stored.error)throw stored.error;return {row:stored.data,existing:true};
}
export async function saveOwnRpe(db,eventId,playerId,score){
 const response=await db.from('rpe_entries').insert({event_id:eventId,player_id:playerId,coach_profile_id:null,score,source:'player'}).select(rpeFields).single();
 if(!response.error)return {row:response.data,existing:false};
 if(response.error.code!=='23505')throw response.error;
 const stored=await db.from('rpe_entries').select(rpeFields).eq('event_id',eventId).eq('player_id',playerId).eq('source','player').single();
 if(stored.error)throw stored.error;return {row:stored.data,existing:true};
}
