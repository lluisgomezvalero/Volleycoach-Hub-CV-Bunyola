import { lazy, Suspense, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  Gauge,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Shield,
  Trophy,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { useAuth } from './auth/AuthProvider.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProfileModal from './components/ProfileModal.jsx';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const TrainingPage = lazy(() => import('./pages/TrainingPage.jsx'));
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'));
const WellnessPage = lazy(() => import('./pages/WellnessPage.jsx'));
const RosterPage = lazy(() => import('./pages/RosterPage.jsx'));
const StatsPage = lazy(() => import('./pages/StatisticsPage.jsx'));
const CompetitionPage = lazy(() => import('./pages/CompetitionPage.jsx'));

function lazyPlaceholder(title, text) {
  return lazy(() => import('./pages/PlaceholderPage.jsx').then(({ default: PlaceholderPage }) => ({
    default: () => <PlaceholderPage title={title} text={text} />
  })));
}

const GamePlanPage = lazyPlaceholder('Plan de juego', 'Plan táctico aislado del resto de la aplicación.');
const PerformancePage = lazyPlaceholder('Rendimiento', 'Métricas y tests físicos cargados bajo demanda.');

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

const ROLE_LABELS = {
  administrator: 'Administrador',
  coach: 'Entrenador',
  player: 'Jugadora'
};

function Navigation({ onNavigate, items = nav }) {
  return items.map(([to, label, Icon]) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      onClick={onNavigate}
    >
      <Icon size={19} strokeWidth={2.1} />
      <span>{label}</span>
    </NavLink>
  ));
}

function LoadingScreen() {
  return (
    <div className="boot-screen">
      <span className="brand-mark">VB</span>
      <strong>VolleyCoach Hub</strong>
      <small>Preparando tu sesión…</small>
    </div>
  );
}

export default function App() {
  const { session, identity, loading, authError, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const shellClass = useMemo(() => `app-shell${menuOpen ? ' menu-open' : ''}`, [menuOpen]);
  const pageTitle = useMemo(() => {
    const exact = nav.find(([to]) => to === location.pathname);
    return exact?.[1] || 'VolleyCoach Hub';
  }, [location.pathname]);

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginPage />;
  if (!identity && !authError) return <LoadingScreen />;

  if (!identity) {
    return (
      <main className="fatal-shell">
        <section className="page-card">
          <p className="eyebrow">Sesión iniciada</p>
          <h1>No hemos podido cargar tu perfil</h1>
          <p>{authError || 'Comprueba que el usuario tenga un perfil activo en VolleyCoach Hub.'}</p>
          <button className="primary-button" type="button" onClick={() => logout()}>Cerrar sesión</button>
        </section>
      </main>
    );
  }

  const profile = identity.profile;
  const initials = String(profile?.full_name || profile?.username || 'VB')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  async function handleLogout() {
    setMenuOpen(false);
    setProfileOpen(false);
    try { await logout(); } catch { /* la sesión local ya queda cerrada */ }
  }

  return (
    <div className={shellClass}>
      <header className="mobile-header">
        <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu /></button>
        <div className="mobile-brand"><strong>{pageTitle}</strong><span>CV Bunyola</span></div>
        <button className="avatar-button" type="button" onClick={() => setProfileOpen(true)} aria-label="Abrir mi perfil">{initials}</button>
      </header>

      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">VB</span><div><strong>VolleyCoach Hub</strong><small>CV Bunyola</small></div></div>
        <nav><Navigation onNavigate={() => setMenuOpen(false)} /></nav>
        <div className="sidebar-user">
          <button className="sidebar-profile" type="button" onClick={() => setProfileOpen(true)}>
            <span className="avatar-button">{initials}</span>
            <span><strong>{profile.full_name || profile.username}</strong><small>{ROLE_LABELS[profile.role] || profile.role}</small></span>
          </button>
          <button className="logout-button" type="button" onClick={handleLogout} aria-label="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      </aside>

      {menuOpen ? <button className="overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} /> : null}
      <aside className="mobile-drawer" aria-hidden={!menuOpen}>
        <div className="drawer-head"><strong>Menú</strong><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></button></div>
        <button className="drawer-profile" type="button" onClick={() => { setMenuOpen(false); setProfileOpen(true); }}>
          <span className="avatar-button">{initials}</span>
          <span><strong>{profile.full_name || profile.username}</strong><small>{ROLE_LABELS[profile.role] || profile.role}</small></span>
        </button>
        <nav><Navigation onNavigate={() => setMenuOpen(false)} /></nav>
        <button className="drawer-logout" type="button" onClick={handleLogout}><LogOut size={18} /> Cerrar sesión</button>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <nav className="bottom-nav" aria-label="Navegación principal móvil">
        <Navigation items={nav.slice(0, 4)} onNavigate={() => setMenuOpen(false)} />
        <button className="bottom-more" type="button" onClick={() => setMenuOpen(true)}><MoreHorizontal size={20} /><span>Más</span></button>
      </nav>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
