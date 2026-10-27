/** Verify read-only table order, capacity, escaped strings and damaged dates. */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmissionTable, { formatSubmissionDate, submissionTime } from './SubmissionTable.jsx';

const row = { id: 'synthetic', fullName: 'Test Person', email: 'test@example.com', mobile: '0123456789', department: 'Engineering', submittedAt: '2026-03-04T10:30:00.000Z' };

describe('SubmissionTable', () => {
  it('shows the exact empty state without invented actions', () => {
    render(<SubmissionTable submissions={[]} />);
    expect(screen.getByText('No submissions yet.')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders exact column and record order with escaped markup and no mutations', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const records = [row, { ...row, id: 'second', fullName: malicious, submittedAt: 'damaged' }];
    const original = JSON.stringify(records);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<SubmissionTable submissions={records} />);
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['#', 'Full Name', 'Email', 'Mobile', 'Department', 'Submitted On', 'Actions']);
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['1', 'Test Person', 'test@example.com', '0123456789', 'Engineering', 'Mar 4, 2026', '—']);
    expect(within(rows[2]).getByText(malicious)).toBeVisible();
    expect(view.container.querySelector('img')).toBeNull();
    expect(within(rows[2]).getByText('N/A')).toBeVisible();
    expect(screen.getAllByText('Engineering')[0]).toHaveClass('department-badge');
    expect(screen.getByRole('region', { name: 'Submissions' })).toHaveAttribute('tabindex', '0');
    view.rerender(<SubmissionTable submissions={records} />);
    expect(JSON.stringify(records)).toBe(original);
    expect(set).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders all 200 rows with final numbering and preserves input order', () => {
    const records = Array.from({ length: 200 }, (_, index) => ({ ...row, id: String(index), email: `test${index}@example.com` }));
    render(<SubmissionTable submissions={records} />);
    expect(screen.getAllByRole('row')).toHaveLength(201);
    expect(within(screen.getAllByRole('row')[200]).getAllByRole('cell')[0]).toHaveTextContent(/^200$/);
    expect(screen.getByText('test199@example.com')).toBeVisible();
  });

  it.each([undefined, null, 0, true, {}, [], '', 'broken', '2026-02-30T10:30:00.000Z', '2026-13-04T10:30:00.000Z'])('presents damaged date %j as unavailable without coercion', (value) => {
    expect(submissionTime(value)).toBeNaN();
    expect(formatSubmissionDate(value)).toBe('N/A');
  });

  it('formats canonical dates consistently including leap days and UTC midnight', () => {
    expect(submissionTime(row.submittedAt)).toBe(Date.parse(row.submittedAt));
    expect(formatSubmissionDate('2024-02-29T00:00:00.000Z')).toBe('Feb 29, 2024');
    expect(formatSubmissionDate('2026-03-04T00:00:00.000Z')).toBe('Mar 4, 2026');
  });
});
