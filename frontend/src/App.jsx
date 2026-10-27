/** Compose the implemented Home and Apply routes with a nonmutating fallback. */
import { Link, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header.jsx';
import LandingPage from './components/LandingPage.jsx';
import InterestForm from './components/InterestForm.jsx';

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

/** Render the shared shell without reading or writing candidate/session data. */
export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/apply" element={<InterestForm />} />
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
