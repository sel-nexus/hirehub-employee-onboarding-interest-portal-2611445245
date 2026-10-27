/** Compose public routes and the local demo admin gate with a nonmutating fallback. */
import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Header, AUTH_EVENT, isAdminAuthenticated } from './components/Header.jsx';
import LandingPage from './components/LandingPage.jsx';
import InterestForm from './components/InterestForm.jsx';
import AdminLogin from './components/AdminLogin.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';

/** Re-evaluate tab authorization on route entries and explicit session events. */
function AdminGate() {
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated);
  useEffect(() => {
    /** Refresh the exact guard without changing session storage. */
    const refresh = () => setAuthenticated(isAdminAuthenticated());
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    return () => window.removeEventListener(AUTH_EVENT, refresh);
  }, [location]);
  return authenticated && isAdminAuthenticated() ? <AdminDashboard /> : <AdminLogin />;
}

/** Offer a truthful missing-page state without simulating unfinished forms. */
function NotFound() {
  return (
    <section className="not-found landing-container">
      <h1>Not Found</h1>
      <p>The page you requested is not available.</p>
      <Link to="/">Back to Home</Link>
    </section>
  );
}

/** Render the shared shell with a nonmutating tab-session gate. */
export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/apply" element={<InterestForm />} />
          <Route path="/admin" element={<AdminGate />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="demo-notice">
        <p>
          Browser-only demo. Data stays in this browser and is not sent to a centralized hiring system.
          Demo admin access is not real authentication.
        </p>
      </footer>
    </>
  );
}
