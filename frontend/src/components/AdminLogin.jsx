/** Offer the deliberately local, hardcoded demo login on explicit submission. */
import { useState } from 'react';
import { AUTH_KEY, notifyAuthChange, SESSION_ERROR } from './Header.jsx';

/** Render credentials and report invalid input or denied session persistence.
 * @returns {JSX.Element} Accessible demo login form.
 */
export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  /** Authenticate only exact submitted credentials and only after a committed write.
   * @param {object} event - User form submission.
   */
  function handleSubmit(event) {
    event.preventDefault();
    if (username !== 'admin' || password !== 'admin') {
      setError('Invalid credentials. Please try again.');
      return;
    }
    try {
      if (!globalThis.sessionStorage) throw new Error('Session unavailable');
      globalThis.sessionStorage.setItem(AUTH_KEY, 'true');
      if (globalThis.sessionStorage.getItem(AUTH_KEY) !== 'true') throw new Error('Session not committed');
    } catch {
      setError(SESSION_ERROR);
      return;
    }
    setError('');
    notifyAuthChange();
  }

  return (
    <section className="admin-login-page">
      <div className="interest-card admin-login-card">
        <h1>Admin Login</h1>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="admin-username">Username</label>
            <input id="admin-username" placeholder="Enter username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} aria-required="true" aria-invalid={Boolean(error)} aria-describedby={error ? 'admin-login-error' : undefined} />
          </div>
          <div className="form-field">
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" placeholder="Enter password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-required="true" aria-invalid={Boolean(error)} aria-describedby={error ? 'admin-login-error' : undefined} />
          </div>
          <button className="submit-button" type="submit">Login</button>
        </form>
        {error && (
          <p id="admin-login-error" className="field-error" role="alert">{error}</p>
        )}
      </div>
    </section>
  );
}
