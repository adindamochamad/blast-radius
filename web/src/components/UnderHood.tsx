import { STATS } from "../lib/api";

const ROWS = [
  ["nodes", "Package · Version · Maintainer · Service"],
  ["edges", "DEPENDS_ON · VERSION_OF · MAINTAINS · INSTALLED · TYPOSQUAT_OF"],
  ["closure", "single-hop reverse BFS + algo.SSpaths(relDirection:'incoming')"],
  ["storage", "object-store-native · GraphBLAS traversal · Bolt + HTTP"],
];

export default function UnderHood() {
  return (
    <section className="hood" id="hydra">
      <div className="wrap">
        <span className="mono-tag">05 / UNDER THE HOOD</span>
        <div className="hood-grid">
          <div>
            <h2 className="display hood-title">
              Built on <span className="trace">HydraDB.</span>
            </h2>
            <p className="hood-lede">
              HydraDB does the real work: the entire npm subgraph lives in it, and
              every answer on this page is an OpenCypher read or a native path
              procedure against one pinned snapshot. Remove HydraDB and there is
              no product — only a JSON file and a prayer.
            </p>
            <p className="hood-lede dim" style={{ marginTop: 16 }}>
              This demo indexes a ~6,000-package subgraph. The same engine and the
              same queries run unchanged on HydraDB's object-store architecture at
              tens of millions of versioned nodes — the scale of the real npm graph.
            </p>
            <div className="hood-metrics">
              <div>
                <div className="display hood-num">{STATS.packages.toLocaleString()}</div>
                <div className="mono">packages</div>
              </div>
              <div>
                <div className="display hood-num">33,505</div>
                <div className="mono">versions</div>
              </div>
              <div>
                <div className="display hood-num">~300<span className="hood-unit">ms</span></div>
                <div className="mono">reverse closure</div>
              </div>
            </div>
          </div>

          <pre className="cypher">
            <code>{`CALL algo.SSpaths({
  sourceNode:   $compromised,
  relTypes:     ['DEPENDS_ON'],
  relDirection: 'incoming',   // who depends on ME
  maxLen:       4,
  pathCount:    400
}) YIELD path
RETURN path`}</code>
          </pre>
        </div>

        <div className="hood-rows mono">
          {ROWS.map(([k, v]) => (
            <div className="hood-row" key={k}>
              <span className="hood-k signal">{k}</span>
              <span className="hood-v">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
