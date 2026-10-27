/** Verify the real local reader, exact session guard, metrics and failure states. */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
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
