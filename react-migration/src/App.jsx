import { lazy, Suspense, useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { CalendarDays, ChartNoAxesCombined, Dumbbell, Gauge, HeartPulse, Home, Menu, Shield, Trophy, Users, X } from 'lucide-react';

const Placeholder = ({ title, text }) => (
  <section className="page-card">
    <p className="eyebrow">Migración React</p>
    <h1>{title}</h1>
    <p>{text}</p>
  </section>
);

const HomePage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Inicio" text="Primera pantalla de la nueva arquitectura. Sin parches del DOM ni observadores globales." /> }));
const TrainingPage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Entrenos" text="Aquí migraremos sesiones, asistencia y RPE." /> }));
const CalendarPage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Calendario" text="Calendario modular conectado a Supabase." /> }));
const WellnessPage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Bienestar" text="Cuestionario e historial se migrarán como componentes React independientes." /> }));
const RosterPage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Plantilla" text="Jugadoras y perfiles sin reescrituras posteriores del DOM." /> }));
const StatsPage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Estadísticas" text="Este módulo solo se cargará cuando entres aquí." /> }));
const CompetitionPage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Competición" text="Clasificación, partidos y convocatorias manteniendo nombres reales desde datos." /> }));
const GamePlanPage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Plan de juego" text="Plan táctico aislado del resto de la aplicación." /> }));
const PerformancePage = lazy(() => Promise.resolve({ default: () => <Placeholder title="Rendimiento" text="Métricas y tests se cargarán bajo demanda." /> }));

const nav = [
  ['/', 'Inicio', Home],
  ['/training', 'Entrenos', Dumbbell],
  ['/calendar', 'Calendario', CalendarDays],
  ['/wellness', 'Bienestar', HeartPulse],
  ['/roster', 'Plantilla', Users],
  ['/statistics', 'Estadísticas', ChartNoAxesCombined],
  ['/competition', 'Competición', Trophy],
  ['/game-plan', 'Plan de juego', Shield],
  ['/performance', 'Rendimiento', Gauge]
];

function Navigation({ onNavigate }) {
  return nav.map(([to, label, Icon]) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={onNavigate}>
      <Icon size={19} strokeWidth={2.1} />
      <span>{label}</span>
    </NavLink>
  ));
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const shellClass = useMemo(() => `app-shell${menuOpen ? ' menu-open' : ''}`, [menuOpen]);

  return (
    <div className={shellClass}>
      <header className="mobile-header">
        <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu /></button>
        <div><strong>VolleyCoach Hub</strong><span>CV Bunyola</span></div>
      </header>

      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">VB</span><div><strong>VolleyCoach Hub</strong><small>CV Bunyola</small></div></div>
        <nav><Navigation onNavigate={() => setMenuOpen(false)} /></nav>
      </aside>

      {menuOpen && <button className="overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
      <aside className="mobile-drawer">
        <div className="drawer-head"><strong>Menú</strong><button className="icon-button" onClick={() => setMenuOpen(false)}><X /></button></div>
        <nav><Navigation onNavigate={() => setMenuOpen(false)} /></nav>
      </aside>

      <main className="content">
        <Suspense fallback={<div className="loading">Cargando módulo…</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/wellness" element={<WellnessPage />} />
            <Route path="/roster" element={<RosterPage />} />
            <Route path="/statistics" element={<StatsPage />} />
            <Route path="/competition" element={<CompetitionPage />} />
            <Route path="/game-plan" element={<GamePlanPage />} />
            <Route path="/performance" element={<PerformancePage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
