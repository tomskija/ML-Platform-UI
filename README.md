# ML-Platform-UI

**By: Jackson R. Tomski**

This is the front end for all of my ML calculators. A landing page shows every calculator I have, whether it's online right now, and lets me open one to set its inputs or tick several and run them all at once. Jobs from every calculator land in one place with their status, outputs, and a link to the run in MLflow.

The UI doesn't know anything about a specific calculator ahead of time. Each calculator API serves a `/schema` describing its inputs, and the form is built from that. Add an input on the Python side and it shows up here with no UI changes.

---

## What's Inside

### Landing Page

One card per calculator in the registry. Each card checks the calculator's `/health` every few seconds and shows green (online) or red (offline), so whatever dev containers I have running are the calculators I can use. Offline cards show the `make up` command to start them.

Tick a few online calculators and **Run selected** submits all of them at once, each with whatever inputs were last set on its page (or its defaults).

### Calculator Pages

Forms are generated from each calculator's `/schema`:

| Field type | Shows up as | Sent as |
|------------|-------------|---------|
| `number`, `integer` | Number box | param |
| `boolean` | Toggle | param (1 / 0) |
| `select` | Dropdown | param |
| `string` | Text box | param |
| `list_number`, `list_string` | Comma separated text | table |

Fields are grouped the same way the schema groups them, and `show_if` hides fields that don't apply (e.g. the manifest path only shows when the dataset is `existing`, the torus tube ratio only shows for a torus). Inputs are remembered per calculator in the browser.

### Jobs

Every job from every calculator, newest first. Status updates every couple of seconds (pending, queued, running, complete, failed). Click a job to see its output: scalar values, lists, the error message if it failed, and a button to open the run in MLflow.

### Calculator Contract

Every calculator API answers the same endpoints, which is what lets one UI drive all of them:

| Method | Endpoint | What the UI uses it for |
|--------|----------|-------------------------|
| `GET`  | `/health` | Online / offline dot |
| `GET`  | `/schema` | Building the form |
| `POST` | `/calculate` | Submitting a run with `{"inJson": {...}}`, returns a `job_id` |
| `GET`  | `/runs/{job_id}/status` | Polling progress |
| `GET`  | `/jobs/{job_id}/output` | Showing results |

### How It Reaches the Calculators

The browser only talks to the UI server. Anything under `/api/<name>/` gets proxied to that calculator's API, using the calculator registry:

```
Browser → /api/weather/health → UI server (Vite proxy) → weather-api:8002/health
```

No CORS headaches, and it's the same idea as an ingress in front of services on Kubernetes.

---

## Getting Started

**Normal way: through ML-Dev-Workspace.** The workspace generates the registry from its `projects.json` and runs the UI as a service next to the calculators:

```bash
cd ML-Dev-Workspace
make up              # calculators, shared MLflow and the UI
```

Then open http://localhost:5173.

**On its own:** start whichever calculator APIs you want (each repo's `docker compose up` runs its API), then:

```bash
npm install
npm run dev
```

It reads `calculators.local.json`, which points at the APIs on localhost.

| Service | URL |
|---------|-----|
| UI      | http://localhost:5173 |

---

## Configuration

The registry is a small JSON file:

```json
{
  "mlflow_url": "http://localhost:5050",
  "calculators": [
    { "name": "weather", "label": "Weather-Forecasting-ML", "internal_url": "http://weather-api:8002", "host_url": "http://localhost:8002" }
  ]
}
```

| Setting | What it does |
|---------|--------------|
| `CALCULATORS_FILE` | Path to the registry (ML-Dev-Workspace mounts its generated one here) |
| `IN_DOCKER=1` | Use `internal_url` (container to container) instead of `host_url` |
| `CALC_HOST` | Swap `localhost` in `host_url` for another host, e.g. `host.docker.internal` from the standalone dev container |

The browser only ever sees `/api/<name>`, never the internal URLs.

---

## Project Structure

```
ML-Platform-UI/
├── .devcontainer/devcontainer.json     # Standalone Node dev container
├── .github/workflows/ci.yml            # Install and build
├── src/
│   ├── App.jsx                         # Registry, health polling, job polling, navigation
│   ├── api.js                          # Calculator API client, schema → input JSON
│   ├── styles.css                      # Same design tokens as the PPML dashboard
│   └── components/
│       ├── Landing.jsx                 # Calculator cards, multi-select run
│       ├── CalculatorPage.jsx          # Form built from /schema
│       └── Jobs.jsx                    # Jobs across all calculators, outputs
├── calculators.local.json              # Registry for running outside the workspace
├── vite.config.js                      # Dev server, /api proxy, serves the registry
├── index.html
└── package.json
```

---

## Dependencies

Node 20 · React 18 · Vite
