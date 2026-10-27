/** Verify the real local reader, exact session guard, metrics and failure states. */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard, { submissionMetrics } from './AdminDashboard.jsx';
import { SESSION_ERROR } from './Header.jsx';

/** Build a valid, synthetic persisted row in stored order. */
function makeRow(index, department = 'Engineering', submittedAt = '2026-03-04T10:30:00.000Z') {
  return { id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, fullName: 'Test Person', email: `test${index}@example.com`, mobile: '0123456789', department, submittedAt };
}

/** Mount the guarded view without bypassing its own authorization. */
function dashboard() {
  return render(
    <React.StrictMode>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminDashboard />
      </MemoryRouter>
    </React.StrictMode>,
  );
}

/** Read the visible value associated with a metric label. */
function metric(label) {
  return screen.getByText(label).parentElement.querySelector('strong').textContent;
}

describe('AdminDashboard', () => {
  it('excludes damaged date types from latest metrics without modifying records', () => {
    const records = [makeRow(1), ...[null, 0, true, {}, [], 'broken', '2026-02-30T00:00:00.000Z'].map((date, index) => makeRow(index + 2, 'Design', date))];
    const raw = JSON.stringify(records);
    expect(submissionMetrics(records)).toEqual({ total: 8, departments: 2, latest: 'Mar 4, 2026' });
    expect(JSON.stringify(records)).toBe(raw);
    expect(submissionMetrics([makeRow(1, 'Design', null)])).toEqual({ total: 1, departments: 1, latest: 'N/A' });
    expect(submissionMetrics([])).toEqual({ total: 0, departments: 0, latest: 'N/A' });
    expect(submissionMetrics([{ ...makeRow(1), submittedAt: undefined }]).latest).toBe('N/A');
  });
  it.each([null, '', 'false', 'TRUE', 'True', '1', 'true ', '{}'])('denies session %j before reading or exposing records', (value) => {
    if (value !== null) sessionStorage.setItem('hirehub_admin_auth', value);
    localStorage.setItem('hirehub_submissions', '{broken private data');
    const get = vi.spyOn(Storage.prototype, 'getItem');
    dashboard();
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    expect(screen.queryByText('Submissions Dashboard')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([key]) => key === 'hirehub_submissions')).toBe(false);
    expect(localStorage.getItem('hirehub_submissions')).toBe('{broken private data');
  });

  it('fails closed when session access is denied', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    dashboard();
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  it('loads real records, derives unique departments and newest date, and never rewrites healthy data', () => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    const records = [makeRow(1), makeRow(2, 'Design', '2026-05-01T10:30:00.000Z'), makeRow(3, 'Engineering', '2025-01-01T10:30:00.000Z')];
    const raw = JSON.stringify(records);
    localStorage.setItem('hirehub_submissions', raw);
    sessionStorage.setItem('unrelated', 'keep');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');
    const view = dashboard();
    expect(metric('Total Submissions')).toBe('3');
    expect(metric('Departments')).toBe('2');
    expect(metric('Latest Submission')).toBe('May 1, 2026');
    expect(within(screen.getAllByRole('row')[1]).getByText('test1@example.com')).toBeVisible();
    view.rerender(
      <React.StrictMode>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </React.StrictMode>,
    );
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(localStorage.getItem('hirehub_submissions')).toBe(raw);
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });

  it.each([null, '[]'])('shows zero metrics and N/A for empty storage %j', (raw) => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    if (raw !== null) localStorage.setItem('hirehub_submissions', raw);
    dashboard();
    expect(metric('Total Submissions')).toBe('0');
    expect(metric('Departments')).toBe('0');
    expect(metric('Latest Submission')).toBe('N/A');
    expect(screen.getByText('No submissions yet.')).toBeVisible();
  });

  it.each(['{broken', '{}', '[null]', JSON.stringify([makeRow(1, 'Design', 'damaged')])])('uses the real storage recovery for malformed data %s', (raw) => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    localStorage.setItem('hirehub_submissions', raw);
    dashboard();
    expect(localStorage.getItem('hirehub_submissions')).toBe('[]');
    expect(screen.getByText('No submissions yet.')).toBeVisible();
  });

  it.each(['read', 'repair'])('shows %s failure instead of false empty success', (mode) => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    localStorage.setItem('hirehub_submissions', '{broken');
    if (mode === 'read') {
      const original = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
        if (key === 'hirehub_submissions') throw new DOMException('private', 'SecurityError');
        return original.call(this, key);
      });
    } else {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', 'QuotaExceededError'); });
    }
    dashboard();
    expect(screen.getByRole('alert')).toHaveTextContent(mode === 'read' ? 'Browser storage is unavailable. Please allow local storage and try again.' : 'Browser storage is full. Please free up space and try again.');
    expect(screen.queryByText('No submissions yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Submissions')).not.toBeInTheDocument();
  });

  it('reviews 200 real valid records and all represented departments', () => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    localStorage.setItem('hirehub_submissions', JSON.stringify(Array.from({ length: 200 }, (_, index) => makeRow(index, index % 2 ? 'Design' : 'Engineering'))));
    dashboard();
    expect(metric('Total Submissions')).toBe('200');
    expect(metric('Departments')).toBe('2');
    expect(screen.getAllByRole('row')).toHaveLength(201);
  });

  it('does not reveal the loaded snapshot after the session becomes wrong on rerender', () => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    localStorage.setItem('hirehub_submissions', JSON.stringify([makeRow(1)]));
    const view = dashboard();
    sessionStorage.setItem('hirehub_admin_auth', 'false');
    view.rerender(
      <React.StrictMode>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </React.StrictMode>,
    );
    expect(screen.queryByText('test1@example.com')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  it('reports denied dashboard logout and preserves the session and data', async () => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    localStorage.setItem('hirehub_submissions', JSON.stringify([makeRow(1)]));
    const raw = localStorage.getItem('hirehub_submissions');
    dashboard();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('private'); });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_ERROR);
    expect(sessionStorage.getItem('hirehub_admin_auth')).toBe('true');
    expect(localStorage.getItem('hirehub_submissions')).toBe(raw);
  });
});

