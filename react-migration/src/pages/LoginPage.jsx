import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="login-mark" aria-hidden="true">VB</span>
          <div>
            <strong>VolleyCoach Hub</strong>
            <span>CV Bunyola · Cadete Femenino</span>
          </div>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Nueva app React</p>
          <h1 id="login-title">Bienvenido/a</h1>
          <p>Accede con el mismo usuario y contraseña de la aplicación actual.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Usuario</span>
            <div className="field-with-icon">
              <UserRound size={18} />
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Tu usuario"
                disabled={submitting}
              />
            </div>
          </label>

          <label>
            <span>Contraseña</span>
            <div className="field-with-icon password-field">
              <LockKeyhole size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                disabled={submitting}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="primary-button login-submit" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="spin" size={19} /> : null}
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="login-footnote">Sesión persistente · Supabase Auth · Sin parches del DOM</p>
      </section>
    </main>
  );
}
