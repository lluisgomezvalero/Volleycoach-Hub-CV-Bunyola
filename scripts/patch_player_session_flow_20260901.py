from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Missing snippet: {label}')
    return text.replace(old, new, 1)


def append_once(text, marker, block):
    if marker in text:
        return text
    return text.rstrip() + '\n\n' + block.strip() + '\n'


home_path = Path('react-migration/src/pages/HomePage.jsx')
home = home_path.read_text()

home = replace_once(
    home,
    "  const [checkinError, setCheckinError] = useState('');\n",
    "  const [checkinError, setCheckinError] = useState('');\n  const [pendingPlayerRpe, setPendingPlayerRpe] = useState(null);\n",
    'home pending RPE state',
)

home = replace_once(
    home,
    "        let nextAttendance = [];\n        let nextPlan = null;\n\n        if (isStaff) {",
    "        let nextAttendance = [];\n        let nextPlan = null;\n        let nextPendingPlayerRpe = null;\n\n        if (!isStaff && match?.id) {\n          const { data: publishedPlanRows, error: publishedPlanError } = await supabase\n            .from('game_plans')\n            .select('id,event_id,status,published_at,version')\n            .eq('event_id', match.id)\n            .eq('status', 'published')\n            .order('version', { ascending: false })\n            .order('published_at', { ascending: false })\n            .limit(1);\n          if (publishedPlanError) throw publishedPlanError;\n          nextPlan = publishedPlanRows?.[0] || null;\n        }\n\n        if (isStaff) {",
    'player published game plan lookup',
)

home = replace_once(
    home,
    "            ? supabase.from('game_plans').select('id,event_id,status,published_at').eq('event_id', match.id).order('updated_at', { ascending: false }).limit(1)",
    "            ? supabase.from('game_plans').select('id,event_id,status,published_at,version').eq('event_id', match.id).eq('status', 'published').order('version', { ascending: false }).order('published_at', { ascending: false }).limit(1)",
    'staff published game plan lookup',
)

home = replace_once(
    home,
    "            const eventMap = new Map(playerEvents.map((event) => [event.id, event]));\n            const attendanceMap = new Map((playerAttendanceResult.data || []).map((row) => [row.event_id, row]));\n            const chosen = new Map();",
    "            const eventMap = new Map(playerEvents.map((event) => [event.id, event]));\n            const attendanceMap = new Map((playerAttendanceResult.data || []).map((row) => [row.event_id, row]));\n            const ownPlayerRpeEventIds = new Set((playerRpeResult.data || []).filter((row) => row.source === 'player').map((row) => row.event_id));\n            nextPendingPlayerRpe = [...playerEvents]\n              .filter((event) => {\n                const start = new Date(event.starts_at).getTime();\n                const end = event.ends_at ? new Date(event.ends_at).getTime() : start + eventDuration(event) * 60000;\n                if (!Number.isFinite(end) || now.getTime() < end + 30 * 60 * 1000) return false;\n                if (ownPlayerRpeEventIds.has(event.id)) return false;\n                const attendance = attendanceMap.get(event.id);\n                return !['justified', 'unjustified'].includes(attendance?.official_status);\n              })\n              .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))[0] || null;\n            const chosen = new Map();",
    'calculate pending player RPE',
)

home = replace_once(
    home,
    "        setGamePlan(nextPlan);\n        setRecentMatches(recentMatchResult.data || []);",
    "        setGamePlan(nextPlan);\n        setPendingPlayerRpe(nextPendingPlayerRpe);\n        setRecentMatches(recentMatchResult.data || []);",
    'store pending player RPE',
)

home = replace_once(
    home,
    "      {error ? <div className=\"coach-home-error\">{error}</div> : null}\n\n      {!isStaff && !loading && playerWellnessLoaded && !playerWellnessToday ? (",
    "      {error ? <div className=\"coach-home-error\">{error}</div> : null}\n\n      {!isStaff && pendingPlayerRpe ? (\n        <Link className=\"player-pending-rpe-banner\" to={`/training?event=${encodeURIComponent(pendingPlayerRpe.id)}&mode=session`}>\n          <span className=\"player-pending-rpe-icon\"><Activity size={19} /></span>\n          <span><small>Te falta por contestar</small><strong>Enviar el RPE del entrenamiento</strong><em>Ya puedes registrar tu percepción del esfuerzo.</em></span>\n          <ChevronRight size={19} />\n        </Link>\n      ) : null}\n\n      {!isStaff && !loading && playerWellnessLoaded && !playerWellnessToday ? (",
    'home pending RPE banner',
)

