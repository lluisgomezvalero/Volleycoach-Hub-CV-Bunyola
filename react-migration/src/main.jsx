import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import WeeklyTeamWellness from './components/WeeklyTeamWellness.jsx';
import TodayWellnessAlerts from './components/TodayWellnessAlerts.jsx';
import WellnessPlayerCheckin from './components/WellnessPlayerCheckin.jsx';
import CalendarSwipeEnhancer from './components/CalendarSwipeEnhancer.jsx';
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
        <WeeklyTeamWellness />
        <TodayWellnessAlerts />
        <WellnessPlayerCheckin />
        <CalendarSwipeEnhancer />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
