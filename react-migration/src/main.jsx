import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import WeeklyTeamWellness from './components/WeeklyTeamWellness.jsx';
import TodayWellnessAlerts from './components/TodayWellnessAlerts.jsx';
import WellnessPlayerCheckin from './components/WellnessPlayerCheckin.jsx';
import CalendarSwipeEnhancer from './components/CalendarSwipeEnhancer.jsx';
import TrainingPlayerRpeBreakdown from './components/TrainingPlayerRpeBreakdown.jsx';
import CrossAccountIdentitySync from './components/CrossAccountIdentitySync.jsx';
import TrainingAttendanceSyncBoundary from './components/TrainingAttendanceSyncBoundary.jsx';
import './styles.css';
import './theme.css';
import './pages/HomePolish.css';
import './pages/TrainingPolish.css';
import './pages/CalendarPolish.css';
import './pages/TeamAttendanceProfessional.css';
import './pages/WellnessMobileFix.css';
import './pages/WellnessPolish.css';
import './pages/RosterPolish.css';
import './pages/StatisticsPolish.css';
import './pages/CompetitionPolish.css';
import './pages/GamePlanPolish.css';
import './pages/PerformancePolish.css';
import './FinalPolish.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <TrainingAttendanceSyncBoundary>
          <App />
        </TrainingAttendanceSyncBoundary>
        <WeeklyTeamWellness />
        <TodayWellnessAlerts />
        <WellnessPlayerCheckin />
        <CalendarSwipeEnhancer />
        <TrainingPlayerRpeBreakdown />
        <CrossAccountIdentitySync />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
