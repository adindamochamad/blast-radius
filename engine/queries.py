"""
Blast Radius — core graph engine.

Four questions a vector index cannot answer, each a graph traversal:

  1. blast_radius(pkg)       reverse transitive dependency closure (who is exposed)
  2. affected_services(pkg)  which internal lockfiles resolved an exposed version,
                             and when (temporal)
  3. shared_maintainers(pkg) which packages share a human maintainer (next target)
  4. typosquats(pkg)         names within small edit distance (lookalikes)

HydraDB OpenCypher notes learned the hard way and encoded here:
  - node id must be a non-negative int
  - variable-length MATCH is forward-from-fixed-source only
  - reverse 1-hop MATCH is fine: (x {id:$id})<-[:REL]-(v)
  - UNWIND read forms are heavily restricted; we avoid them for reads
  - WHERE is not allowed inside UNWIND MATCH
  - algo.SSpaths(relDirection:'incoming') gives whole reverse paths for viz
"""
from __future__ import annotations

import json
import time

from hydra import Hydra, IdMap, DATA_DIR


def _load_idmap() -> IdMap:
    return IdMap()


def _version_to_package(idm: IdMap) -> dict[int, tuple[str, str]]:
    """Map Version node id -> (package, version) using the id map keys."""
    out: dict[int, tuple[str, str]] = {}
    for key, vid in idm._map.items():
        if key.startswith("ver:"):
            rest = key[4:]
            pkg, _, ver = rest.rpartition("@")
            out[vid] = (pkg, ver)
    return out


def _id_to_package(idm: IdMap) -> dict[int, str]:
    return {v: k[4:] for k, v in idm._map.items() if k.startswith("pkg:")}


# ---------------------------------------------------------------------------
# 1. Blast radius: reverse-dependency transitive closure via single-hop BFS.
# ---------------------------------------------------------------------------
def blast_radius(h: Hydra, pkg: str, max_hops: int = 6) -> dict:
    idm = _load_idmap()
    key = f"pkg:{pkg}"
    if not idm.has(key):
        raise ValueError(f"package not in graph: {pkg}")
    src = idm.get(key)

    t0 = time.perf_counter()
    seen = {src: 0}
    frontier = [src]
    edges = []
    hop = 0
    while frontier and hop < max_hops:
        hop += 1
        nxt = []
        for sid in frontier:
            rows = h.run(
                "MATCH (x {id: $xid})<-[:DEPENDS_ON]-(v) "
                "RETURN v.id AS id, v.name AS name",
                xid=sid,
            )
            for r in rows:
                edges.append({"from": r["id"], "to": sid, "hop": hop})
                if r["id"] not in seen:
                    seen[r["id"]] = hop
                    nxt.append(r["id"])
        frontier = nxt
    elapsed_ms = (time.perf_counter() - t0) * 1000

    id_to_name = _id_to_package(idm)
    affected = [
        {"id": nid, "name": id_to_name.get(nid, str(nid)), "hop": h_}
        for nid, h_ in seen.items() if nid != src
    ]
    affected.sort(key=lambda a: (a["hop"], a["name"]))
    return {
        "package": pkg,
        "source_id": src,
        "exposed_count": len(affected),
        "max_hop": max(seen.values()) if seen else 0,
        "elapsed_ms": round(elapsed_ms, 1),
        "affected": affected,
        "edges": edges,
    }


def blast_paths(h: Hydra, pkg: str, max_hops: int = 5, path_count: int = 400) -> list[list]:
    """Sample real reverse-dependency paths via the native SSpaths procedure,
    for the graph visualization. Returns flat path payloads."""
    idm = _load_idmap()
    src = idm.get(f"pkg:{pkg}")
    rows = h.run(
        "CALL algo.SSpaths({sourceNode: $xid, relTypes: ['DEPENDS_ON'], "
        "relDirection: 'incoming', maxLen: $ml, pathCount: $pc}) YIELD path RETURN path",
        xid=src, ml=max_hops, pc=path_count,
    )
    return [r["path"] for r in rows]


