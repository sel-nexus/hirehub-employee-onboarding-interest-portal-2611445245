/** Validate candidate fields without changing input or accessing browser state. */
export const DEPARTMENTS = Object.freeze([
  'Engineering', 'Design', 'Marketing', 'Human Resources',
  'Finance', 'Operations', 'Sales', 'Data Science',
]);

/** Check the candidate name, including its untrimmed length.
 * @param {unknown} value - Candidate-entered name.
 * @returns {string} Empty when valid, otherwise a safe field error.
 */
export function validateName(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Please enter your full name.';
  if (value.length > 100) return 'Full name must be at most 100 characters.';
  if (!/^[a-zA-Z ]+$/.test(value)) return 'Full name must contain only letters and spaces.';
  return '';
}

/** Check a browser-style email address, allowing surrounding whitespace for comparison.
 * @param {unknown} value - Candidate-entered email, preserved on save.
 * @returns {string} Empty when valid, otherwise a safe field error.
 */
export function validateEmail(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Please enter your email address.';
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(value.trim())) {
    return 'Please enter a valid email address.';
  }
  return '';
}

/** Check ten ASCII digits without coercing away leading zeroes.
 * @param {unknown} value - Candidate-entered telephone number.
 * @returns {string} Empty when valid, otherwise a safe field error.
 */
export function validateMobile(value) {
  return typeof value === 'string' && /^[0-9]{10}$/.test(value)
    ? '' : 'Mobile number must contain exactly 10 digits.';
}

/** Check exact membership in the offered department list.
 * @param {unknown} value - Selected department.
 * @returns {string} Empty when valid, otherwise a safe field error.
 */
export function validateDepartment(value) {
  return DEPARTMENTS.includes(value) ? '' : 'Please select a department of interest.';
}

/** Collect only invalid fields, treating missing or wrong-type input as invalid.
 * @param {unknown} input - Candidate fields to validate.
 * @returns {object} Field names mapped to safe error messages.
 */
export function validateSubmission(input) {
  const fields = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = {};
  for (const [field, validator] of Object.entries({
    fullName: validateName, email: validateEmail, mobile: validateMobile, department: validateDepartment,
  })) {
    const error = validator(fields[field]);
    if (error) errors[field] = error;
  }
  return errors;
}
