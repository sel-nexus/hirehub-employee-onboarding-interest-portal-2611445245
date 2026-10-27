/** Persist browser-local interest records and report failures without leaking personal data. */
import { validateSubmission, validateEmail } from './validators.js';

export const STORAGE_KEY = 'hirehub_submissions';
const RECORD_FIELDS = ['id', 'fullName', 'email', 'mobile', 'department', 'submittedAt'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGES = {
  STORAGE_UNAVAILABLE: 'Browser storage is unavailable. Please allow local storage and try again.',
  STORAGE_QUOTA: 'Browser storage is full. Please free up space and try again.',
  INVALID_RECORD: 'Please check the submission details and try again.',
  DUPLICATE_EMAIL: 'This email has already been submitted.',
  WRITE_FAILED: 'Your interest could not be saved. Please try again.',
  NOT_FOUND: 'The selected submission is no longer available.',
};

/** Build a safe failure result.
 * @param {string} code - Public storage failure category.
 * @returns {object} Non-success result without raw exception text.
 */
function failure(code) {
  return { ok: false, error: { code, message: MESSAGES[code] } };
}

/** Classify a browser write failure without exposing its message.
 * @param {unknown} error - Browser exception.
 * @returns {object} Safe failure result.
 */
function writeFailure(error) {
  if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return failure('STORAGE_QUOTA');
  }
  return failure(error?.name === 'SecurityError' ? 'STORAGE_UNAVAILABLE' : 'WRITE_FAILED');
}

/** Check the exact persisted shape and all record invariants.
 * @param {unknown} record - Parsed or proposed record.
 * @returns {boolean} Whether this is a usable six-field record.
 */
function validRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (Object.keys(record).length !== RECORD_FIELDS.length || !RECORD_FIELDS.every((key) => Object.hasOwn(record, key))) return false;
  if (Object.keys(validateSubmission(record)).length || record.fullName !== record.fullName.trim()) return false;
  if (typeof record.id !== 'string' || !UUID.test(record.id)) return false;
  if (typeof record.submittedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.submittedAt)) return false;
  const date = new Date(record.submittedAt);
  return !Number.isNaN(date.getTime()) && date.toISOString() === record.submittedAt;
}

/** Normalize only the duplicate lookup key.
 * @param {string} email - Valid candidate email.
 * @returns {string} Case-insensitive, trimmed comparison key.
 */
function emailKey(email) {
  return email.trim().toLowerCase();
}

/** Check an array's schema and unique identifiers/email keys.
 * @param {unknown} records - Proposed or parsed collection.
 * @returns {boolean} Whether the full array can be used safely.
 */
function validRecords(records) {
  if (!Array.isArray(records) || !records.every(validRecord)) return false;
  return new Set(records.map((row) => row.id)).size === records.length
    && new Set(records.map((row) => emailKey(row.email))).size === records.length;
}

/** Write a validated snapshot; never return success before the browser write completes.
 * @param {unknown} records - Complete six-field collection.
 * @returns {object} Success with null value, or safe failure.
 */
export function saveSubmissions(records) {
  if (!validRecords(records)) return failure('INVALID_RECORD');
  let store;
  try {
    store = globalThis.localStorage;
    if (!store) return failure('STORAGE_UNAVAILABLE');
  } catch {
    return failure('STORAGE_UNAVAILABLE');
  }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(records));
    return { ok: true, value: null };
  } catch (error) {
    return writeFailure(error);
  }
}

/** Read the latest records, resetting corruption only when a repair write succeeds.
 * @returns {object} Ordered records, or explicit access/repair failure.
 */
export function getSubmissions() {
  let raw;
  try {
    if (!globalThis.localStorage) return failure('STORAGE_UNAVAILABLE');
    raw = globalThis.localStorage.getItem(STORAGE_KEY);
  } catch {
    return failure('STORAGE_UNAVAILABLE');
  }
  if (raw === null) return { ok: true, value: [] };
  let records;
  try {
    records = JSON.parse(raw);
  } catch {
    records = null;
  }
  if (validRecords(records)) return { ok: true, value: records };
  const repair = saveSubmissions([]);
  return repair.ok ? { ok: true, value: [] } : repair;
}

/** Check local email duplication; fail closed when records cannot be read.
 * @param {unknown} email - Candidate email to compare.
 * @param {string} [excludingId] - Existing row to omit from lookup.
 * @returns {boolean} True for a duplicate or an unavailable/invalid lookup.
 * Notes: Mutations use getSubmissions directly to preserve detailed failures.
 */
export function isEmailDuplicate(email, excludingId) {
  if (validateEmail(email)) return true;
  const result = getSubmissions();
  return !result.ok || result.value.some((row) => row.id !== excludingId && emailKey(row.email) === emailKey(email));
}

/** Validate, re-read, reject duplicates, and append a new UUID/timestamp record.
 * @param {unknown} input - Candidate-entered fields; extra input keys are never persisted.
 * @returns {object} Committed six-field record, or safe failure.
 */
export function addSubmission(input) {
  if (Object.keys(validateSubmission(input)).length) return failure('INVALID_RECORD');
  const existing = getSubmissions();
  if (!existing.ok) return existing;
  if (existing.value.some((row) => emailKey(row.email) === emailKey(input.email))) return failure('DUPLICATE_EMAIL');
  let record;
  try {
    record = {
      id: globalThis.crypto.randomUUID(),
      fullName: input.fullName.trim(),
      email: input.email,
      mobile: input.mobile,
      department: input.department,
      submittedAt: new Date().toISOString(),
    };
  } catch {
    return failure('WRITE_FAILED');
  }
  const saved = saveSubmissions([...existing.value, record]);
  return saved.ok ? { ok: true, value: record } : saved;
}

/** Re-read and update only the exact selected ID, ignoring immutable/unknown fields.
 * @param {string} id - Exact stored identifier; never normalized.
 * @param {object} changes - Complete editable name, mobile and department draft.
 * @returns {object} Committed row or explicit validation/read/write/missing failure.
 */
export function updateSubmission(id, changes) {
  const existing = getSubmissions();
  if (!existing.ok) return existing;
  const index = existing.value.findIndex((row) => row.id === id);
  if (index === -1) return failure('NOT_FOUND');
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return failure('INVALID_RECORD');
  const record = {
    ...existing.value[index],
    fullName: changes.fullName,
    mobile: changes.mobile,
    department: changes.department,
  };
  if (Object.keys(validateSubmission(record)).length) return failure('INVALID_RECORD');
  record.fullName = record.fullName.trim();
  const records = existing.value.map((row, position) => position === index ? record : row);
  const saved = saveSubmissions(records);
  return saved.ok ? { ok: true, value: record } : saved;
}

/** Re-read and remove only an exact selected ID after the caller confirms.
 * @param {string} id - Exact stored identifier; never normalized or coerced.
 * @returns {object} Committed null value or explicit read/write/missing failure.
 */
export function deleteSubmission(id) {
  const existing = getSubmissions();
  if (!existing.ok) return existing;
  if (!existing.value.some((row) => row.id === id)) return failure('NOT_FOUND');
  return saveSubmissions(existing.value.filter((row) => row.id !== id));
}
