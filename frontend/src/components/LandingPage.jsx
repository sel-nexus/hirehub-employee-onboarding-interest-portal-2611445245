/** Present the supplied opportunity copy and candidate navigation actions. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: '💡',
    title: 'Innovation',
    description: 'Work on cutting-edge projects that push boundaries and shape the future of technology.',
  },
  {
    icon: '📈',
    title: 'Career Growth',
    description: 'Clear career paths, mentorship programs, and continuous learning opportunities for every team member.',
  },
  {
    icon: '🤝',
    title: 'Great Culture',
    description: 'A diverse, inclusive workplace where collaboration and creativity thrive every day.',
  },
  {
    icon: '🌍',
    title: 'Global Impact',
    description: "Your work reaches millions of users worldwide, making a real difference in people's lives.",
  },
];

/** Render one noninteractive culture card with decorative emoji. */
function FeatureCard({ icon, title, description }) {
  return (
    <article className="feature-card">
      <span className="feature-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

FeatureCard.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
};

/** Render Home with two real links to the candidate route. */
export default function LandingPage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <h1 id="hero-title">Build Your Future With Us</h1>
          <p>
            Join a team that values innovation, collaboration, and growth. We're looking for talented people like you.
          </p>
          <Link className="cta-link" to="/apply">
            Express Your Interest
          </Link>
        </div>
      </section>
      <section className="features landing-container" aria-labelledby="features-title">
        <h2 id="features-title">Why Join Us?</h2>
        <div className="feature-grid">
          {features.map(
            /** Render each supplied card using its stable title as identity. */
            (feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ),
          )}
        </div>
      </section>
      <section className="bottom-cta" aria-labelledby="next-step-title">
        <h2 id="next-step-title">Ready to take the next step?</h2>
        <Link className="cta-link" to="/apply">
          Apply Now
        </Link>
      </section>
    </>
  );
}
