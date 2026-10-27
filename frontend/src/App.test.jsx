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
  it('keeps real route login visible when the session write is denied', async () => {
    const user = userEvent.setup();
    renderApp('/admin');
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Browser session storage is unavailable. Please allow session storage and try again.');
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Submissions Dashboard' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('hirehub_admin_auth')).toBeNull();
  });
  it.each([null, 'false', 'TRUE', 'true '])('renders real login at /admin for session %j without repairing records', (value) => {
    if (value !== null) sessionStorage.setItem('hirehub_admin_auth', value);
    localStorage.setItem('hirehub_submissions', '{broken');
    renderApp('/admin');
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    expect(localStorage.getItem('hirehub_submissions')).toBe('{broken');
  });

  it.each(['header', 'dashboard'])('logs in on the same route and logs out through %s preserving unrelated data', async (source) => {
    localStorage.setItem('hirehub_submissions', '[]');
    sessionStorage.setItem('unrelated', 'keep');
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Login' }));
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Submissions Dashboard' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
    const buttons = screen.getAllByRole('button', { name: 'Logout' });
    await user.click(buttons[source === 'header' ? 0 : 1]);
    expect(screen.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
    expect(sessionStorage.getItem('hirehub_admin_auth')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
    expect(localStorage.getItem('hirehub_submissions')).toBe('[]');
    await user.click(screen.getByRole('link', { name: 'Admin' }));
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  it('re-evaluates exact authorization on later route entries', async () => {
    const user = userEvent.setup();
    renderApp('/admin');
    await user.click(screen.getByRole('link', { name: 'Home' }));
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    await user.click(screen.getByRole('link', { name: 'Admin' }));
    expect(screen.getByRole('heading', { name: 'Submissions Dashboard' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Home' }));
    sessionStorage.setItem('hirehub_admin_auth', 'false');
    await user.click(screen.getByRole('link', { name: 'Admin' }));
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });
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
  it.each(['/unknown/deep', '/application'])('renders ordinary Not Found at %s without mutations', (path) => {
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
    expect(screen.getByRole('heading', { name: 'Join Our Team' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Submit Application' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Apply' })).toHaveAttribute('aria-current', 'page');
    expect(localStorage.getItem('hirehub_submissions')).toBe('[]');
    expect(sessionStorage.length).toBe(0);
  });

  /** Verify direct Apply entry leaves even corrupt storage untouched until submission. */
  it('renders the real Apply form without reading or repairing data and returns Home', async () => {
    localStorage.setItem('hirehub_submissions', '{broken');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    renderApp('/apply');
    expect(screen.getByLabelText('Full Name')).toBeVisible();
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Mobile Number')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText('Department of Interest')).toBeVisible();
    expect(set).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: '← Back to Home' }));
    expect(screen.getByRole('heading', { name: 'Build Your Future With Us' })).toBeVisible();
    expect(localStorage.getItem('hirehub_submissions')).toBe('{broken');
  });
});
