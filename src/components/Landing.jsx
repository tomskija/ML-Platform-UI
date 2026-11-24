// Landing page: one card per calculator in the registry, live online/offline status,
// open one to set inputs, or tick several and run them all at once.

export default function Landing({ calculators, health, schemas, selected, onToggle, onOpen, onRunSelected }) {
  const online = calculators.filter(c => health[c.name] === 'online').length
  const runnable = selected.filter(n => health[n] === 'online' && schemas[n])

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Calculators</h1>
          <p className="page-sub">{online} of {calculators.length} online</p>
        </div>
        <button className="btn btn-primary" disabled={runnable.length === 0} onClick={onRunSelected}>
          Run selected ({runnable.length})
        </button>
      </div>

      <div className="card-grid">
        {calculators.map(c => {
          const status = health[c.name] || 'checking'
          const schema = schemas[c.name]
          const isOn = status === 'online'
          return (
            <div key={c.name} className={`calc-card ${isOn ? '' : 'calc-card-off'}`}>
              <div className="calc-card-top">
                <span className={`dot dot-${status}`} />
                <span className="mono dim">{c.name}</span>
                <label className="select-box">
                  <input type="checkbox" disabled={!isOn || !schema} checked={selected.includes(c.name)} onChange={() => onToggle(c.name)} />
                  select
                </label>
              </div>
              <h2 className="calc-card-title">{schema?.title || c.label}</h2>
              <p className="calc-card-desc">
                {isOn ? (schema?.description || 'Loading schema…') : status === 'checking' ? 'Checking…' : <>Offline. Start it with <code>make up P={c.name}</code></>}
              </p>
              <div className="calc-card-foot">
                <span className="mono dim">{c.label}</span>
                <button className="btn" disabled={!isOn || !schema} onClick={() => onOpen(c.name)}>Open</button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="hint">Selected calculators run with whatever inputs you last set on their page, or their defaults.</p>
    </section>
  )
}
