/** Verify the implemented route shell, truthful fallback, and storage safety. */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

/** Mount the shell with Strict Mode so repeat renders exercise safety. */
function renderApp(path = '/') {
  return render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    </React.StrictMode>,
  );
}

describe('App', () => {
  /** Verify Home includes the shared shell, skip link, and honest demo limitation. */
  it('renders Home and the browser-only demo notice', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Browser-only demo. Data stays in this browser and is not sent to a centralized hiring system. Demo admin access is not real authentication.');
  });

  /** Verify unfinished routes are not represented as functioning forms. */
  it.each(['/apply', '/admin', '/unknown/deep', '/application'])('renders ordinary Not Found at %s without mutations', (path) => {
    localStorage.setItem('hirehub_submissions', '{broken synthetic data');
    localStorage.setItem('unrelated', 'preserve-local');
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    sessionStorage.setItem('unrelated', 'preserve-session');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');
    renderApp(path);
    expect(screen.getByRole('heading', { name: 'Not Found' })).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(localStorage.getItem('hirehub_submissions')).toBe('{broken synthetic data');
    expect(localStorage.getItem('unrelated')).toBe('preserve-local');
    expect(sessionStorage.getItem('hirehub_admin_auth')).toBe('true');
    expect(sessionStorage.getItem('unrelated')).toBe('preserve-session');
  });

  /** Verify the missing-page recovery link returns to the real Home route. */
  it('returns Home from the unknown-route fallback', async () => {
    const user = userEvent.setup();
    renderApp('/unknown');
    await user.click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(screen.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  /** Verify CTA wiring through App without performing candidate data writes. */
  it.each(['Express Your Interest', 'Apply Now'])('activates %s through the real route shell', async (name) => {
    const user = userEvent.setup();
    localStorage.setItem('hirehub_submissions', '[]');
    renderApp();
    await user.click(screen.getByRole('link', { name }));
    expect(screen.getByRole('heading', { name: 'Not Found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Apply' })).toHaveAttribute('aria-current', 'page');
    expect(localStorage.getItem('hirehub_submissions')).toBe('[]');
    expect(sessionStorage.length).toBe(0);
  });
});