home = replace_once(
    home,
    "                {attendanceError ? <div className=\"player-home-attendance-error\">{attendanceError}</div> : null}\n              </>",
    "                {attendanceError ? <div className=\"player-home-attendance-error\">{attendanceError}</div> : null}\n                {playerAttendanceResponse ? (\n                  <Link className=\"player-home-session-link\" to={`/training?event=${encodeURIComponent(displayNextTraining.id)}&mode=session`}>\n                    <Dumbbell size={17} /> Entrar en la sesión <ChevronRight size={17} />\n                  </Link>\n                ) : null}\n              </>",
    'direct player session link after RSVP',
)

home_path.write_text(home)

training_path = Path('react-migration/src/pages/TrainingPageProfessional.jsx')
training = training_path.read_text()

training = replace_once(
    training,
    "  const [commentSaved, setCommentSaved] = useState('');\n",
    "  const [commentSaved, setCommentSaved] = useState('');\n  const [commentEditing, setCommentEditing] = useState(false);\n",
    'comment editing state',
)

training = replace_once(
    training,
    "        if (isPlayer) {\n          const ownComment = nextFeedback.find((row) => row.kind === 'player_comment' && row.player_id === identity?.player?.id);\n          if (ownComment?.comment_text) setCommentText(ownComment.comment_text);\n        }",
    "        if (isPlayer) {\n          const ownComment = nextFeedback.find((row) => row.kind === 'player_comment' && row.player_id === identity?.player?.id);\n          setCommentText(ownComment?.comment_text || '');\n          setCommentEditing(false);\n        }",
    'hydrate player comment state',
)

training = replace_once(
    training,
    "  const coachRpe = rpeRows.find((row) => row.source === 'coach' && row.coach_profile_id === identity?.profile?.id);\n  const coachScore = coachRpe ? Number(coachRpe.score) : null;",
    "  const coachRpe = rpeRows.find((row) => row.source === 'coach' && row.coach_profile_id === identity?.profile?.id);\n  const ownPlayerRpe = isPlayer ? rpeRows.find((row) => row.source === 'player' && row.player_id === identity?.player?.id) || null : null;\n  const ownPlayerComment = isPlayer ? feedbackRows.find((row) => row.kind === 'player_comment' && row.player_id === identity?.player?.id && String(row.comment_text || '').trim()) || null : null;\n  const coachScore = coachRpe ? Number(coachRpe.score) : null;",
    'player RPE and comment records',
)

training = replace_once(
    training,
    "  async function saveRpe() {\n    if (!rpeAvailable) return;",
    "  async function saveRpe() {\n    if (!rpeAvailable || (isPlayer && ownPlayerRpe)) return;",
    'prevent player RPE edits',
)

