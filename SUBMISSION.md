# Hack Hydra — Submission Kit (Blast Radius)

Everything you need for the final step. Two things only you can do:
**record the ≤3-min video** and **submit the Google Form** (https://forms.gle/WEwqEmmN7Bkp4HyJ6).

---

## A. Before you record

Run the **live backend** so the demo shows real HydraDB queries (more impressive than the
static snapshot):

```bash
# 1. HydraDB (if not running)
open -a OrbStack
docker start hydradb        # already ingested with 2,526 packages

# 2. API
cd engine && .venv/bin/uvicorn api:app --port 8000

# 3. Web (live mode — hits the API)
cd web && npm run dev       # http://localhost:5173
```

Record at 1440×900, hide bookmarks bar, cursor visible. Keep it under 3:00 — anything
past the mark may not be reviewed.

---

## B. Video script (2:50, four beats the rules ask for)

**[0:00–0:30] The problem — make them sit up**
> "In the TanStack compromise this May, 84 malicious package versions shipped in six
> minutes. Here's the question that keeps defenders up at night: a package you depend on
> is compromised at 9 AM. Which of your services are exposed by 9:06? Your scanner won't
> tell you for hours — because it's the wrong kind of tool."

*(Screen: hero. Move the mouse so the 3D dependency graph is alive.)*

**[0:30–1:00] What it is**
> "This is Blast Radius. I built the npm dependency ecosystem as a graph in HydraDB —
> 2,500 packages, 14,000 versions, real maintainers and timestamps — and I ask it the
> questions a vector database structurally cannot answer."

*(Scroll to the 5-minute problem section, then to the live demo.)*

**[1:00–2:10] The demo — the money shot**
> "Same alert, two tools. On the left, npm audit: it checks an advisory database, finds
> zero known vulnerabilities, and sees only 84 direct dependents. It's blind to a
> zero-day compromise."
>
> *(Click DETONATE / type `debug`.)*
>
> "On the right, Blast Radius runs a transitive reverse-dependency closure in HydraDB —
> and in about 150 milliseconds it lights up **160 exposed packages, four hops deep**.
> Then it goes further: which internal services resolved a bad version and when" *(click
> Services)* "which maintainers control other packages — one leaked credential, more
> victims" *(click Maintainers)* "and typosquats sitting one edit away." *(click
> Typosquats.)*

**[2:10–2:45] How HydraDB is used — and why it matters**
> "HydraDB isn't decoration — it's the engine. Every answer is OpenCypher or the native
> `algo.SSpaths` path procedure against one snapshot."

*(Scroll to Under the Hood — show the Cypher block.)*

> "Reverse closure, temporal resolution, maintainer pivots — none are similarity search.
> Cosine distance can't express 'reachable through a chain of typed edges.' A graph can.
> That's the whole point of the track."

**[2:45–2:50] Close**
> "Blast Radius. Know your blast radius before the worm does. Open source, on HydraDB."

---

## C. Submission form — paste-ready answers

**Project name**
> Blast Radius

**Short project description**
> A supply-chain "blast radius" engine on HydraDB: model the npm ecosystem as a graph and
> answer, in milliseconds, which services a compromised package exposes — a transitive
> reverse-dependency closure that a vector index cannot compute.

**Problem being addressed**
> Automated supply-chain worms publish dozens of malicious package versions in minutes
> (e.g. the TanStack compromise: 84 artifacts in 6 minutes). Advisory-based scanners like
> `npm audit` react hours later and only see direct dependents. The defender's real
> question — "which of my services are transitively exposed, right now?" — is a graph
> traversal over tens of millions of versioned nodes, not a similarity search.

**What you built**
> A graph of 2,526 real npm packages / 14,326 versions / maintainers / timestamps in
> HydraDB, plus an engine that answers four questions: (1) transitive reverse-dependency
> blast radius, (2) which internal services resolved an exposed version within the live
> window (temporal), (3) shared-maintainer pivots, (4) typosquat lookalikes. A FastAPI
> layer serves it to an interactive site that puts npm audit side-by-side with Blast
> Radius.

**Deployed project link**
> https://blast-radius-rho.vercel.app

**How the project uses the HydraDB Open Source Repo**
> HydraDB is the core datastore and query engine. The npm subgraph is ingested over the
> Neo4j Bolt protocol using batched UNWIND/MERGE writes. Every query is OpenCypher against
> one pinned snapshot: blast radius is a single-hop reverse BFS over DEPENDS_ON plus the
> native `algo.SSpaths(relDirection:'incoming')` path procedure for visualization;
> temporal exposure filters INSTALLED{at} epoch edges; shared-maintainer is a two-edge
> MAINTAINS pattern; typosquats traverse TYPOSQUAT_OF edges. Remove HydraDB and there is
> no product.

**Tech stack used**
> HydraDB (OpenCypher over Bolt + native path procedures); Python, neo4j driver, FastAPI,
> Uvicorn; Vite + React + TypeScript, React Three Fiber (WebGL), Lenis, Canvas 2D;
> Clash Display / General Sans / JetBrains Mono.

**Team members and individual contributions**
> Adinda Panca Mochamad — solo. Graph data model, npm ingestion pipeline, HydraDB query
> engine (blast radius / temporal / maintainer / typosquat), FastAPI service, and the full
> front-end demo and deployment.

**GitHub repository link**
> https://github.com/adindamochamad/blast-radius

**3-minute demo video link**
> _(paste your unlisted YouTube link — make sure it's viewable without requesting access)_

---

## D. Final pre-submit checklist
- [ ] Repo is public, README + AGPL LICENSE present, no commits before Aug 12 ✔ (fresh repo)
- [ ] Deployed link opens for anyone ✔ (snapshot fallback works without backend)
- [ ] Video ≤ 3:00, unlisted/public, no access request needed
- [ ] All form fields filled, video link pasted
- [ ] Submit before **Aug 20, 23:59 PT** (≈ Aug 21, 13:59 WIB)
