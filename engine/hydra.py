"""
Thin HydraDB client for Blast Radius.

HydraDB is accessed via the Neo4j Bolt protocol (neo4j driver 6.x).
Key HydraDB constraints baked into this client:
  - node `id` must be a non-negative integer (see IdMap for name->int)
  - one statement per request
  - bulk writes go through `UNWIND $rows AS row` with a list-of-maps param
  - variable-length paths must be bounded (e.g. [:DEPENDS_ON*1..5])
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Iterable

from neo4j import GraphDatabase

BOLT_URI = os.environ.get("HYDRA_BOLT_URI", "bolt://127.0.0.1:7687")
TOKEN = os.environ.get("HYDRA_TOKEN", "local-development-token-32-bytes")
DATABASE = os.environ.get("HYDRA_DB", "default")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ID_MAP_PATH = DATA_DIR / "id_map.json"


class IdMap:
    """Deterministic, persistent string-key -> non-negative-int allocator.

    Keys are namespaced strings like 'pkg:react', 'ver:react@1.2.3',
    'maint:sindresorhus', 'svc:checkout-api'. Ids are stable across runs.
    """

    def __init__(self, path: Path = ID_MAP_PATH):
        self.path = path
        self._lock = threading.Lock()
        self._map: dict[str, int] = {}
        self._next = 0
        if path.exists():
            raw = json.loads(path.read_text())
            self._map = raw["map"]
            self._next = raw["next"]

    def get(self, key: str) -> int:
        with self._lock:
            if key not in self._map:
                self._map[key] = self._next
                self._next += 1
            return self._map[key]

    def has(self, key: str) -> bool:
        return key in self._map

    def save(self) -> None:
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps({"next": self._next, "map": self._map}))

    def __len__(self) -> int:
        return len(self._map)


class Hydra:
    def __init__(self, uri: str = BOLT_URI, token: str = TOKEN, database: str = DATABASE):
        self._driver = GraphDatabase.driver(uri, auth=("neo4j", token))
        self._database = database

    def close(self) -> None:
        self._driver.close()

    def __enter__(self) -> "Hydra":
        self._driver.verify_connectivity()
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def run(self, query: str, **params: Any) -> list[dict]:
        with self._driver.session(database=self._database) as s:
            return [r.data() for r in s.run(query, **params)]

    def write(self, query: str, **params: Any) -> None:
        with self._driver.session(database=self._database) as s:
            s.run(query, **params).consume()

    # ---- batch helpers -------------------------------------------------
    def upsert_nodes(self, label: str, rows: list[dict], batch: int = 500) -> None:
        """rows: [{'id': int, 'name': str, ...extra scalar props}]"""
        if not rows:
            return
        prop_keys = [k for k in rows[0].keys() if k != "id"]
        set_clause = ", ".join([f"n:{label}"] + [f"n.{k} = row.{k}" for k in prop_keys])
        q = f"UNWIND $rows AS row MERGE (n {{id: row.id}}) SET {set_clause}"
        for chunk in _chunks(rows, batch):
            self.write(q, rows=chunk)

    def create_edges(
        self,
        rel: str,
        src_label: str,
        dst_label: str,
        rows: list[dict],
        props: Iterable[str] = (),
        batch: int = 500,
    ) -> None:
        """rows: [{'rid': int, 's': int, 'd': int, ...props}]. Idempotent via MERGE.

        HydraDB requires:
          - exactly one label on each endpoint of the batch MATCH
          - a non-negative int id on the MERGE'd relationship (row.rid)
        """
        rows = list(rows)
        if not rows:
            return
        props = list(props)
        set_clause = ("SET " + ", ".join(f"r.{p} = row.{p}" for p in props)) if props else ""
        q = (
            f"UNWIND $rows AS row "
            f"MATCH (s:{src_label} {{id: row.s}}), (d:{dst_label} {{id: row.d}}) "
            f"MERGE (s)-[r:{rel} {{id: row.rid}}]->(d) {set_clause}"
        ).strip()
        for chunk in _chunks(rows, batch):
            self.write(q, rows=chunk)


def _chunks(seq: list, n: int):
    for i in range(0, len(seq), n):
        yield seq[i : i + n]
