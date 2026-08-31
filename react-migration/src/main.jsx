import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import WeeklyTeamWellness from './components/WeeklyTeamWellness.jsx';
import TodayWellnessAlerts from './components/TodayWellnessAlerts.jsx';
import WellnessPlayerCheckin from './components/WellnessPlayerCheckin.jsx';
import './styles.css';
import './theme.css';
import './pages/HomePolish.css';
import './pages/TrainingPolish.css';
import './pages/TeamAttendanceProfessional.css';
import './pages/WellnessMobileFix.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
        <WeeklyTeamWellness />
        <TodayWellnessAlerts />
        <WellnessPlayerCheckin />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