// Supply only missing native dialog methods in jsdom, not application storage mocks.
HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

describe('dashboard maintenance', () => {
  beforeEach(() => {
    sessionStorage.setItem('hirehub_admin_auth', 'true');
    localStorage.setItem('hirehub_submissions', JSON.stringify([makeRow(1), makeRow(2)]));
  });
  it('opens on activation, cancels without writing, then saves and refreshes real records/metrics', async () => {
    const user = userEvent.setup();
    dashboard();
    const original = JSON.parse(localStorage.getItem('hirehub_submissions'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await user.clear(screen.getByLabelText('Full Name'));
    await user.type(screen.getByLabelText('Full Name'), 'Changed Person');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(JSON.parse(localStorage.getItem('hirehub_submissions'))).toEqual(original);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await user.clear(screen.getByLabelText('Full Name'));
    await user.type(screen.getByLabelText('Full Name'), 'Changed Person');
    await user.selectOptions(screen.getByLabelText('Department of Interest'), 'Design');
    // A newer unrelated row must survive the save and appear in the refreshed view.
    localStorage.setItem('hirehub_submissions', JSON.stringify([...original, makeRow(3)]));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const persisted = JSON.parse(localStorage.getItem('hirehub_submissions'));
    expect(persisted).toEqual([{ ...original[0], fullName: 'Changed Person', department: 'Design' }, original[1], makeRow(3)]);
    expect(screen.getByRole('cell', { name: 'Changed Person' })).toBeVisible();
    expect(metric('Total Submissions')).toBe('3');
    expect(metric('Departments')).toBe('2');
  });
  it.each([false, undefined, 'true', true])('deletes only on strictly affirmative confirmation %j', async (answer) => {
    dashboard();
    const original = JSON.parse(localStorage.getItem('hirehub_submissions'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(answer);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete this submission?');
    expect(JSON.parse(localStorage.getItem('hirehub_submissions'))).toEqual(answer === true ? [original[1]] : original);
    if (answer !== true) expect(set).not.toHaveBeenCalled();
    expect(metric('Total Submissions')).toBe(answer === true ? '1' : '2');
  });
  it.each(['edit', 'delete'])('refreshes missing target on %s and retains its error', async (action) => {
    const user = userEvent.setup();
    dashboard();
    if (action === 'edit') await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    localStorage.setItem('hirehub_submissions', JSON.stringify([makeRow(2)]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(action === 'edit' ? screen.getByRole('button', { name: 'Save Changes' }) : screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('The selected submission is no longer available.');
    expect(metric('Total Submissions')).toBe('1');
    expect(screen.queryByRole('cell', { name: 'test1@example.com' })).not.toBeInTheDocument();
    if (action === 'edit') expect(screen.getByRole('dialog')).toBeVisible();
    expect(JSON.parse(localStorage.getItem('hirehub_submissions'))).toEqual([makeRow(2)]);
  });
  it.each(['edit', 'delete'])('blocks %s after session revocation before activation', async (action) => {
    dashboard();
    const raw = localStorage.getItem('hirehub_submissions');
    sessionStorage.setItem('hirehub_admin_auth', 'TRUE');
    const confirm = vi.spyOn(window, 'confirm');
    await userEvent.setup().click(screen.getAllByRole('button', { name: action === 'edit' ? 'Edit' : 'Delete' })[0]);
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
    expect(localStorage.getItem('hirehub_submissions')).toBe(raw);
  });
  it('rechecks session after confirmation and before edit-save', async () => {
    dashboard();
    const raw = localStorage.getItem('hirehub_submissions');
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      sessionStorage.setItem('hirehub_admin_auth', 'false');
      return true;
    });
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(localStorage.getItem('hirehub_submissions')).toBe(raw);
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });
  it('blocks saving an already open modal after session revocation', async () => {
    dashboard();
    const raw = localStorage.getItem('hirehub_submissions');
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    sessionStorage.removeItem('hirehub_admin_auth');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    expect(localStorage.getItem('hirehub_submissions')).toBe(raw);
  });
  it.each(['edit', 'delete'].flatMap((action) => ['read', 'write', 'quota'].map((mode) => [action, mode])))('retains real state and visible error on %s %s denial', async (action, mode) => {
    dashboard();
    const user = userEvent.setup();
    const original = JSON.parse(localStorage.getItem('hirehub_submissions'));
    if (action === 'edit') await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let spy;
    if (mode === 'read') {
      const get = Storage.prototype.getItem;
      spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
        if (key === 'hirehub_submissions') throw new Error('private');
        return get.call(this, key);
      });
    } else {
      spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', mode === 'quota' ? 'QuotaExceededError' : 'Error'); });
    }
    await user.click(action === 'edit' ? screen.getByRole('button', { name: 'Save Changes' }) : screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(mode === 'read' ? 'Browser storage is unavailable.' : mode === 'quota' ? 'Browser storage is full.' : 'Your interest could not be saved.');
    if (action === 'edit') expect(screen.getByRole('dialog')).toBeVisible();
    spy.mockRestore();
    expect(JSON.parse(localStorage.getItem('hirehub_submissions'))).toEqual(original);
    expect(screen.queryByText('No submissions yet.')).not.toBeInTheDocument();
  });
  it.each(['edit', 'delete'])('reports readback failure after a committed %s rather than false success', async (action) => {
    dashboard();
    const user = userEvent.setup();
    if (action === 'edit') await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const get = Storage.prototype.getItem;
    let reads = 0;
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'hirehub_submissions' && ++reads > 1) throw new Error('private');
      return get.call(this, key);
    });
    await user.click(action === 'edit' ? screen.getByRole('button', { name: 'Save Changes' }) : screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Browser storage is unavailable.');
    expect(screen.queryByText('No submissions yet.')).not.toBeInTheDocument();
    if (action === 'edit') expect(screen.getByRole('dialog')).toBeVisible();
    spy.mockRestore();
    expect(JSON.parse(localStorage.getItem('hirehub_submissions'))).toEqual(action === 'edit' ? [makeRow(1), makeRow(2)] : [makeRow(2)]);
  });
});

 it('invalid dashboard edit never writes or changes metrics and keeps draft visible', async () => {
   sessionStorage.setItem('hirehub_admin_auth', 'true');
   const records = [makeRow(1), makeRow(2)];
   localStorage.setItem('hirehub_submissions', JSON.stringify(records));
   dashboard();
   const user = userEvent.setup();
   await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
   await user.clear(screen.getByLabelText('Full Name'));
   await user.type(screen.getByLabelText('Full Name'), 'Not.Valid');
   const set = vi.spyOn(Storage.prototype, 'setItem');
   await user.click(screen.getByRole('button', { name: 'Save Changes' }));
   expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('only letters and spaces');
   expect(set).not.toHaveBeenCalled();
   expect(JSON.parse(localStorage.getItem('hirehub_submissions'))).toEqual(records);
   expect(metric('Total Submissions')).toBe('2');
 });
