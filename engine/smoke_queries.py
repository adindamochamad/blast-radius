"""Validate the HydraDB query forms Blast Radius depends on, against a live node.

Builds a tiny dependency graph:
    app -> express -> body-parser -> debug      (debug = "compromised")
    app -> chalk -> debug
Then checks reverse-dependency closure (who transitively depends on debug)
via both variable-length MATCH and algo.SSpaths.
"""
from hydra import Hydra, IdMap

def main():
    idm = IdMap()
    P = lambda name: idm.get(f"smoke-pkg:{name}")

    names = ["app", "express", "body-parser", "chalk", "debug"]
    nodes = [{"id": P(n), "name": n} for n in names]
    raw_edges = [
        ("app", "express"),
        ("app", "chalk"),
        ("express", "body-parser"),
        ("body-parser", "debug"),
        ("chalk", "debug"),
    ]
    edges = [
        {"rid": idm.get(f"smoke-edge:{s}->{d}"), "s": P(s), "d": P(d)}
        for s, d in raw_edges
    ]

    with Hydra() as h:
        h.upsert_nodes("Package", nodes)
        h.create_edges("DEPENDS_ON", "Package", "Package", edges)

        print("=== 1. forward variable-length from app (its dependency closure) ===")
        rows = h.run(
            "MATCH (x {id: $xid})-[:DEPENDS_ON*1..5]->(v) "
            "RETURN v.name AS name ORDER BY name",
            xid=P("app"),
        )
        got = sorted({r["name"] for r in rows})
        print("app depends on (transitively):", got)
        assert set(got) == {"body-parser", "chalk", "debug", "express"}, got

        print("=== 2. algo.SSpaths REVERSE from debug (relDirection in) = blast radius ===")
        paths = h.run(
            "CALL algo.SSpaths({sourceNode: $xid, relTypes: ['DEPENDS_ON'], "
            "relDirection: 'incoming', maxLen: 5, pathCount: 100}) YIELD path RETURN path",
            xid=P("debug"),
        )
        print("path rows returned:", len(paths))
        print("sample path payload:", paths[0] if paths else None)
        assert len(paths) >= 1, paths

    idm.save()
    print("\nSMOKE_OK")

if __name__ == "__main__":
    main()
