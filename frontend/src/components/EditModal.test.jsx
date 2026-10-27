/** Verify disposable drafts with real persistence and native-dialog test polyfills. */
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditModal from './EditModal.jsx';
import { STORAGE_KEY, updateSubmission } from '../utils/storage.js';

const row = { id: '550e8400-e29b-41d4-a716-446655440000', fullName: 'Jane Doe', email: 'Jane@example.com', mobile: '0123456789', department: 'Engineering', submittedAt: '2026-03-04T10:30:00.000Z' };

// jsdom has no native dialog methods; install test-only implementations.
HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

/** Model native opening/closing only; application focus logic remains real. */
beforeEach(() => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () { this.setAttribute('open', ''); });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () { this.removeAttribute('open'); });
  localStorage.setItem(STORAGE_KEY, JSON.stringify([row]));
});

/** Mount the dialog through an actual trigger and the real storage helper. */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open Edit</button>
      {open && (
        <EditModal submission={row} onCancel={() => setOpen(false)} onSave={(id, draft) => {
          const result = updateSubmission(id, draft);
          if (result.ok) setOpen(false);
          return result;
        }} />
      )}
    </>
  );
}

/** Activate a real trigger before testing the modal. */
async function openModal() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Open Edit' }));
  return user;
}

describe('EditModal', () => {
  it('prefills a separate draft, keeps email readonly, traps focus and restores body/trigger', async () => {
    document.body.style.overflow = 'auto';
    const user = await openModal();
    expect(screen.getByRole('dialog', { name: 'Edit Submission' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Full Name')).toHaveValue(row.fullName);
    expect(screen.getByLabelText('Full Name')).toHaveFocus();
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText('Email Address'), 'changed');
    expect(screen.getByLabelText('Email Address')).toHaveValue(row.email);
    expect(screen.getByLabelText('Mobile Number')).toHaveValue(row.mobile);
    expect(screen.getByLabelText('Department of Interest')).toHaveValue(row.department);
    expect(document.body.style.overflow).toBe('hidden');
    screen.getByLabelText('Full Name').focus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Save Changes' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Full Name')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Email Address')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Open Edit' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([row]);
  });

  it.each(['Cancel', 'Escape', 'overlay'])('discards changed draft on %s without any write', async (mode) => {
    const user = await openModal();
    const raw = localStorage.getItem(STORAGE_KEY);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    await user.clear(screen.getByLabelText('Full Name'));
    await user.type(screen.getByLabelText('Full Name'), 'Changed Person');
    if (mode === 'Cancel') await user.click(screen.getByRole('button', { name: 'Cancel' }));
    if (mode === 'Escape') fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
    if (mode === 'overlay') await user.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await user.click(screen.getByRole('button', { name: 'Open Edit' }));
    expect(screen.getByLabelText('Full Name')).toHaveValue(row.fullName);
  });

  it.each(['', 'Jane!', 'A'.repeat(101)])('rejects invalid name %j with associated errors and no write', async (name) => {
    const user = await openModal();
    await user.clear(screen.getByLabelText('Full Name'));
    if (name) await user.type(screen.getByLabelText('Full Name'), name);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('aria-describedby', 'edit-fullName-error');
    expect(screen.getByRole('alert')).toBeVisible();
    expect(set).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([row]);
  });

  it('blocks invalid mobile/department, then persists valid editable fields only', async () => {
    const user = await openModal();
    await user.clear(screen.getByLabelText('Mobile Number'));
    await user.type(screen.getByLabelText('Mobile Number'), '123abc');
    await user.selectOptions(screen.getByLabelText('Department of Interest'), '');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([row]);
    await user.clear(screen.getByLabelText('Mobile Number'));
    await user.type(screen.getByLabelText('Mobile Number'), '9876543210');
    await user.selectOptions(screen.getByLabelText('Department of Interest'), 'Design');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([{ ...row, mobile: '9876543210', department: 'Design' }]);
  });

  it.each(['read', 'write', 'quota', 'missing'])('retains draft and shows %s failure without false success', async (mode) => {
    const user = await openModal();
    await user.clear(screen.getByLabelText('Full Name'));
    await user.type(screen.getByLabelText('Full Name'), 'Jane Lee');
    let spy;
    if (mode === 'read') spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private'); });
    if (mode === 'write' || mode === 'quota') spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', mode === 'quota' ? 'QuotaExceededError' : 'Error'); });
    if (mode === 'missing') localStorage.setItem(STORAGE_KEY, '[]');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(mode === 'read' ? 'Browser storage is unavailable.' : mode === 'quota' ? 'Browser storage is full.' : mode === 'missing' ? 'The selected submission is no longer available.' : 'Your interest could not be saved.');
    expect(screen.getByLabelText('Full Name')).toHaveValue('Jane Lee');
    spy?.mockRestore();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(mode === 'missing' ? [] : [row]);
  });
});