old_comment_fn = """  async function savePlayerComment() {
    if (!isPlayer || !identity?.player?.id || !completed) return;
    setCommentSaving(true);
    setCommentSaved('');
    setExtrasError('');
    try {
      const text = commentText.trim();
      const existing = feedbackRows.find((row) => row.kind === 'player_comment' && row.player_id === identity.player.id);
      const payload = { comment_text: text, updated_at: new Date().toISOString() };
      let result;
      if (existing) result = await supabase.from('session_feedback').update(payload).eq('id', existing.id).select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').single();
      else result = await supabase.from('session_feedback').insert({ event_id: event.id, player_id: identity.player.id, coach_profile_id: null, kind: 'player_comment', comment_text: text }).select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').single();
      if (result.error) throw result.error;
      setFeedbackRows((rows) => [...rows.filter((row) => row.id !== result.data.id && !(row.kind === 'player_comment' && row.player_id === identity.player.id)), result.data]);
      setCommentSaved('Comentario enviado');
    } catch (error) {
      setExtrasError(error?.message || 'No se pudo guardar el comentario.');
    } finally {
      setCommentSaving(false);
    }
  }
"""
new_comment_fn = """  async function savePlayerComment() {
    if (!isPlayer || !identity?.player?.id || !completed) return;
    const text = commentText.trim();
    if (!text) {
      setExtrasError('Escribe un comentario antes de guardarlo.');
      return;
    }
    setCommentSaving(true);
    setCommentSaved('');
    setExtrasError('');
    try {
      const existing = feedbackRows.find((row) => row.kind === 'player_comment' && row.player_id === identity.player.id);
      const payload = { comment_text: text, updated_at: new Date().toISOString() };
      let result;
      if (existing) result = await supabase.from('session_feedback').update(payload).eq('id', existing.id).select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').single();
      else result = await supabase.from('session_feedback').insert({ event_id: event.id, player_id: identity.player.id, coach_profile_id: null, kind: 'player_comment', comment_text: text }).select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').single();
      if (result.error) throw result.error;
      setFeedbackRows((rows) => [...rows.filter((row) => row.id !== result.data.id && !(row.kind === 'player_comment' && row.player_id === identity.player.id)), result.data]);
      setCommentText(result.data.comment_text || text);
      setCommentSaved(existing ? 'Comentario actualizado' : 'Comentario enviado');
      setCommentEditing(false);
    } catch (error) {
      setExtrasError(error?.message || 'No se pudo guardar el comentario.');
    } finally {
      setCommentSaving(false);
    }
  }
"""
training = replace_once(training, old_comment_fn, new_comment_fn, 'player comment save function')

old_rpe_ui = """            {isStaff && coachRpe ? (
              <div className="pro-rpe-locked">
                <Check size={18} />
                <span><strong>RPE previsto registrado</strong><small>Este valor queda cerrado y ya no puede modificarse.</small></span>
              </div>
            ) : (
              <>
                <RpeScale value={rpeValue} onChange={setRpeValue} disabled={rpeSaving} />
                <button className="pro-primary-action" type="button" onClick={() => void saveRpe()} disabled={rpeSaving}><Save size={17} /> {rpeSaving ? 'Guardando…' : isStaff ? 'Guardar RPE' : 'Guardar mi RPE'}</button>
                {rpeSaved ? <p className="pro-success-copy"><Check size={15} /> {rpeSaved}</p> : null}
              </>
            )}
"""
new_rpe_ui = """            {(isStaff && coachRpe) || (isPlayer && ownPlayerRpe) ? (
              <div className="pro-rpe-locked">
                <Check size={18} />
                <span>
                  <strong>{isStaff ? 'RPE previsto registrado' : 'RPE registrado'}</strong>
                  <small>{isStaff ? 'Este valor queda cerrado y ya no puede modificarse.' : `Tu respuesta (${Math.round(Number(ownPlayerRpe?.score || 0))}/10) ha quedado guardada y cerrada.`}</small>
                </span>
              </div>
            ) : (
              <>
                <RpeScale value={rpeValue} onChange={setRpeValue} disabled={rpeSaving} />
                <button className="pro-primary-action" type="button" onClick={() => void saveRpe()} disabled={rpeSaving}><Save size={17} /> {rpeSaving ? 'Guardando…' : isStaff ? 'Guardar RPE' : 'Guardar mi RPE'}</button>
                {rpeSaved ? <p className="pro-success-copy"><Check size={15} /> {rpeSaved}</p> : null}
              </>
            )}
"""
training = replace_once(training, old_rpe_ui, new_rpe_ui, 'lock player RPE UI')

