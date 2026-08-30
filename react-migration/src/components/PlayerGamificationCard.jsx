import { useEffect, useState } from 'react';
import { BadgeCheck, CircleCheckBig, Flame, LoaderCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { loadPlayerEngagement } from '../lib/engagement.js';
import './PlayerGamificationCard.css';

export default function PlayerGamificationCard() {
  const { identity } = useAuth();
  const player = identity?.player;
  const team = identity?.teams?.[0];
  const season = identity?.season;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!player?.id || !team?.id) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    loadPlayerEngagement({ playerId: player.id, teamId: team.id, seasonId: season?.id, seasonStart: season?.starts_on })
      .then((result) => { if (active) setData(result); })
      .catch((nextError) => { if (active) setError(nextError?.message || 'No se pudo cargar tu progreso.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [player?.id, team?.id, season?.id, season?.starts_on]);

  if (loading) {
    return <article className="player-game-card is-loading"><LoaderCircle className="spin" size={20} /><span>Cargando tu progreso…</span></article>;
  }
  if (error || !data) return null;

  const completed = data.missions.filter((mission) => mission.done).length;

  return (
    <article className="player-game-card">
      <div className="player-game-head">
        <div>
          <span className="player-game-kicker"><Sparkles size={15} /> Mi progreso</span>
          <h3>{data.level}</h3>
        </div>
        <span className="player-game-points"><strong>{data.xp}</strong><small>puntos</small></span>
      </div>

      <div className="player-game-progress"><span style={{ width: `${data.levelProgress}%` }} /></div>
      <p className="player-game-next">{data.nextLevel ? `${data.pointsToNext} puntos para ${data.nextLevel}` : 'Nivel máximo de la temporada'}</p>

      <div className="player-game-metrics">
        <div>
          <span className="player-game-metric-icon attendance"><BadgeCheck size={18} /></span>
          <strong>{data.attendanceRatio}%</strong>
          <small>Mi asistencia</small>
        </div>
        <div>
          <span className="player-game-metric-icon streak"><Flame size={18} /></span>
          <strong>{data.currentStreak}</strong>
          <small>Racha de asistencia</small>
        </div>
        <div>
          <span className="player-game-metric-icon habits"><CircleCheckBig size={18} /></span>
          <strong>{completed}/{data.missions.length}</strong>
          <small>Hábitos esta semana</small>
        </div>
      </div>
    </article>
  );
}
