/** Hold a disposable edit draft inside a native accessible modal. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { DEPARTMENTS, validateName, validateMobile, validateDepartment } from '../utils/validators.js';

/** Validate editable fields and retain failed drafts; dismissal never writes.
 * @param {object} props - Snapshot and guarded synchronous save/cancel callbacks.
 * @returns {JSX.Element} Prefilled dialog with associated errors.
 */
export default function EditModal({ submission, onSave, onCancel }) {
  const [draft, setDraft] = useState({ fullName: submission.fullName, mobile: submission.mobile, department: submission.department });
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    if (!dialog) return undefined;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector('input').focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [dialog]);

  /** Change only ephemeral draft state while preserving field identity. */
  function change(event) {
    setDraft({ ...draft, [event.target.name]: event.target.value });
  }

  /** Block invalid drafts and retain input on a failed guarded save. */
  function save(event) {
    event.preventDefault();
    const nextErrors = {};
    for (const [field, validator] of Object.entries({ fullName: validateName, mobile: validateMobile, department: validateDepartment })) {
      const message = validator(draft[field]);
      if (message) nextErrors[field] = message;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = onSave(submission.id, draft);
    if (!result.ok) setSaveError(result.error.message);
  }

  /** Cycle focus at boundaries, supplementing native dialog isolation. */
  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('input, select, button')].filter((element) => !element.disabled);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={setDialog}
      className="edit-modal"
      aria-modal="true"
      aria-labelledby="edit-title"
      onKeyDown={trapFocus}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="edit-modal-content">
        <h2 id="edit-title">Edit Submission</h2>
        <form noValidate onSubmit={save}>
          {saveError && (
            <p className="field-error form-storage-error" role="alert">{saveError}</p>
          )}
          <div className="form-field">
            <label htmlFor="edit-fullName">Full Name</label>
            <input
              id="edit-fullName"
              name="fullName"
              value={draft.fullName}
              onChange={change}
              aria-required="true"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'edit-fullName-error' : undefined}
            />
            {errors.fullName && (
              <p id="edit-fullName-error" className="field-error" role="alert">{errors.fullName}</p>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="edit-email">Email Address</label>
            <input id="edit-email" value={submission.email} readOnly aria-describedby="edit-email-note" />
            <p id="edit-email-note" className="edit-email-note">Email cannot be changed.</p>
          </div>
          <div className="form-field">
            <label htmlFor="edit-mobile">Mobile Number</label>
            <input
              id="edit-mobile"
              name="mobile"
              inputMode="numeric"
              value={draft.mobile}
              onChange={change}
              aria-required="true"
              aria-invalid={Boolean(errors.mobile)}
              aria-describedby={errors.mobile ? 'edit-mobile-error' : undefined}
            />
            {errors.mobile && (
              <p id="edit-mobile-error" className="field-error" role="alert">{errors.mobile}</p>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="edit-department">Department of Interest</label>
            <select
              id="edit-department"
              name="department"
              value={draft.department}
              onChange={change}
              aria-required="true"
              aria-invalid={Boolean(errors.department)}
              aria-describedby={errors.department ? 'edit-department-error' : undefined}
            >
              <option value="">Select a department</option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            {errors.department && (
              <p id="edit-department-error" className="field-error" role="alert">{errors.department}</p>
            )}
          </div>
          <div className="modal-actions">
            <button className="action-button" type="button" onClick={onCancel}>Cancel</button>
            <button className="submit-button" type="submit">Save Changes</button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

EditModal.propTypes = {
  submission: PropTypes.shape({
    id: PropTypes.string.isRequired,
    fullName: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    mobile: PropTypes.string.isRequired,
    department: PropTypes.string.isRequired,
  }).isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