# ---------------------------------------------------------------------------
# 2. Affected services during a time window (temporal).
# ---------------------------------------------------------------------------
def affected_services(h: Hydra, pkg: str, window_start: int, window_end: int,
                      exposed_names: list[str] | None = None) -> dict:
    idm = _load_idmap()
    exposed = set(exposed_names if exposed_names is not None else [pkg])
    v2p = _version_to_package(idm)

    installs = h.run(
        "MATCH (s:Service)-[r:INSTALLED]->(v:Version) "
        "RETURN s.name AS service, v.id AS vid, r.at AS at"
    )
    hits = []
    for row in installs:
        pkgname, ver = v2p.get(row["vid"], (None, None))
        if pkgname is None or pkgname not in exposed:
            continue
        if not (window_start <= row["at"] <= window_end):
            continue
        hits.append({
            "service": row["service"], "package": pkgname,
            "version": ver, "at": row["at"],
        })
    hits.sort(key=lambda x: x["at"])
    return {"window": [window_start, window_end], "hit_count": len(hits), "hits": hits}


# ---------------------------------------------------------------------------
# 3. Shared maintainers.
# ---------------------------------------------------------------------------
def shared_maintainers(h: Hydra, pkg: str) -> dict:
    idm = _load_idmap()
    src = idm.get(f"pkg:{pkg}")
    rows = h.run(
        "MATCH (m:Maintainer)-[:MAINTAINS]->(x:Package {id: $pid}), "
        "(m)-[:MAINTAINS]->(other:Package) "
        "RETURN m.name AS maintainer, other.name AS package",
        pid=src,
    )
    by_maint: dict[str, list[str]] = {}
    for r in rows:
        if r["package"] == pkg:
            continue
        by_maint.setdefault(r["maintainer"], []).append(r["package"])
    return {
        "package": pkg,
        "maintainers": [
            {"maintainer": m, "also_maintains": sorted(set(pkgs))}
            for m, pkgs in sorted(by_maint.items())
        ],
    }


# ---------------------------------------------------------------------------
# 4. Typosquats: names within small edit distance of the target.
# ---------------------------------------------------------------------------
def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if abs(len(a) - len(b)) > 2:
        return 99
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def typosquats(pkg: str, max_distance: int = 1) -> dict:
    catalog = json.loads((DATA_DIR / "packages.json").read_text())["packages"]
    near = []
    for name in catalog:
        if name == pkg:
            continue
        d = _levenshtein(pkg, name)
        if 1 <= d <= max_distance:
            near.append({"name": name, "distance": d})
    near.sort(key=lambda x: (x["distance"], x["name"]))
    return {"package": pkg, "candidates": near}


def typosquats_graph(h: Hydra, pkg: str) -> list[str]:
    """Graph-native lookalikes: packages linked to pkg via TYPOSQUAT_OF."""
    idm = _load_idmap()
    if not idm.has(f"pkg:{pkg}"):
        return []
    src = idm.get(f"pkg:{pkg}")
    rows = h.run(
        "MATCH (x:Package {id: $pid})<-[:TYPOSQUAT_OF]-(t) RETURN t.name AS name",
        pid=src,
    )
    return sorted({r["name"] for r in rows})


def full_report(h: Hydra, pkg: str, max_hops: int = 6) -> dict:
    br = blast_radius(h, pkg, max_hops)
    exposed_names = [pkg] + [a["name"] for a in br["affected"]]
    svc = affected_services(h, pkg, 0, 2**31 - 1, exposed_names=exposed_names)
    sm = shared_maintainers(h, pkg)
    ts = typosquats(pkg, max_distance=1)
    ts["graph_linked"] = typosquats_graph(h, pkg)
    return {"blast_radius": br, "services": svc, "shared_maintainers": sm, "typosquats": ts}


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "debug"
    with Hydra() as h:
        rep = full_report(h, target)
    br = rep["blast_radius"]
    print(f"\n=== BLAST RADIUS for '{target}' ===")
    print(f"  exposed packages : {br['exposed_count']}")
    print(f"  max hop distance : {br['max_hop']}")
    print(f"  traversal time   : {br['elapsed_ms']} ms")
    print(f"  first 15 exposed : {[a['name'] for a in br['affected'][:15]]}")
    print(f"\n=== EXPOSED SERVICES (temporal): {rep['services']['hit_count']} lockfile hits ===")
    for hrow in rep["services"]["hits"][:12]:
        print(f"  {hrow['service']:22} -> {hrow['package']}@{hrow['version']}")
    print(f"\n=== SHARED MAINTAINERS: {len(rep['shared_maintainers']['maintainers'])} ===")
    for m in rep["shared_maintainers"]["maintainers"][:6]:
        print(f"  {m['maintainer']:20} also maintains {m['also_maintains'][:6]}")
    print(f"\n=== TYPOSQUAT CANDIDATES (edit distance 1): {len(rep['typosquats']['candidates'])} ===")
    for c in rep["typosquats"]["candidates"][:10]:
        print(f"  {c['name']} (d={c['distance']})")
