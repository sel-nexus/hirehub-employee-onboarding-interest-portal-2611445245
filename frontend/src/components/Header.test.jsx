/** Verify public navigation and its route-active, event-only behavior. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Header, AUTH_EVENT, SESSION_ERROR } from './Header.jsx';

/** Expose the current route as an observable navigation outcome. */
function Location() {
  const location = useLocation();
  return (
    <output aria-label="Current route">{location.pathname}</output>
  );
}

/** Mount the real Header in a test-owned router at the requested path. */
function renderHeader(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Header />
      <Location />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  it.each([undefined, true, 1, {}, []])('denies nonstring session response %j', (value) => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(value);
    renderHeader();
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });
  it.each([null, 'false', 'True', 'TRUE', '1', 'true '])('shows Login for nonexact session %j', (value) => {
    if (value !== null) sessionStorage.setItem('hirehub_admin_auth', value);
    renderHeader();
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  it('fails closed on denied session reads', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    renderHeader();
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  it('reflects login events and removes only auth on user logout, navigating home', async () => {
    sessionStorage.setItem('unrelated', 'keep');
    localStorage.setItem('hirehub_submissions', '[]');
    renderHeader('/admin');
    act(() => {
      sessionStorage.setItem('hirehub_admin_auth', 'true');
      window.dispatchEvent(new Event(AUTH_EVENT));
    });
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('hirehub_admin_auth')).toBe('true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
    expect(sessionStorage.getItem('hirehub_admin_auth')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
    expect(localStorage.getItem('hirehub_submissions')).toBe('[]');
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  it.each(['remove', 'missing', 'getter'])('reports %s logout denial without falsely navigating home', async (mode) => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    renderHeader('/admin');
    if (mode === 'remove') vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('private'); });
    if (mode === 'missing') vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(undefined);
    if (mode === 'getter') vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('private'); });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_ERROR);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
  });
  /** Verify every public destination and the unauthenticated login link. */
  it('renders HireHub, three inline navigation links, and Login', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'HireHub' })).toHaveAttribute('href', '/');
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    expect(nav.getAllByRole('link')).toHaveLength(3);
    expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(nav.getByRole('link', { name: 'Apply' })).toHaveAttribute('href', '/apply');
    expect(nav.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/admin');
  });

  /** Verify active indication for each supported public route. */
  it.each([['/', 'Home'], ['/apply', 'Apply'], ['/admin', 'Admin']])(
    'marks only the active navigation link at %s',
    (path, activeName) => {
      renderHeader(path);
      const nav = screen.getByRole('navigation');
      expect(within(nav).getByRole('link', { name: activeName })).toHaveAttribute('aria-current', 'page');
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    },
  );

  /** Verify unknown paths never falsely highlight Home or change the route. */
  it('does not select Home for an unknown route', () => {
    renderHeader('/unknown');
    expect(screen.getByRole('navigation').querySelector('[aria-current]')).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/unknown');
  });

  /** Verify real clicks and keyboard activation update the displayed route. */
  it('navigates through Apply, Admin, Login, Home, and the brand only on activation', async () => {
    const user = userEvent.setup();
    renderHeader();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    await user.click(screen.getByRole('link', { name: 'Apply' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/apply');
    await user.click(screen.getByRole('link', { name: 'Admin' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
    await user.click(screen.getByRole('link', { name: 'Home' }));
    await user.click(screen.getByRole('link', { name: 'Login' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
    screen.getByRole('link', { name: 'HireHub' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
  });

  /** Verify mounting and rerendering cannot write or clear either storage area. */
  it('does not mutate browser data on render or rerender', () => {
    localStorage.setItem('hirehub_submissions', '[{"id":"synthetic"}]');
    sessionStorage.setItem('unrelated', 'preserve');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');
    const view = renderHeader();
    view.rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
      </MemoryRouter>,
    );
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(localStorage.getItem('hirehub_submissions')).toBe('[{"id":"synthetic"}]');
    expect(sessionStorage.getItem('unrelated')).toBe('preserve');
  });
});
