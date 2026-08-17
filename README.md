# Blast Radius

**A package you trust ships malware at 09:00. Your scanner flags it at 14:00. Blast Radius lights up every exposed service in milliseconds.**

Supply-chain reverse-dependency closure on [HydraDB](https://github.com/hydra-db/hydradb).
Built for **Hack Hydra · Track 02A — Supply Chain Blast Radius**.

**Live demo:** https://blast-radius-rho.vercel.app

When an npm package is compromised, the defender's problem is *speed of blast-radius
resolution*: which of your services are exposed, which lockfiles resolved the bad
version while it was live, who shares a maintainer with it, and which typosquats sit
next to it. Every one of those is a **graph traversal**, not a similarity search — so
we model the npm ecosystem as a graph in HydraDB and answer them directly.

---

## What it does

Point it at a compromised package and it answers, in one pass:

1. **Blast radius** — the full transitive *reverse*-dependency closure. Not "what does
   this package depend on" but "everything that transitively depends on **it**."
2. **Exposed services (temporal)** — which internal services resolved a version of an
   exposed package, filtered to the window the compromised release was live.
3. **Shared-maintainer pivot** — every other package the same human can publish (the
   attacker's likely next move with one stolen credential).
4. **Typosquats** — lookalike package names within a small edit distance, surfaced both
   as `TYPOSQUAT_OF` graph edges and by client-side Levenshtein.

The demo site puts a naive `npm audit` (a flat manifest scan, blind to a zero-day
compromise with no advisory yet) **side by side** with the graph answer.

## How HydraDB is used (core, not decoration)

HydraDB **is** the product. The entire npm subgraph lives in it and every answer is an
OpenCypher read or a native path procedure against one pinned snapshot. Remove HydraDB
and there is no product — only a JSON file.

- **Ingestion** writes the graph via the Neo4j **Bolt** protocol using batched
  `UNWIND ... MERGE` statements (`engine/hydra.py`, `engine/ingest.py`).
- **Blast radius** is a single-hop reverse BFS over `DEPENDS_ON` edges, plus the native
  **`algo.SSpaths(relDirection: 'incoming')`** path procedure for the visualization
  (`engine/queries.py`).
- **Temporal** exposure uses numeric epoch comparison on `INSTALLED {at}` edges.
- **Shared maintainer** is a two-edge `MAINTAINS` pattern.
- **Typosquat** traversal walks `TYPOSQUAT_OF` edges.

The engine encodes the exact HydraDB OpenCypher subset it relies on (integer node ids,
bounded forward variable-length paths, reverse single-hop match, `UNWIND` write rules) —
see the comments in `engine/queries.py`.

## Architecture

```
 npm registry ──ingest.py──▶  HydraDB (graph)  ◀──queries.py──  FastAPI (api.py)  ◀── React/Vite site
 (real data)                  Bolt :7687                        :8000                 :5173
                              HTTP :8443
```

## Graph model

| Node | Key props |
|------|-----------|
| `Package` | `name` |
| `Version` | `name`, `version`, `published_at` (epoch) |
| `Maintainer` | `name` |
| `Service` | `name` (synthetic — see Data & disclosure) |

| Edge | From → To |
|------|-----------|
| `DEPENDS_ON` | Package → Package |
| `VERSION_OF` | Version → Package |
| `MAINTAINS` | Maintainer → Package |
| `INSTALLED {at}` | Service → Version |
| `TYPOSQUAT_OF` | Package → Package |

## Run it locally

### 1. HydraDB (Docker)

```bash
cd data
mkdir -p hydradb-data/store hydradb-data/cache
printf '%s\n' 'local-development-token-32-bytes' > hydradb-data/auth-token
docker run -d --name hydradb --user "$(id -u):$(id -g)" \
  -p 7687:7687 -p 8443:8443 -p 9090:9090 -v "$PWD/hydradb-data:/data" \
  -e CLOUD_PROVIDER=local -e LOCAL_PATH=/data/store \
  -e GRAPH_NAMESPACE=default -e GRAPH_ID=default -e GRAPH_CELL_ID=cell-0 -e GRAPH_CELLS=cell-0 \
  -e GRAPH_NODE_ID=node-0 -e GRAPH_BOLT_NODE_ADDRESSES=node-0=127.0.0.1:7687 \
  -e GRAPH_ADVERTISED_BOLT_ADDR=127.0.0.1:7687 -e GRAPH_DATA_CACHE_DIR=/data/cache \
  -e GRAPH_AUTH_TOKEN_FILE=/data/auth-token -e GRAPH_ALLOW_PLAINTEXT=true \
  -e RUST_MIN_STACK=33554432 ghcr.io/hydra-db/hydradb:latest
```

### 2. Engine — ingest npm data & serve the API

```bash
cd engine
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python ingest.py --reset --max-packages 6000 --workers 16   # builds the graph
.venv/bin/python queries.py debug                                     # sanity check
.venv/bin/uvicorn api:app --port 8000                                 # HTTP API
```

### 3. Web

```bash
cd web
npm install
npm run dev        # http://localhost:5173  (hits the live API, else bundled snapshot)
npm run build      # static build for deploy
```

The frontend is **live-first with a snapshot fallback**: if the API is unreachable it
serves bundled results from `src/data/snapshots.json`, so the deployed URL demonstrates
the product even without a running backend. Set `VITE_API_URL` to point at a live API.

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | connectivity + package count |
| `GET /api/packages?q=` | name autocomplete |
| `GET /api/graph/{pkg}` | node/link payload of the blast radius |
| `GET /api/report/{pkg}` | full report (blast, services, maintainers, typosquats) |
| `GET /api/compare/{pkg}` | naive direct-only vs full transitive closure |

## Data & disclosure

- **Packages, versions, timestamps, and maintainers are real**, crawled from the public
  npm registry (`https://registry.npmjs.org`).
- **Services** (`checkout-api`, `payments-worker`, …) are a **synthetic** fictional
  company used to demonstrate the temporal lockfile-resolution query. They are generated
  in `ingest.py` and are clearly not real deployments.
- A small set of **documented typosquat-style names** is injected and linked with
  `TYPOSQUAT_OF` edges to demonstrate lookalike detection.

## Tech stack

- **Graph DB:** HydraDB (OpenCypher over Bolt + native path procedures)
- **Engine/API:** Python 3, `neo4j` driver, FastAPI, Uvicorn
- **Web:** Vite + React + TypeScript, React Three Fiber (WebGL hero), Lenis, Canvas 2D
- **Type/fonts:** Clash Display + General Sans (Fontshare), JetBrains Mono

## Attribution

- HydraDB — https://github.com/hydra-db/hydradb (AGPL-3.0)
- npm registry public API for package metadata
- Fontshare (Clash Display, General Sans), Google Fonts (JetBrains Mono)
- Not affiliated with npm, Inc.

## License

[GNU AGPL-3.0](./LICENSE) — matching HydraDB.
