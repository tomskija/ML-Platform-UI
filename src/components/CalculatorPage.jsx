import { useState } from 'react'
import { isVisible } from '../api.js'

// Calculator page: the form is built entirely from the calculator's /schema,
// so adding an input on the Python side shows up here with no UI changes.

function Field({ field, value, onChange }) {
  const [text, setText] = useState(Array.isArray(value) ? value.join(', ') : '')
  const [bad, setBad] = useState(false)

  if (field.type === 'boolean') {
    return (
      <label className="toggle">
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
        <span>{value ? 'on' : 'off'}</span>
      </label>
    )
  }
  if (field.type === 'select') {
    return (
      <select className="input" value={value} onChange={e => onChange(e.target.value)}>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (field.type === 'list_number' || field.type === 'list_string') {
    // Comma separated in the box, real array in state
    const commit = t => {
      setText(t)
      const parts = t.split(',').map(s => s.trim()).filter(Boolean)
      if (field.type === 'list_string') { setBad(false); onChange(parts); return }
      const nums = parts.map(Number)
      const ok = nums.every(n => Number.isFinite(n))
      setBad(!ok)
      if (ok) onChange(nums)
    }
    return <input className={`input mono ${bad ? 'input-bad' : ''}`} value={text} onChange={e => commit(e.target.value)} />
  }
  if (field.type === 'number' || field.type === 'integer') {
    return (
      <input className="input mono" type="number" step={field.type === 'integer' ? 1 : 'any'} min={field.min} max={field.max}
             value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
    )
  }
  return <input className="input" value={value ?? ''} onChange={e => onChange(e.target.value)} />
}

export default function CalculatorPage({ calc, status, schema, values, onChange, onReset, onRun, onBack }) {
  const [resetKey, setResetKey] = useState(0)
  if (!calc) return null
  if (!schema) return <section><button className="link" onClick={onBack}>← Calculators</button><p className="page-sub">Waiting for {calc.label}…</p></section>

  const set = (name, v) => onChange({ ...values, [name]: v })

  return (
    <section>
      <button className="link" onClick={onBack}>← Calculators</button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{schema.title}</h1>
          <p className="page-sub">{schema.description}</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => { onReset(); setResetKey(k => k + 1) }}>Reset to defaults</button>
          <button className="btn btn-primary" disabled={status !== 'online'} onClick={onRun}>Run</button>
        </div>
      </div>

      <div key={resetKey}>
        {schema.groups.map(group => {
          const fields = group.fields.filter(f => isVisible(f, values))
          if (fields.length === 0) return null
          return (
            <div key={group.name} className="panel">
              <div className="panel-title">{group.name}</div>
              <div className="form-grid">
                {fields.map(f => (
                  <div key={f.name} className="form-row">
                    <label className="form-label">
                      {f.label}
                      {f.help && <span className="form-help">{f.help}</span>}
                    </label>
                    <Field field={f} value={values[f.name]} onChange={v => set(f.name, v)} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
