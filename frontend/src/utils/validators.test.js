/** Exercise pure field validation at type, syntax, and length boundaries. */
import { describe, expect, it } from 'vitest';
import { DEPARTMENTS, validateName, validateEmail, validateMobile, validateDepartment, validateSubmission } from './validators.js';

describe('validators', () => {
  it.each([undefined, null, 42, true, {}, [], '', '   ', '\t', 'Jane2', 'Jane Doe!', 'Jane-Doe', 'Jane\nDoe', 'A'.repeat(101)])('rejects invalid name %j', (value) => {
    expect(validateName(value)).not.toBe('');
  });
  it.each(['A', ' Jane Doe ', 'A'.repeat(100)])('accepts name boundary %j', (value) => {
    expect(validateName(value)).toBe('');
  });
  it.each([undefined, null, 123, false, {}, [], '', ' ', 'no-at', '@host', 'a@', 'a b@host', 'a@-host.com', 'a@host-.com', 'a@host..com', 'a@@host', 'a@host/path'])('rejects invalid email %j', (value) => {
    expect(validateEmail(value)).not.toBe('');
  });
  it.each(['a@host', 'jane.doe+jobs@example.com', ' JANE@Example.COM ', 'a@sub.example.com'])('accepts browser-style email %j', (value) => {
    expect(validateEmail(value)).toBe('');
  });
  it.each([undefined, null, 1234567890, true, {}, [], '', '123456789', '12345678901', '12345abcde', '+123456789', '0123456789 ', '１２３４５６７８９０', '12345 7890'])('rejects invalid mobile %j', (value) => {
    expect(validateMobile(value)).not.toBe('');
  });
  it.each(['0123456789', '0000000000', '9999999999'])('preserves valid ten-digit mobile %s', (value) => {
    expect(validateMobile(value)).toBe('');
  });
  it.each([undefined, null, 1, true, {}, [], '', 'engineering', 'Engineering ', 'Legal'])('rejects missing or unoffered department %j', (value) => {
    expect(validateDepartment(value)).not.toBe('');
  });
  it.each(DEPARTMENTS)('accepts exact department %s', (value) => {
    expect(validateDepartment(value)).toBe('');
  });
  it.each([undefined, null, 2, '', [], {}, { fullName: 2, email: false, mobile: 123, department: {} }])('collects all missing/wrong-type fields for %j', (input) => {
    expect(Object.keys(validateSubmission(input))).toEqual(['fullName', 'email', 'mobile', 'department']);
  });
  it('returns only invalid fields without mutating valid input', () => {
    const input = Object.freeze({ fullName: 'Jane Doe', email: 'jane@example.com', mobile: '0123456789', department: 'Engineering' });
    expect(validateSubmission(input)).toEqual({});
    expect(validateSubmission({ ...input, mobile: 'short' })).toEqual({ mobile: validateMobile('short') });
  });
  it.each([
    ['fullName', 'Please enter your full name.'],
    ['email', 'Please enter your email address.'],
    ['mobile', 'Mobile number must contain exactly 10 digits.'],
    ['department', 'Please select a department of interest.'],
  ])('returns exactly the %s error when only that field is omitted', (field, message) => {
    const input = { fullName: 'Jane Doe', email: 'jane@example.com', mobile: '0123456789', department: 'Engineering' };
    delete input[field];
    expect(validateSubmission(input)).toEqual({ [field]: message });
  });
});
