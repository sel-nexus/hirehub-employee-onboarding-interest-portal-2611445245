/** Verify persistence through real browser state readback and injected storage failures. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, addSubmission, getSubmissions, isEmailDuplicate, saveSubmissions } from './storage.js';

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
  it('implements duplicate lookup with exclusion and fail-closed invalid input', () => {
    saveSubmissions([row]);
    expect(isEmailDuplicate('JANE@example.com')).toBe(true);
    expect(isEmailDuplicate(' jane@example.com ', row.id)).toBe(false);
    expect(isEmailDuplicate('other@example.com')).toBe(false);
    expect(isEmailDuplicate(null)).toBe(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('private', 'SecurityError'); });
    expect(isEmailDuplicate('other@example.com')).toBe(true);
  });
  it.each(['{broken', '{}', 'null', '42', '"text"', '[null]', JSON.stringify([{ ...row, extra: true }]), JSON.stringify([{ ...row, id: undefined }]), JSON.stringify([{ ...row, id: 'not-uuid' }]), JSON.stringify([{ ...row, submittedAt: 'bad' }]), JSON.stringify([{ ...row, submittedAt: '2026-02-30T10:30:00.000Z' }]), JSON.stringify([{ ...row, submittedAt: 3 }]), JSON.stringify([{ ...row, fullName: ' Jane Doe ' }]), JSON.stringify([{ ...row, mobile: 1234567890 }]), JSON.stringify([{ ...row, department: 'Legal' }]), JSON.stringify([row, row])])('resets corrupt shape/value %s', (raw) => {
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
