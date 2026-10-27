/** Provide persistent public navigation without changing browser data. */
import { Link, NavLink } from 'react-router-dom';

/** Render the sticky brand, route-active links, and demo login destination. */
export function Header() {
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
        <Link className="login-link" to="/admin">
          Login
        </Link>
      </div>
    </header>
  );
}
