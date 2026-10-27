/** Present the local snapshot without mutating or interpreting candidate markup. */
import PropTypes from 'prop-types';

/** Parse a canonical stored timestamp without coercing damaged values.
 * @param {unknown} value - Stored submission timestamp.
 * @returns {number} Milliseconds or NaN for an unavailable date.
 */
export function submissionTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return NaN;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) && date.toISOString() === value ? time : NaN;
}

/** Format display dates consistently and leave damaged timestamps unavailable.
 * @param {unknown} value - Stored timestamp; never changed by presentation.
 * @returns {string} English date or the neutral unavailable placeholder.
 */
export function formatSubmissionDate(value) {
  const time = submissionTime(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : 'N/A';
}

/** Render ordered rows and the honest empty state; actions fire only on user activation.
 * @param {object} props - Loaded submission snapshot.
 * @returns {JSX.Element} Scrollable table card with explicit actions.
 */
export default function SubmissionTable({ submissions, onEdit, onDelete }) {
  return (
    <div className="table-card">
      {submissions.length === 0 ? (
        <p className="empty-submissions">No submissions yet.</p>
      ) : (
        <div className="table-scroll" role="region" aria-label="Submissions" tabIndex={0}>
          <table className="submission-table">
            <caption className="visually-hidden">Interest submissions</caption>
            <thead>
              <tr>
                {['#', 'Full Name', 'Email', 'Mobile', 'Department', 'Submitted On', 'Actions'].map((column) => (
                  <th key={column} scope="col">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.fullName}</td>
                  <td>{row.email}</td>
                  <td>{row.mobile}</td>
                  <td>
                    <span className="department-badge">{row.department}</span>
                  </td>
                  <td>{formatSubmissionDate(row.submittedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="action-button" type="button" disabled={!onEdit} onClick={() => onEdit(row)}>Edit</button>
                      <button className="action-button action-delete" type="button" disabled={!onDelete} onClick={() => onDelete(row.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

SubmissionTable.propTypes = {
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  submissions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    fullName: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    mobile: PropTypes.string.isRequired,
    department: PropTypes.string.isRequired,
    submittedAt: PropTypes.any,
  })).isRequired,
};
