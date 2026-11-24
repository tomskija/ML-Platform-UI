import { useEffect, useRef, useState } from 'react'
import { loadRegistry, getHealth, getSchema, getStatus, getOutput, submitRun, buildInJson, defaultValues, isFinal } from './api.js'
import Landing from './components/Landing.jsx'
import CalculatorPage from './components/CalculatorPage.jsx'
import Jobs from './components/Jobs.jsx'

const HEALTH_POLL_MS = 5000
const JOB_POLL_MS = 2000

// Small localStorage helpers: per-browser convenience only, the app works fine without them
const saved = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage blocked */ } }

export default function App() {
  const [registry, setRegistry] = useState(null)
  const [registryError, setRegistryError] = useState('')
  const [health, setHealth] = useState({})        // name -> 'online' | 'offline' | 'checking'
  const [schemas, setSchemas] = useState({})      // name -> schema
  const [formValues, setFormValues] = useState(() => saved('mlp.formValues', {}))
  const [jobs, setJobs] = useState(() => saved('mlp.jobs', []))
  const [view, setView] = useState({ page: 'landing' })
  const [selected, setSelected] = useState([])
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs
  const schemaRequested = useRef(new Set())

  // Registry -----------------------------------------------------------------
  useEffect(() => {
    loadRegistry().then(setRegistry).catch(e => setRegistryError(String(e)))
  }, [])

  // Health polling, and grab each schema the first time a calculator comes online
  useEffect(() => {
    if (!registry) return
    const check = () => registry.calculators.forEach(async c => {
      try {
        await getHealth(c.api_base)
        setHealth(h => ({ ...h, [c.name]: 'online' }))
        if (!schemaRequested.current.has(c.name)) {
          schemaRequested.current.add(c.name)
          getSchema(c.api_base)
            .then(schema => setSchemas(p => ({ ...p, [c.name]: schema })))
            .catch(() => schemaRequested.current.delete(c.name))
        }
      } catch {
        setHealth(h => ({ ...h, [c.name]: 'offline' }))
      }
    })
    check()
    const t = setInterval(check, HEALTH_POLL_MS)
    return () => clearInterval(t)
  }, [registry])

  useEffect(() => save('mlp.formValues', formValues), [formValues])
  useEffect(() => save('mlp.jobs', jobs.slice(0, 100)), [jobs])

  // Job polling ----------------------------------------------------------------
  useEffect(() => {
    if (!registry) return
    const t = setInterval(() => {
      jobsRef.current.filter(j => !isFinal(j.status) && !j.lost).forEach(async job => {
        const calc = registry.calculators.find(c => c.name === job.calculator)
        if (!calc) return
        try {
          const s = await getStatus(calc.api_base, job.job_id)
          let output = job.output
          if (isFinal(s.status)) output = (await getOutput(calc.api_base, job.job_id)).output
          updateJob(job.job_id, { status: s.status, started: s.started, completed: s.completed, error: s.error, mlflow_run_id: s.mlflow_run_id, output })
        } catch (e) {
          // 404 means the API restarted and forgot the job
          if (String(e).startsWith('404')) updateJob(job.job_id, { lost: true, error: 'API restarted, job no longer tracked' })
        }
      })
    }, JOB_POLL_MS)
    return () => clearInterval(t)
  }, [registry])

  const updateJob = (jobId, patch) => setJobs(js => js.map(j => (j.job_id === jobId ? { ...j, ...patch } : j)))

  // Actions --------------------------------------------------------------------
  const valuesFor = name => formValues[name] ?? (schemas[name] ? defaultValues(schemas[name]) : {})

  async function run(names) {
    const submitted = []
    for (const name of names) {
      const calc = registry.calculators.find(c => c.name === name)
      const schema = schemas[name]
      if (!calc || !schema || health[name] !== 'online') continue
      try {
        const job = await submitRun(calc.api_base, buildInJson(schema, valuesFor(name)))
        submitted.push({ ...job, calculator: name, label: calc.label, output: null })
      } catch (e) {
        submitted.push({ job_id: `failed-${Date.now()}-${name}`, calculator: name, label: calc.label, status: 'failed',
                         submitted: new Date().toLocaleString(), error: String(e), output: null })
      }
    }
    setJobs(js => [...submitted, ...js])
    setView({ page: 'jobs' })
  }

  const running = jobs.filter(j => !isFinal(j.status) && !j.lost).length

  // Render -----------------------------------------------------------------------
  if (registryError) return <div className="fatal">Couldn't load the calculator registry: {registryError}</div>
  if (!registry) return <div className="fatal">Loading…</div>

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo" onClick={() => setView({ page: 'landing' })}>ML Platform</div>
        <div className="header-sub">calculator hub</div>
        <nav className="nav">
          <button className={view.page !== 'jobs' ? 'nav-item active' : 'nav-item'} onClick={() => setView({ page: 'landing' })}>Calculators</button>
          <button className={view.page === 'jobs' ? 'nav-item active' : 'nav-item'} onClick={() => setView({ page: 'jobs' })}>
            Jobs {running > 0 && <span className="badge">{running}</span>}
          </button>
          <a className="nav-item" href={registry.mlflow_url} target="_blank" rel="noreferrer">MLflow ↗</a>
        </nav>
      </header>

      <main className="main">
        {view.page === 'landing' && (
          <Landing
            calculators={registry.calculators}
            health={health}
            schemas={schemas}
            selected={selected}
            onToggle={name => setSelected(s => (s.includes(name) ? s.filter(x => x !== name) : [...s, name]))}
            onOpen={name => setView({ page: 'calculator', name })}
            onRunSelected={() => run(selected)}
          />
        )}
        {view.page === 'calculator' && (
          <CalculatorPage
            calc={registry.calculators.find(c => c.name === view.name)}
            status={health[view.name]}
            schema={schemas[view.name]}
            values={valuesFor(view.name)}
            onChange={v => setFormValues(f => ({ ...f, [view.name]: v }))}
            onReset={() => setFormValues(f => ({ ...f, [view.name]: defaultValues(schemas[view.name]) }))}
            onRun={() => run([view.name])}
            onBack={() => setView({ page: 'landing' })}
          />
        )}
        {view.page === 'jobs' && (
          <Jobs jobs={jobs} mlflowUrl={registry.mlflow_url} onClear={() => setJobs(js => js.filter(j => !isFinal(j.status) && !j.lost))} />
        )}
      </main>
    </div>
  )
}
