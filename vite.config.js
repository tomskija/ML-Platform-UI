import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Calculator registry. In ML-Dev-Workspace it's generated from projects.json and mounted in
// (CALCULATORS_FILE). Running the UI on its own falls back to calculators.local.json.
const registryPath = process.env.CALCULATORS_FILE || path.resolve(__dirname, 'calculators.local.json')
const inDocker = process.env.IN_DOCKER === '1'
// Running the UI in its own container (not the workspace) reaches APIs on the host through CALC_HOST
const calcHost = process.env.CALC_HOST || 'localhost'

function loadRegistry() {
  const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
  return {
    mlflow_url: raw.mlflow_url,
    calculators: raw.calculators.map(c => ({ ...c, target: inDocker ? c.internal_url : c.host_url.replace('localhost', calcHost) })),
  }
}

// /api/<name>/... goes to that calculator's API, so the browser only ever talks to the UI server
function proxyFor(registry) {
  const proxy = {}
  for (const c of registry.calculators) {
    proxy[`/api/${c.name}`] = {
      target: c.target,
      changeOrigin: true,
      rewrite: p => p.replace(new RegExp(`^/api/${c.name}`), ''),
    }
  }
  return proxy
}

// Serves the registry to the browser without the internal URLs
function registryPlugin() {
  return {
    name: 'calculator-registry',
    configureServer(server) {
      server.middlewares.use('/calculators.json', (req, res) => {
        const r = loadRegistry()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          mlflow_url: r.mlflow_url,
          calculators: r.calculators.map(c => ({ name: c.name, label: c.label, api_base: `/api/${c.name}` })),
        }))
      })
    },
  }
}

const registry = loadRegistry()

export default defineConfig({
  plugins: [react(), registryPlugin()],
  server: {
    port: 5173,
    host: true,
    proxy: proxyFor(registry),
  },
})