old_comment_ui = """      {completed && isPlayer ? (
        <article className="pro-session-panel tone-violet">
          <div className="pro-panel-title"><MessageSquare size={19} /><span><small>Opcional y privado</small><strong>Mi comentario</strong></span></div>
          <p className="pro-panel-note">Puedes dejar una sensación, incidencia o comentario para el cuerpo técnico.</p>
          <label className="pro-field"><textarea rows="4" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="¿Cómo te has sentido? ¿Hay algo que quieras comentar?" /></label>
          <button className="pro-secondary-action" type="button" disabled={commentSaving} onClick={() => void savePlayerComment()}><MessageSquare size={17} /> {commentSaving ? 'Enviando…' : 'Guardar comentario'}</button>
          {commentSaved ? <p className="pro-success-copy"><Check size={15} /> {commentSaved}</p> : null}
        </article>
      ) : null}
"""
new_comment_ui = """      {completed && isPlayer ? (
        <article className="pro-session-panel tone-violet">
          <div className="pro-panel-title"><MessageSquare size={19} /><span><small>Opcional y privado</small><strong>Mi comentario</strong></span></div>
          {ownPlayerComment && !commentEditing ? (
            <div className="pro-player-comment-locked">
              <div className="pro-player-comment-saved"><Check size={18} /><span><strong>{commentSaved || 'Comentario enviado'}</strong><small>Tu comentario está guardado y solo lo puede ver el cuerpo técnico.</small></span></div>
              <p>{ownPlayerComment.comment_text}</p>
              <button className="pro-outline-action" type="button" onClick={() => { setCommentSaved(''); setExtrasError(''); setCommentEditing(true); }}><MessageSquare size={17} /> Editar comentario</button>
            </div>
          ) : (
            <>
              <p className="pro-panel-note">Puedes dejar una sensación, incidencia o comentario para el cuerpo técnico.</p>
              <label className="pro-field"><textarea rows="4" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="¿Cómo te has sentido? ¿Hay algo que quieras comentar?" /></label>
              <button className="pro-secondary-action" type="button" disabled={commentSaving} onClick={() => void savePlayerComment()}><MessageSquare size={17} /> {commentSaving ? 'Enviando…' : ownPlayerComment ? 'Guardar cambios' : 'Guardar comentario'}</button>
              {commentSaved ? <p className="pro-success-copy"><Check size={15} /> {commentSaved}</p> : null}
            </>
          )}
        </article>
      ) : null}
"""
training = replace_once(training, old_comment_ui, new_comment_ui, 'closed player comment UI')

training_path.write_text(training)

home_css_path = Path('react-migration/src/pages/HomePolish.css')
home_css = home_css_path.read_text()
home_css = append_once(home_css, 'PLAYER WORKFLOW QA 20260901', r'''
/* PLAYER WORKFLOW QA 20260901 */
.player-pending-rpe-banner{display:flex;align-items:center;gap:.8rem;margin:0 0 1rem;padding:.9rem 1rem;border:1px solid #fed7aa;border-radius:16px;background:#fff7ed;color:#9a3412;text-decoration:none;box-shadow:0 8px 22px rgba(15,23,42,.06)}
.player-pending-rpe-banner>span:nth-child(2){display:flex;flex:1;min-width:0;flex-direction:column;gap:.08rem}.player-pending-rpe-banner small{font-size:.68rem;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.player-pending-rpe-banner strong{font-size:.92rem;color:#7c2d12}.player-pending-rpe-banner em{font-size:.76rem;font-style:normal;color:#9a5a39}.player-pending-rpe-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#ffedd5;color:#ea580c;flex:none}
.player-home-session-link{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:46px;margin-top:.65rem;border:1px solid rgba(245,158,11,.38);border-radius:13px;background:rgba(255,255,255,.1);color:#fbbf24;text-decoration:none;font-size:.86rem;font-weight:850;box-sizing:border-box}.player-home-session-link svg:last-child{margin-left:auto}
@media(max-width:760px){.player-pending-rpe-banner{margin-inline:0}.player-home-session-link{min-height:48px;padding:.75rem .9rem}}
''')
home_css_path.write_text(home_css)

training_css_path = Path('react-migration/src/pages/TrainingPolish.css')
training_css = training_css_path.read_text()
training_css = append_once(training_css, 'PLAYER SESSION CLOSED STATES 20260901', r'''
/* PLAYER SESSION CLOSED STATES 20260901 */
.pro-player-comment-locked{display:grid;gap:.8rem}.pro-player-comment-saved{display:flex;align-items:flex-start;gap:.65rem;padding:.85rem .95rem;border:1px solid #bbf7d0;border-radius:14px;background:#f0fdf4;color:#166534}.pro-player-comment-saved>span{display:flex;flex-direction:column;gap:.12rem}.pro-player-comment-saved strong{font-size:.9rem}.pro-player-comment-saved small{font-size:.75rem;color:#4b6b58}.pro-player-comment-locked>p{margin:0;padding:.9rem 1rem;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#334155;white-space:pre-wrap;line-height:1.5}.pro-player-comment-locked .pro-outline-action{justify-self:start}
''')
training_css_path.write_text(training_css)

print('Patched player session workflow UX.')
