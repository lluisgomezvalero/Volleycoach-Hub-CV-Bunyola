import { useState } from 'react';
import { AlertCircle, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import './LoginPage.css';

const CLUB_LOGO = `${import.meta.env.BASE_URL}../assets/club_logo.png`;
const TEAM_BACKGROUND = `${import.meta.env.BASE_URL}../assets/team_banner.jpg`;

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await login(username, password);
    } catch (nextError) {
      setError(nextError?.message || 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="current-login-shell"
      style={{ '--current-login-background': `url("${TEAM_BACKGROUND}")` }}
    >
      <section className="current-login-card" aria-labelledby="login-title">
        <header className="current-login-header">
          <img src={CLUB_LOGO} alt="Logo CV Bunyola" className="current-login-logo" />
          <h1 id="login-title">CV BUNYOLA</h1>
          <p>Hub Oficial del Equipo</p>
        </header>

        <form className="current-login-form" onSubmit={handleSubmit}>
          <label>
            <span>Usuario</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ej: admin o chidalgo"
              disabled={submitting}
              autoFocus
            />
          </label>

          <label>
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              disabled={submitting}
            />
          </label>

          {error ? (
            <div className="current-login-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          <button className="current-login-submit" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="spin" size={19} /> : null}
            {submitting ? 'Iniciando sesión…' : 'Iniciar Sesión'}
          </button>

          <div className="current-login-secure" aria-label="Conexión segura">
            <ShieldCheck size={15} />
            <span>Conexión segura</span>
          </div>
        </form>
      </section>
    </main>
  );
}
