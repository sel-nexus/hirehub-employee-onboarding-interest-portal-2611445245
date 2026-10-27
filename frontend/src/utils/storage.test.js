/** Verify persistence through real browser state readback and injected storage failures. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, addSubmission, getSubmissions, isEmailDuplicate, saveSubmissions, updateSubmission, deleteSubmission } from './storage.js';

const input = { fullName: ' Jane Doe ', email: ' Jane@Example.com ', mobile: '0123456789', department: 'Engineering' };
const row = { id: '550e8400-e29b-41d4-a716-446655440000', ...input, fullName: 'Jane Doe', submittedAt: '2026-03-04T10:30:00.000Z' };

describe('interest storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads a missing key without initializing or touching unrelated data', () => {
    localStorage.setItem('other', 'keep');
    expect(getSubmissions()).toEqual({ ok: true, value: [] });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('other')).toBe('keep');
  });
  it('creates exactly six fields with a UUID and UTC timestamp preserving email and leading zeroes', () => {
    const result = addSubmission({ ...input, extra: 'never stored' });
    expect(result.ok).toBe(true);
    expect(Object.keys(result.value)).toEqual(['id', 'fullName', 'email', 'mobile', 'department', 'submittedAt']);
    expect(result.value).toMatchObject({ ...input, fullName: 'Jane Doe' });
    expect(result.value.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(result.value.submittedAt).toISOString()).toBe(result.value.submittedAt);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([result.value]);
    expect(getSubmissions()).toEqual({ ok: true, value: [result.value] });
  });
  it('reads healthy ordered data without rewriting it and appends using fresh storage', () => {
    saveSubmissions([row]);
    const before = localStorage.getItem(STORAGE_KEY);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(getSubmissions().value).toEqual([row]);
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    const second = addSubmission({ ...input, email: 'second@example.com', department: 'Design' });
    expect(getSubmissions().value).toEqual([row, second.value]);
  });
  it.each([undefined, null, [], {}, { ...input, fullName: 2 }, { ...input, fullName: 'Jane!' }, { ...input, fullName: 'A'.repeat(101) }, { ...input, email: 'bad' }, { ...input, mobile: 1234567890 }, { ...input, mobile: 'short' }, { ...input, department: 'Legal' }])('rejects invalid create %j without a write', (invalid) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([row]));
    const before = localStorage.getItem(STORAGE_KEY);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(addSubmission(invalid).error.code).toBe('INVALID_RECORD');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(set).not.toHaveBeenCalled();
  });
  it('rejects normalized duplicates without generating identity or writing', () => {
    saveSubmissions([row]);
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(addSubmission({ ...input, email: 'jane@example.COM' })).toEqual({ ok: false, error: { code: 'DUPLICATE_EMAIL', message: 'This email has already been submitted.' } });
    expect(getSubmissions().value).toEqual([row]);
    expect(set).not.toHaveBeenCalled();
    expect(uuid).not.toHaveBeenCalled();
  });
  it.each(['fullName', 'email', 'mobile', 'department'])('rejects create omitting only %s without a write', (field) => {
    const invalid = { ...input };
    delete invalid[field];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([row]));
    const raw = localStorage.getItem(STORAGE_KEY);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(addSubmission(invalid)).toEqual({ ok: false, error: { code: 'INVALID_RECORD', message: 'Please check the submission details and try again.' } });
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it.each(['bad', '', '2026-02-30T10:30:00.000Z', '2026-03-04'])('retains damaged string timestamp %j alongside valid rows without a cleanup write', (submittedAt) => {
    const damaged = { ...row, id: '650e8400-e29b-41d4-a716-446655440000', email: 'legacy@example.com', department: 'Design', submittedAt };
    const records = [row, damaged];
    const raw = JSON.stringify(records, null, 2);
    localStorage.setItem(STORAGE_KEY, raw);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(getSubmissions()).toEqual({ ok: true, value: records });
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(saveSubmissions(records).error.code).toBe('INVALID_RECORD');
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    const added = addSubmission({ ...input, email: 'new@example.com' });
    expect(added.ok).toBe(true);
    expect(new Date(added.value.submittedAt).toISOString()).toBe(added.value.submittedAt);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([...records, added.value]);
  });
  it('implements duplicate lookup with exclusion and fail-closed invalid input', () => {
    saveSubmissions([row]);
    expect(isEmailDuplicate('JANE@example.com')).toBe(true);
    expect(isEmailDuplicate(' jane@example.com ', row.id)).toBe(false);
    expect(isEmailDuplicate('other@example.com')).toBe(false);
    expect(isEmailDuplicate(null)).toBe(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('private', 'SecurityError'); });
    expect(isEmailDuplicate('other@example.com')).toBe(true);
  });
  it.each(['{broken', '{}', 'null', '42', '"text"', '[null]', JSON.stringify([{ ...row, extra: true }]), JSON.stringify([{ ...row, id: undefined }]), JSON.stringify([{ ...row, id: 'not-uuid' }]), ...[undefined, null, 3, true, {}, []].map((submittedAt) => JSON.stringify([{ ...row, submittedAt }])), JSON.stringify([{ ...row, fullName: ' Jane Doe ' }]), JSON.stringify([{ ...row, mobile: 1234567890 }]), JSON.stringify([{ ...row, department: 'Legal' }]), JSON.stringify([row, row])])('resets corrupt shape/value %s', (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    localStorage.setItem('other', 'keep');
    expect(getSubmissions()).toEqual({ ok: true, value: [] });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
    expect(localStorage.getItem('other')).toBe('keep');
  });
  it('recovers corruption on explicit create and persists the new row', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const result = addSubmission(input);
    expect(result.ok).toBe(true);
    expect(getSubmissions().value).toEqual([result.value]);
  });
  it.each([null, {}, [null], [{ ...row, email: false }], [{ ...row, fullName: 'Jane!' }], [{ ...row, mobile: 'short' }], [{ ...row, id: 4 }], [{ ...row, submittedAt: '2026-03-04' }], [row, { ...row, id: '650e8400-e29b-41d4-a716-446655440000', email: 'jane@example.com' }]])('rejects invalid replacement %j without overwriting', (records) => {
    saveSubmissions([row]);
    expect(saveSubmissions(records).error.code).toBe('INVALID_RECORD');
    expect(getSubmissions().value).toEqual([row]);
  });
  it('saves and reads back an empty snapshot', () => {
    saveSubmissions([row]);
    expect(saveSubmissions([])).toEqual({ ok: true, value: null });
    expect(getSubmissions().value).toEqual([]);
  });
  it('reports denied reads without treating them as empty or writing', () => {
    saveSubmissions([row]);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private data'); });
    expect(getSubmissions().error.code).toBe('STORAGE_UNAVAILABLE');
    expect(addSubmission(input).error.code).toBe('STORAGE_UNAVAILABLE');
    expect(set).not.toHaveBeenCalled();
    get.mockRestore();
    expect(getSubmissions().value).toEqual([row]);
  });
  it.each(['SecurityError', 'QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED', 'Error'])('reports %s write failure and preserves prior records', (name) => {
    saveSubmissions([row]);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private data', name); });
    const expected = name === 'SecurityError' ? 'STORAGE_UNAVAILABLE' : name === 'Error' ? 'WRITE_FAILED' : 'STORAGE_QUOTA';
    const result = addSubmission({ ...input, email: 'new@example.com' });
    expect(result.error.code).toBe(expected);
    expect(result.error.message).not.toContain('private data');
    expect(saveSubmissions([]).error.code).toBe(expected);
    set.mockRestore();
    expect(getSubmissions().value).toEqual([row]);
  });
  it('reports failed repair without claiming the corrupt key was reset', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(getSubmissions().error.code).toBe('WRITE_FAILED');
    expect(addSubmission(input).error.code).toBe('WRITE_FAILED');
    set.mockRestore();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });
  it('handles unavailable storage and throwing accessors safely', () => {
    const accessor = vi.spyOn(globalThis, 'localStorage', 'get').mockReturnValue(undefined);
    expect(getSubmissions().error.code).toBe('STORAGE_UNAVAILABLE');
    expect(saveSubmissions([]).error.code).toBe('STORAGE_UNAVAILABLE');
    accessor.mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(getSubmissions().error.code).toBe('STORAGE_UNAVAILABLE');
    expect(saveSubmissions([]).error.code).toBe('STORAGE_UNAVAILABLE');
    accessor.mockRestore();
  });
  it('does not persist if UUID generation fails', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
    expect(addSubmission(input).error.code).toBe('WRITE_FAILED');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

const secondRow = { ...row, id: '650e8400-e29b-41d4-a716-446655440000', email: 'other@example.com' };
const draft = { fullName: ' Jane Lee ', mobile: '9876543210', department: 'Design' };

describe('maintenance storage', () => {
  beforeEach(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([row, secondRow]));
    localStorage.setItem('unrelated', 'keep');
  });
  it('updates a freshly re-read exact ID preserving immutable fields and unrelated rows', () => {
    const latest = { ...secondRow, fullName: 'Other Person' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([latest, row]));
    const result = updateSubmission(row.id, { ...draft, email: secondRow.email, id: secondRow.id, submittedAt: 'bad', extra: true });
    expect(result).toEqual({ ok: true, value: { ...row, ...draft, fullName: 'Jane Lee' } });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([latest, result.value]);
    expect(getSubmissions().value).toEqual([latest, result.value]);
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(row.fullName).toBe('Jane Doe');
  });
  it('deletes only the exact ID from fresh storage and returns committed null', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([secondRow, row]));
    expect(deleteSubmission(row.id)).toEqual({ ok: true, value: null });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([secondRow]);
    expect(getSubmissions().value).toEqual([secondRow]);
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(deleteSubmission(secondRow.id)).toEqual({ ok: true, value: null });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });
  it.each(['fullName', 'mobile', 'department'])('rejects edit omitting only %s for an existing ID without a write', (field) => {
    const changes = { ...draft };
    delete changes[field];
    const raw = localStorage.getItem(STORAGE_KEY);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(updateSubmission(row.id, changes)).toEqual({ ok: false, error: { code: 'INVALID_RECORD', message: 'Please check the submission details and try again.' } });
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it.each(['bad', '2026-02-30T10:30:00.000Z'])('edits and deletes by ID while preserving existing damaged timestamp %s', (submittedAt) => {
    const damaged = { ...row, submittedAt };
    const otherDamaged = { ...secondRow, submittedAt: '' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([damaged, otherDamaged]));
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const updated = { ...damaged, ...draft, fullName: 'Jane Lee' };
    expect(updateSubmission(row.id, draft)).toEqual({ ok: true, value: updated });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([updated, otherDamaged]);
    expect(set).toHaveBeenCalledTimes(1);
    expect(deleteSubmission(row.id)).toEqual({ ok: true, value: null });
    expect(getSubmissions()).toEqual({ ok: true, value: [otherDamaged] });
    expect(set).toHaveBeenCalledTimes(2);
    expect(deleteSubmission(secondRow.id)).toEqual({ ok: true, value: null });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
    expect(set).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
  it.each([undefined, null, [], {}, { ...draft, fullName: '' }, { ...draft, fullName: 'Jane!' }, { ...draft, fullName: 'A'.repeat(101) }, { ...draft, fullName: 4 }, { ...draft, mobile: '123' }, { ...draft, mobile: 1234567890 }, { ...draft, department: 'Legal' }])('rejects invalid edit %j with no write', (changes) => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(updateSubmission(row.id, changes).error.code).toBe('INVALID_RECORD');
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it.each([undefined, null, 0, {}, row.id.toUpperCase(), ' ' + row.id, row.email, 'missing'])('never matches nonexact ID %j', (id) => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    for (const result of [updateSubmission(id, draft), deleteSubmission(id)]) {
      expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'The selected submission is no longer available.' } });
    }
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('does not initialize missing storage when either target is absent', () => {
    localStorage.removeItem(STORAGE_KEY);
    expect(updateSubmission(row.id, draft).error.code).toBe('NOT_FOUND');
    expect(deleteSubmission(row.id).error.code).toBe('NOT_FOUND');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('reports denied reads with no mutation and reads prior state after restoration', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private'); });
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(updateSubmission(row.id, draft).error.code).toBe('STORAGE_UNAVAILABLE');
    expect(deleteSubmission(row.id).error.code).toBe('STORAGE_UNAVAILABLE');
    expect(set).not.toHaveBeenCalled();
    get.mockRestore();
    expect(getSubmissions().value).toEqual([row, secondRow]);
  });
  it.each(['SecurityError', 'QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED', 'Error'])('retains every row after %s update and delete writes', (name) => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private', name); });
    const code = name === 'SecurityError' ? 'STORAGE_UNAVAILABLE' : name === 'Error' ? 'WRITE_FAILED' : 'STORAGE_QUOTA';
    expect(updateSubmission(row.id, draft).error.code).toBe(code);
    expect(deleteSubmission(row.id).error.code).toBe(code);
    set.mockRestore();
    expect(getSubmissions().value).toEqual([row, secondRow]);
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
  it.each(['update', 'delete'])('propagates failed corruption repair during %s', (mode) => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const result = mode === 'update' ? updateSubmission(row.id, draft) : deleteSubmission(row.id);
    expect(result.error.code).toBe('WRITE_FAILED');
    set.mockRestore();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });
});

 it.each(['update', 'delete'])('recovers malformed storage then reports missing target for %s without inventing a row', (mode) => {
   localStorage.setItem(STORAGE_KEY, '{broken');
   localStorage.setItem('other', 'keep');
   const result = mode === 'update' ? updateSubmission(row.id, draft) : deleteSubmission(row.id);
   expect(result.error.code).toBe('NOT_FOUND');
   expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
   expect(localStorage.getItem('other')).toBe('keep');
 });
 it('accepts edit boundaries without changing identity and ignores immutable-only input without a write', () => {
   saveSubmissions([row, secondRow]);
   const result = updateSubmission(row.id, { fullName: 'A'.repeat(100), mobile: '0000000000', department: 'Data Science' });
   expect(result.ok).toBe(true);
   expect(getSubmissions().value).toEqual([{ ...row, fullName: 'A'.repeat(100), mobile: '0000000000', department: 'Data Science' }, secondRow]);
   const raw = localStorage.getItem(STORAGE_KEY);
   const set = vi.spyOn(Storage.prototype, 'setItem');
   expect(updateSubmission(row.id, { email: 'changed@example.com', id: secondRow.id, submittedAt: 'bad' }).error.code).toBe('INVALID_RECORD');
   expect(set).not.toHaveBeenCalled();
   expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
 });
