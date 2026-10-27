/** Collect candidate interest only after an explicit validated submission. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEPARTMENTS, validateSubmission } from '../utils/validators.js';
import { addSubmission } from '../utils/storage.js';

const EMPTY = { fullName: '', email: '', mobile: '', department: '' };
const FIELDS = [
  { name: 'fullName', label: 'Full Name', type: 'text', autoComplete: 'name', maxLength: 100 },
  { name: 'email', label: 'Email Address', type: 'email', autoComplete: 'email' },
  { name: 'mobile', label: 'Mobile Number', type: 'tel', autoComplete: 'tel', inputMode: 'numeric' },
];

/** Render an accessible form with committed-success feedback and retained failure input. */
export default function InterestForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [storageError, setStorageError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Keep the lock stable across renders and observable before React commits state.
  const [submissionGuard] = useState({ active: false });

  useEffect(
    /** Schedule dismissal only after a committed save and cancel obsolete timers. */
    () => {
      if (!success) return undefined;
      const timer = setTimeout(() => setSuccess(false), 4000);
      return () => clearTimeout(timer);
    },
    [success],
  );

  /** Retain entered text without writing or validating during render. */
  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  /** Commit only valid input and report success only after persistence completes. */
  function submit(event) {
    event.preventDefault();
    if (submissionGuard.active) return;
    setSuccess(false);
    setStorageError('');
    const fieldErrors = validateSubmission(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    submissionGuard.active = true;
    setSubmitting(true);
    try {
      const result = addSubmission(values);
      if (!result.ok) {
        if (result.error.code === 'DUPLICATE_EMAIL') setErrors({ email: result.error.message });
        else setStorageError(result.error.message);
      } else {
        setValues(EMPTY);
        setErrors({});
        setSuccess(result.value.id);
      }
    } finally {
      submissionGuard.active = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="interest-page" aria-labelledby="interest-title">
      <h1 id="interest-title">
        Join Our Team
      </h1>
      <p className="interest-subtitle">
        Express your interest in working with us.
      </p>
      <form className="interest-card" onSubmit={submit} noValidate aria-busy={submitting}>
        {success && (
          <p className="form-success" role="status">
            Thank you! Your interest has been submitted successfully.
          </p>
        )}
        {FIELDS.map((field) => (
          <div className="form-field" key={field.name}>
            <label htmlFor={`interest-${field.name}`}>
              {field.label}
            </label>
            <input
              id={`interest-${field.name}`}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              maxLength={field.maxLength}
              inputMode={field.inputMode}
              required
              aria-required="true"
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={errors[field.name] ? `interest-${field.name}-error` : undefined}
              value={values[field.name]}
              onChange={change}
            />
            {errors[field.name] && (
              <p className="field-error" id={`interest-${field.name}-error`} role="alert">
                {errors[field.name]}
              </p>
            )}
          </div>
        ))}
        <div className="form-field">
          <label htmlFor="interest-department">
            Department of Interest
          </label>
          <select
            id="interest-department"
            name="department"
            required
            aria-required="true"
            aria-invalid={Boolean(errors.department)}
            aria-describedby={errors.department ? 'interest-department-error' : undefined}
            value={values.department}
            onChange={change}
          >
            <option value="">
              Select a department
            </option>
            {DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          {errors.department && (
            <p className="field-error" id="interest-department-error" role="alert">
              {errors.department}
            </p>
          )}
        </div>
        {storageError && (
          <p className="field-error form-storage-error" role="alert">
            {storageError}
          </p>
        )}
        <button className="submit-button" type="submit" disabled={submitting}>
          Submit Application
        </button>
      </form>
      <Link className="interest-back" to="/">
        ← Back to Home
      </Link>
    </section>
  );
}
