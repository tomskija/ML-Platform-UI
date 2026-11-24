// Every calculator API follows the same contract, so one small client covers all of them.
// Requests go to /api/<name>/..., which the UI server proxies to that calculator.

async function request(base, path, options = {}) {
  const r = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!r.ok) {
    let detail = r.statusText
    try { detail = (await r.json()).detail || detail } catch { /* not JSON */ }
    throw new Error(`${r.status} ${detail}`)
  }
  return r.json()
}

export const loadRegistry = () => fetch('/calculators.json').then(r => r.json())

export const getHealth = base => request(base, '/health')
export const getSchema = base => request(base, '/schema')
export const getStatus = (base, jobId) => request(base, `/runs/${jobId}/status`)
export const getOutput = (base, jobId) => request(base, `/jobs/${jobId}/output`)
export const submitRun = (base, inJson) =>
  request(base, '/calculate', { method: 'POST', body: JSON.stringify({ inJson }) })

// Form values -> the params/tables input JSON every calculator expects
export function buildInJson(schema, values) {
  const params = []
  const tables = []
  for (const group of schema.groups) {
    for (const f of group.fields) {
      if (!isVisible(f, values)) continue
      const v = values[f.name]
      if (f.kind === 'table') {
        tables.push({ name: f.name, values: v })
      } else if (f.type === 'boolean') {
        params.push({ name: f.name, value: v ? 1 : 0, valueType: 1 })
      } else if (v !== '' && v !== null && v !== undefined) {
        params.push({ name: f.name, value: v, valueType: f.type === 'string' || f.type === 'select' ? 0 : 2 })
      }
    }
  }
  return { data: { params, tables } }
}

export function defaultValues(schema) {
  const values = {}
  for (const group of schema.groups) for (const f of group.fields) values[f.name] = f.default
  return values
}

// show_if: {field: [allowed values]}, every condition has to match
export function isVisible(field, values) {
  if (!field.show_if) return true
  return Object.entries(field.show_if).every(([k, allowed]) => allowed.includes(values[k]))
}

export const isFinal = status => status === 'complete' || status === 'failed'
