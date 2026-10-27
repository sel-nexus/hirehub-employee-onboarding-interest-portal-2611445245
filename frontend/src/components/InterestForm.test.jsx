/** Exercise the real form and storage through accessible user actions. */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InterestForm from './InterestForm.jsx';
import { DEPARTMENTS } from '../utils/validators.js';
import { getSubmissions, STORAGE_KEY } from '../utils/storage.js';

/** Mount with Strict Mode to expose accidental render effects. */
function mount() {
  return render(
    <React.StrictMode>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InterestForm />
      </MemoryRouter>
    </React.StrictMode>,
  );
}

/** Enter a full candidate draft using the visible labels. */
function fill(email = 'Jane@Example.com') {
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Jane Doe' } });
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '0123456789' } });
  fireEvent.change(screen.getByLabelText('Department of Interest'), { target: { value: 'Engineering' } });
}

/** Activate the form's submit button. */
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Submit Application' }));
}

afterEach(() => vi.useRealTimers());

describe('InterestForm', () => {
  it('renders exact copy, field types, constraints and options without reading or writing', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const view = mount();
    expect(screen.getByRole('heading', { name: 'Join Our Team' })).toBeVisible();
    expect(screen.getByText('Express your interest in working with us.')).toBeVisible();
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('maxlength', '100');
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Mobile Number')).toHaveAttribute('type', 'tel');
    for (const label of ['Full Name', 'Email Address', 'Mobile Number', 'Department of Interest']) {
      expect(screen.getByLabelText(label)).toBeRequired();
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
    }
    expect(screen.getAllByRole('option').slice(1).map((option) => option.textContent)).toEqual(DEPARTMENTS);
    expect(screen.getByRole('link', { name: '← Back to Home' })).toHaveAttribute('href', '/');
    view.rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InterestForm />
      </MemoryRouter>,
    );
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it('associates inline errors with every empty field and never writes', async () => {
    const user = userEvent.setup();
    mount();
    const set = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('button', { name: 'Submit Application' }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    for (const label of ['Full Name', 'Email Address', 'Mobile Number', 'Department of Interest']) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveAttribute('role', 'alert');
      expect(field.nextElementSibling.id).toBe(field.getAttribute('aria-describedby'));
    }
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it.each([['Full Name', 'Jane!'], ['Full Name', ' '.repeat(5)], ['Full Name', 'A'.repeat(101)], ['Email Address', 'bad'], ['Mobile Number', '123456789'], ['Mobile Number', '12345678901'], ['Mobile Number', '12345abcde'], ['Department of Interest', '']])('retains invalid %s input %s and does not write', (label, value) => {
    mount();
    fill();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const set = vi.spyOn(Storage.prototype, 'setItem');
    submit();
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('saves a full user-entered draft, clears fields/errors and expires success at exactly 4000ms', async () => {
    const user = userEvent.setup();
    mount();
    submit();
    await user.type(screen.getByLabelText('Full Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email Address'), 'Jane@Example.com');
    await user.type(screen.getByLabelText('Mobile Number'), '0123456789');
    await user.selectOptions(screen.getByLabelText('Department of Interest'), 'Design');
    vi.useFakeTimers();
    submit();
    const rows = getSubmissions().value;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fullName: 'Jane Doe', email: 'Jane@Example.com', mobile: '0123456789', department: 'Design' });
    expect(Object.keys(rows[0])).toHaveLength(6);
    expect(screen.getByRole('status')).toHaveTextContent('Thank you! Your interest has been submitted successfully.');
    for (const label of ['Full Name', 'Email Address', 'Mobile Number', 'Department of Interest']) expect(screen.getByLabelText(label)).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByRole('status')).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('restarts the timer for a second successful submit and cleans up on unmount', () => {
    vi.useFakeTimers();
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    const cancel = vi.spyOn(globalThis, 'clearTimeout');
    const view = mount();
    fill();
    submit();
    act(() => vi.advanceTimersByTime(3000));
    fill('second@example.com');
    submit();
    const bannerTimers = schedule.mock.calls.flatMap((call, index) => call[1] === 4000 ? [schedule.mock.results[index].value] : []);
    expect(cancel).toHaveBeenCalledWith(bannerTimers.at(-2));
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByRole('status')).toBeVisible();
    expect(getSubmissions().value).toHaveLength(2);
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(bannerTimers.at(-1));
  });
  it('rejects a normalized duplicate inline, retains draft and cancels prior success timer', () => {
    vi.useFakeTimers();
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    const cancel = vi.spyOn(globalThis, 'clearTimeout');
    mount();
    fill();
    submit();
    const before = localStorage.getItem(STORAGE_KEY);
    fill('jane@example.COM');
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent('This email has already been submitted.');
    expect(screen.getByLabelText('Email Address')).toHaveValue('jane@example.COM');
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('aria-invalid', 'true');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const index = schedule.mock.calls.findLastIndex((call) => call[1] === 4000);
    expect(cancel).toHaveBeenCalledWith(schedule.mock.results[index].value);
  });
  it.each(['SecurityError', 'QuotaExceededError', 'Error'])('retains full draft and allows user retry after %s write failure', (name) => {
    mount();
    fill();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', name); });
    submit();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByLabelText('Full Name')).toHaveValue('Jane Doe');
    expect(screen.getByLabelText('Email Address')).toHaveValue('Jane@Example.com');
    expect(screen.getByLabelText('Mobile Number')).toHaveValue('0123456789');
    expect(screen.getByLabelText('Department of Interest')).toHaveValue('Engineering');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Application' })).toBeEnabled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    set.mockRestore();
    submit();
    expect(getSubmissions().value).toHaveLength(1);
    expect(screen.getByRole('status')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('reports read denial without attempting a write or clearing fields', () => {
    mount();
    fill();
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('private', 'SecurityError'); });
    const set = vi.spyOn(Storage.prototype, 'setItem');
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent('Browser storage is unavailable.');
    expect(screen.getByLabelText('Full Name')).toHaveValue('Jane Doe');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(set).not.toHaveBeenCalled();
    get.mockRestore();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
