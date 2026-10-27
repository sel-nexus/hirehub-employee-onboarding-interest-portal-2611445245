/** Verify exact user-submitted credentials and fail-closed session writes. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdminLogin from './AdminLogin.jsx';
import { AUTH_EVENT, AUTH_KEY, SESSION_ERROR } from './Header.jsx';

/** Enter proposed credentials without submitting them. */
async function enterCredentials(username, password) {
  const user = userEvent.setup();
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  return user;
}

describe('AdminLogin', () => {
  it('renders accessible placeholders, masks password, and never logs in on typing or rerender', async () => {
    const view = render(<AdminLogin />);
    expect(screen.getByPlaceholderText('Enter username')).toBeVisible();
    expect(screen.getByPlaceholderText('Enter password')).toHaveAttribute('type', 'password');
    await enterCredentials('admin', 'admin');
    view.rerender(<AdminLogin />);
    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([['', ''], ['Admin', 'admin'], ['admin', 'Admin'], ['admin ', 'admin'], ['admin', ' admin'], ['wrong', 'wrong']])(
    'rejects nonexact credentials %j/%j without mutations', async (username, password) => {
      render(<AdminLogin />);
      const user = await enterCredentials(username, password);
      const set = vi.spyOn(Storage.prototype, 'setItem');
      await user.click(screen.getByRole('button', { name: 'Login' }));
      expect(screen.getByRole('alert')).toHaveTextContent(/^Invalid credentials\. Please try again\.$/);
      expect(screen.getByLabelText('Username')).toHaveAttribute('aria-describedby', 'admin-login-error');
      expect(set).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
    },
  );

  it('commits only the auth flag and emits the same-tab event on explicit submit', async () => {
    sessionStorage.setItem('unrelated', 'keep');
    localStorage.setItem('hirehub_submissions', '[]');
    render(<AdminLogin />);
    const user = await enterCredentials('admin', 'admin');
    const listener = vi.fn();
    window.addEventListener(AUTH_EVENT, listener);
    try {
      await user.click(screen.getByRole('button', { name: 'Login' }));
      expect(sessionStorage.getItem(AUTH_KEY)).toBe('true');
      expect(sessionStorage.getItem('unrelated')).toBe('keep');
      expect(localStorage.getItem('hirehub_submissions')).toBe('[]');
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(AUTH_EVENT, listener);
    }
  });

  it.each(['throw', 'missing', 'getter', 'uncommitted'])('fails closed on %s session persistence', async (mode) => {
    render(<AdminLogin />);
    const user = await enterCredentials('admin', 'admin');
    if (mode === 'throw') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private details', 'SecurityError'); });
    if (mode === 'missing') vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(undefined);
    if (mode === 'getter') vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('private details'); });
    if (mode === 'uncommitted') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_ERROR);
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Password')).toHaveValue('admin');
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.queryByText('private details')).not.toBeInTheDocument();
  });
});
