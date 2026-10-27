/** Guard and review a real browser-local submission snapshot. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubmissions } from '../utils/storage.js';
import { isAdminAuthenticated, logoutAdmin, SESSION_ERROR } from './Header.jsx';
import AdminLogin from './AdminLogin.jsx';
import SubmissionTable, { formatSubmissionDate, submissionTime } from './SubmissionTable.jsx';

/** Derive metrics while excluding damaged dates without changing records.
 * @param {Array<object>} records - Loaded snapshot in stored order.
 * @returns {object} Total, unique departments and newest available date.
 */
export function submissionMetrics(records) {
  let newest;
  let newestTime = -Infinity;
  for (const row of records) {
    const time = submissionTime(row.submittedAt);
    if (time > newestTime) {
      newestTime = time;
      newest = row.submittedAt;
    }
  }
  return { total: records.length, departments: new Set(records.map((row) => row.department)).size, latest: formatSubmissionDate(newest) };
}

/** Load only after the exact session guard and keep healthy viewing read-only.
 * @returns {JSX.Element} Authorized metrics/table, explicit error, or login.
 */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [logoutError, setLogoutError] = useState('');
  const authenticated = isAdminAuthenticated();

  useEffect(() => {
    if (isAdminAuthenticated()) setResult(getSubmissions());
  }, []);

  /** Remove only the session flag on user activation, preserving all local data. */
  function handleLogout() {
    if (!logoutAdmin()) {
      setLogoutError(SESSION_ERROR);
      return;
    }
    navigate('/');
  }

  if (!authenticated) return <AdminLogin />;
  const records = result?.ok ? result.value : [];
  const metrics = submissionMetrics(records);

  return (
    <section className="admin-dashboard">
      <div className="dashboard-heading">
        <h1>Submissions Dashboard</h1>
        <button className="logout-button" type="button" onClick={handleLogout}>Logout</button>
      </div>
      {logoutError && (
        <p className="field-error" role="alert">{logoutError}</p>
      )}
      {!result ? (
        <p role="status">Loading submissions...</p>
      ) : !result.ok ? (
        <p className="field-error" role="alert">{result.error.message}</p>
      ) : (
        <>
          <div className="dashboard-stats">
            <div className="stat-card stat-total">
              <p>Total Submissions</p>
              <strong>{metrics.total}</strong>
            </div>
            <div className="stat-card stat-departments">
              <p>Departments</p>
              <strong>{metrics.departments}</strong>
            </div>
            <div className="stat-card stat-latest">
              <p>Latest Submission</p>
              <strong>{metrics.latest}</strong>
            </div>
          </div>
          <SubmissionTable submissions={records} />
        </>
      )}
    </section>
  );
}
