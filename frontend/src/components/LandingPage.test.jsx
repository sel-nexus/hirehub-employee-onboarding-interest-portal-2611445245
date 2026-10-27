/** Verify the exact Home content and candidate CTA activation. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LandingPage from './LandingPage.jsx';

/** Mount Home with an observable destination owned only by this test. */
function renderHome() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/apply" element={<h1>Test Apply destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  /** Verify the exact hero, section heading, and bottom callout. */
  it('renders the exact hero and callout copy', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Build Your Future With Us$/);
    expect(screen.getByText("Join a team that values innovation, collaboration, and growth. We're looking for talented people like you.")).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Why Join Us?', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ready to take the next step?', level: 2 })).toBeVisible();
  });

  /** Verify all four independent source card descriptions and emoji placeholders. */
  it('renders exactly four cards with the supplied content', () => {
    renderHome();
    const expected = [
      ['💡', 'Innovation', 'Work on cutting-edge projects that push boundaries and shape the future of technology.'],
      ['📈', 'Career Growth', 'Clear career paths, mentorship programs, and continuous learning opportunities for every team member.'],
      ['🤝', 'Great Culture', 'A diverse, inclusive workplace where collaboration and creativity thrive every day.'],
      ['🌍', 'Global Impact', "Your work reaches millions of users worldwide, making a real difference in people's lives."],
    ];
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(4);
    expected.forEach(
      /** Compare each card to the independent expected source copy. */
      ([icon, title, description], index) => {
        const card = within(cards[index]);
        expect(card.getByRole('heading', { level: 3 })).toHaveTextContent(title);
        expect(card.getByText(description)).toBeVisible();
        expect(card.getByText(icon)).toHaveAttribute('aria-hidden', 'true');
      },
    );
  });

  /** Verify neither destination is activated simply by rendering a CTA. */
  it('stays on Home until a candidate activates a CTA', () => {
    renderHome();
    expect(screen.queryByRole('heading', { name: 'Test Apply destination' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Express Your Interest' })).toHaveAttribute('href', '/apply');
    expect(screen.getByRole('link', { name: 'Apply Now' })).toHaveAttribute('href', '/apply');
  });

  /** Verify each actual CTA activates the candidate destination. */
  it.each(['Express Your Interest', 'Apply Now'])('navigates on clicking %s', async (label) => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('link', { name: label }));
    expect(screen.getByRole('heading', { name: 'Test Apply destination' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Build Your Future With Us' })).not.toBeInTheDocument();
  });

  /** Verify native keyboard link activation remains available. */
  it('activates the hero CTA with Enter', async () => {
    const user = userEvent.setup();
    renderHome();
    screen.getByRole('link', { name: 'Express Your Interest' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Test Apply destination' })).toBeVisible();
  });
});
