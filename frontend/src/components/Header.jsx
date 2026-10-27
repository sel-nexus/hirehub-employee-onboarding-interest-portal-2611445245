/** Provide tab-session navigation and explicit demo session transitions. */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

export const AUTH_KEY = 'hirehub_admin_auth';
export const AUTH_EVENT = 'hirehub-auth-change';
export const SESSION_ERROR = 'Browser session storage is unavailable. Please allow session storage and try again.';

/** Read the exact demo flag; deny access if session storage cannot be read.
 * @returns {boolean} Whether the current tab has the exact authorized value.
 */
export function isAdminAuthenticated() {
  try {
    return globalThis.sessionStorage?.getItem(AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Notify mounted views after an explicit session transition. */
export function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/** Remove only the auth key after user activation; report denial without navigating.
 * @returns {boolean} Whether removal completed.
 */
export function logoutAdmin() {
  try {
    if (!globalThis.sessionStorage) return false;
    globalThis.sessionStorage.removeItem(AUTH_KEY);
    notifyAuthChange();
    return true;
  } catch {
    return false;
  }
}

/** Render the sticky brand, route-active links, and demo login destination. */
export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated);
  const [error, setError] = useState('');

  useEffect(() => {
    /** Refresh tab state on route entries and explicit login/logout events. */
    const refresh = () => setAuthenticated(isAdminAuthenticated());
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    return () => window.removeEventListener(AUTH_EVENT, refresh);
  }, [location]);

  /** End the session only when storage removal succeeds. */
  function handleLogout() {
    if (!logoutAdmin()) {
      setError(SESSION_ERROR);
      return;
    }
    setError('');
    navigate('/');
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/">
          HireHub
        </Link>
        <nav aria-label="Main navigation" className="main-nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/apply">
            Apply
          </NavLink>
          <NavLink to="/admin">
            Admin
          </NavLink>
        </nav>
        {authenticated ? (
          <button className="logout-button header-logout" type="button" onClick={handleLogout}>
            Logout
          </button>
        ) : (
          <Link className="login-link" to="/admin">
            Login
          </Link>
        )}
      </div>
      {error && (
        <p className="header-session-error" role="alert">{error}</p>
      )}
    </header>
  );
}
