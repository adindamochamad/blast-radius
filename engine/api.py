"""
Blast Radius — HTTP API over the HydraDB graph engine.

Run:  .venv/bin/uvicorn api:app --reload --port 8000
"""
from __future__ import annotations

import json
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from hydra import Hydra, DATA_DIR
import queries as q

app = FastAPI(title="Blast Radius API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# one long-lived driver for the process
_hydra = Hydra()


@lru_cache(maxsize=1)
def _catalog() -> dict:
    return json.loads((DATA_DIR / "packages.json").read_text())


@app.get("/api/health")
def health():
    try:
        _hydra._driver.verify_connectivity()
        return {"ok": True, "packages": _catalog()["count"]}
    except Exception as e:
        raise HTTPException(503, f"hydra unavailable: {e}")


@app.get("/api/stats")
def stats():
    cat = _catalog()
    return {
        "packages": cat["count"],
        "generated_at": cat.get("generated_at"),
    }


@app.get("/api/packages")
def packages(q_: str = Query("", alias="q"), limit: int = 12):
    names = list(_catalog()["packages"].keys())
    ql = q_.lower().strip()
    if ql:
        starts = [n for n in names if n.lower().startswith(ql)]
        contains = [n for n in names if ql in n.lower() and not n.lower().startswith(ql)]
        names = starts + contains
    return {"packages": sorted(names[:limit]) if not ql else names[:limit]}


@app.get("/api/report/{pkg:path}")
def report(pkg: str, hops: int = 6):
    try:
        return q.full_report(_hydra, pkg, max_hops=hops)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.get("/api/graph/{pkg:path}")
def graph(pkg: str, hops: int = 4, limit: int = 260):
    """Viz-friendly node/link payload of the reverse-dependency blast radius."""
    try:
        br = q.blast_radius(_hydra, pkg, max_hops=hops)
    except ValueError as e:
        raise HTTPException(404, str(e))

    # keep the closest `limit` nodes for render performance
    affected = br["affected"][: max(0, limit - 1)]
    keep_ids = {a["id"] for a in affected}
    keep_ids.add(br["source_id"])

    nodes = [{"id": br["source_id"], "name": pkg, "hop": 0, "kind": "source"}]
    for a in affected:
        nodes.append({"id": a["id"], "name": a["name"], "hop": a["hop"], "kind": "pkg"})
    links = [
        {"source": e["from"], "target": e["to"]}
        for e in br["edges"]
        if e["from"] in keep_ids and e["to"] in keep_ids
    ]
    return {
        "package": pkg,
        "stats": {
            "exposed_count": br["exposed_count"],
            "max_hop": br["max_hop"],
            "elapsed_ms": br["elapsed_ms"],
            "rendered_nodes": len(nodes),
        },
        "nodes": nodes,
        "links": links,
    }


@app.get("/api/compare/{pkg:path}")
def compare(pkg: str, hops: int = 6):
    """The before/after: a naive scanner sees only DIRECT dependents (1 hop);
    the graph sees the full transitive closure."""
    try:
        one = q.blast_radius(_hydra, pkg, max_hops=1)
        full = q.blast_radius(_hydra, pkg, max_hops=hops)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {
        "package": pkg,
        "naive_direct_only": {
            "exposed_count": one["exposed_count"],
            "elapsed_ms": one["elapsed_ms"],
            "note": "what a flat manifest scan / npm audit surfaces",
        },
        "graph_full_closure": {
            "exposed_count": full["exposed_count"],
            "max_hop": full["max_hop"],
            "elapsed_ms": full["elapsed_ms"],
            "note": "transitive reverse-dependency closure in HydraDB",
        },
        "multiplier": round(
            full["exposed_count"] / one["exposed_count"], 1
        ) if one["exposed_count"] else None,
    }
