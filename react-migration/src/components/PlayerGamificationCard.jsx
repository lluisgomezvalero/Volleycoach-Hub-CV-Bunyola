import { useEffect, useState } from 'react';
import { BadgeCheck, CalendarCheck2, Check, Gauge, HeartPulse, LoaderCircle, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { loadPlayerEngagement } from '../lib/engagement.js';
import './PlayerGamificationCard.css';

const ICONS = {
  confirm: CalendarCheck2,
  attendance: BadgeCheck,
  wellness: HeartPulse,
  'rpe-week': Gauge
};

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
          <span className="player-game-kicker"><Sparkles size={14} /> Tu progreso</span>
          <h3>Misiones de la semana</h3>
          <p>Premiamos constancia y hábitos que dependen de ti.</p>
        </div>
        <div className="player-game-level"><Trophy size={18} /><span>{data.level}</span><strong>{data.xp} XP</strong></div>
      </div>

      <div className="player-game-progress-copy"><span>Nivel {data.level}</span><strong>{data.nextLevel ? `${data.pointsToNext} XP para ${data.nextLevel}` : 'Nivel máximo'}</strong></div>
      <div className="player-game-progress"><span style={{ width: `${data.levelProgress}%` }} /></div>

      <div className="player-game-missions">
        {data.missions.map((mission) => {
          const Icon = ICONS[mission.id] || BadgeCheck;
          const pct = Math.min(100, Math.round((mission.progress * 100) / Math.max(1, mission.target)));
          return (
            <div className={`player-game-mission ${mission.done ? 'is-done' : ''}`} key={mission.id}>
              <span className="player-game-mission-icon">{mission.done ? <Check size={17} /> : <Icon size={17} />}</span>
              <div className="player-game-mission-copy">
                <div><strong>{mission.title}</strong><span>+{mission.xp} XP</span></div>
                <small>{mission.detail}</small>
                <div className="player-game-mini-progress"><span style={{ width: `${pct}%` }} /></div>
              </div>
              <b>{mission.progress}/{mission.target}</b>
            </div>
          );
        })}
      </div>

      <div className={`player-game-week ${data.weekPerfect ? 'is-perfect' : ''}`}>
        <BadgeCheck size={18} />
        <span>{data.weekPerfect ? 'Semana completa' : `${completed}/${data.missions.length} hábitos completados`}</span>
        <strong>+30 XP al completar todo</strong>
      </div>
    </article>
  );
}
