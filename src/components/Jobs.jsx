import { Fragment, useState } from 'react'
import { isFinal } from '../api.js'

// Jobs across every calculator, newest first. Click a row for its output.

function OutputView({ job, mlflowUrl }) {
  if (job.error) return <pre className="error-box">{job.error}</pre>
  if (!job.output) return <p className="dim">Waiting for output…</p>
  const entries = Object.entries(job.output)
  const scalars = entries.filter(([, v]) => !Array.isArray(v))
  const lists = entries.filter(([, v]) => Array.isArray(v))
  return (
    <div className="output">
      <table className="kv">
        <tbody>
          {scalars.map(([k, v]) => (
            <tr key={k}><td className="mono dim">{k}</td><td className="mono">{String(v)}</td></tr>
          ))}
        </tbody>
      </table>
      {lists.map(([k, v]) => (
        <div key={k} className="list-out">
          <div className="mono dim">{k} ({v.length})</div>
          <div className="mono">{v.length ? v.join(', ') : 'none'}</div>
        </div>
      ))}
      {job.mlflow_run_id && (
        <a className="btn" href={`${mlflowUrl}/#/runs/${job.mlflow_run_id}`} target="_blank" rel="noreferrer">Open in MLflow ↗</a>
      )}
    </div>
  )
}

export default function Jobs({ jobs, mlflowUrl, onClear }) {
  const [open, setOpen] = useState(null)
  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-sub">{jobs.length} total, {jobs.filter(j => !isFinal(j.status) && !j.lost).length} in progress</p>
        </div>
        <button className="btn" disabled={!jobs.some(j => isFinal(j.status) || j.lost)} onClick={onClear}>Clear finished</button>
      </div>

      {jobs.length === 0 ? (
        <p className="dim">No jobs yet. Run a calculator from the Calculators page.</p>
      ) : (
        <table className="jobs">
          <thead>
            <tr><th>Calculator</th><th>Job</th><th>Status</th><th>Submitted</th><th>Completed</th></tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <Fragment key={j.job_id}>
                <tr className="job-row" onClick={() => setOpen(open === j.job_id ? null : j.job_id)}>
                  <td>{j.label}</td>
                  <td className="mono dim">{j.job_id.slice(0, 8)}</td>
                  <td><span className={`status status-${j.lost ? 'lost' : j.status}`}>{j.lost ? 'lost' : j.status}</span></td>
                  <td className="mono dim">{j.submitted}</td>
                  <td className="mono dim">{j.completed || ''}</td>
                </tr>
                {open === j.job_id && (
                  <tr><td colSpan={5}><OutputView job={j} mlflowUrl={mlflowUrl} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
