import { useEffect, useMemo, useRef, useState } from "react";
import BlastCanvas from "./BlastCanvas";
import {
  DEMO_PACKAGES,
  getCompare,
  getGraph,
  getReport,
  hasData,
  isLive,
  searchPackages,
  type CompareResp,
  type GraphResp,
  type Report,
} from "../lib/api";

function useCountUp(target: number, run: number, dur = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setV(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
}

type Tab = "services" | "maintainers" | "typosquats";

export default function LiveDemo() {
  const [pkg, setPkg] = useState("debug");
  const [query, setQuery] = useState("");
  const [graph, setGraph] = useState<GraphResp | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [compare, setCompare] = useState<CompareResp | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("services");
  const [auditPhase, setAuditPhase] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => (query ? searchPackages(query, 6) : []),
    [query]
  );

  async function detonate(name: string) {
    setLoading(true);
    setAuditPhase(0);
    try {
      const [g, r, c] = await Promise.all([
        getGraph(name),
        getReport(name),
        getCompare(name),
      ]);
      setGraph(g);
      setReport(r);
      setCompare(c);
      setPkg(name);
      setRunKey((k) => k + 1);
      // fake npm-audit staged reveal
      setTimeout(() => setAuditPhase(1), 350);
      setTimeout(() => setAuditPhase(2), 1100);
      setTimeout(() => setAuditPhase(3), 1900);
    } catch {
      /* package not in demo snapshot */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    detonate("debug");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exposed = useCountUp(graph?.stats.exposed_count ?? 0, runKey);
  const ms = useCountUp(Math.round(graph?.stats.elapsed_ms ?? 0), runKey, 700);

  return (
    <section className="demo" id="demo">
      <div className="wrap">
        <div className="demo-head">
          <span className="mono-tag">03 / LIVE DEMO</span>
          <h2 className="display demo-title">
            Same alert. Two tools.
            <br />
            One of them is <span className="signal">blind.</span>
          </h2>
        </div>

        {/* control bar */}
        <div className="demo-control">
          <div className="search">
            <span className="mono search-prefix">compromise&nbsp;›</span>
            <input
              ref={inputRef}
              value={query}
              placeholder={pkg}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) {
                  detonate(suggestions[0]);
                  setQuery("");
                }
              }}
              spellCheck={false}
            />
            {suggestions.length > 0 && (
              <ul className="search-drop">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => {
                        detonate(s);
                        setQuery("");
                      }}
                      data-cursor="lock"
                    >
                      <span>{s}</span>
                      {hasData(s) ? (
                        <span className="mono trace">demo-ready</span>
                      ) : isLive() ? (
                        <span className="mono dim">live</span>
                      ) : (
                        <span className="mono dim">no snapshot</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="demo-chips">
            {DEMO_PACKAGES.map((p) => (
              <button
                key={p}
                className={`chip ${p === pkg ? "chip-on" : ""}`}
                onClick={() => detonate(p)}
                data-cursor="lock"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* split screen */}
        <div className="split">
          {/* LEFT: naive scanner */}
          <div className="panel panel-naive">
            <div className="panel-top mono">
              <span>npm audit</span>
              <span className="dim">flat manifest scan</span>
            </div>
            <div className="term">
              <div className="term-line">
                <span className="dim">$</span> npm audit --package {pkg}
              </div>
              {auditPhase >= 1 && (
                <div className="term-line dim">scanning advisory database…</div>
              )}
              {auditPhase >= 2 && (
                <div className="term-line dim">
                  cross-referencing {pkg} against known CVEs…
                </div>
              )}
              {auditPhase >= 3 && (
                <>
                  <div className="term-ok">found 0 known vulnerabilities</div>
                  <div className="term-line dim" style={{ marginTop: 14 }}>
                    # the compromise is 5 hours old. no advisory exists yet.
                  </div>
                  <div className="term-line dim">
                    # audit sees {compare?.naive_direct_only.exposed_count ?? "—"}{" "}
                    direct dependents — and stops there.
                  </div>
                  <div className="term-blind">▉ BLIND TO TRANSITIVE EXPOSURE</div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: blast radius */}
          <div className="panel panel-blast">
            <div className="panel-top mono">
              <span className="signal">blast radius · hydradb</span>
              <span className="dim">reverse-dependency closure</span>
            </div>
            <div className="blast-stage">
              <BlastCanvas graph={graph} runKey={runKey} />
              <div className="blast-stats">
                <div className="bstat">
                  <div className="bstat-num display signal">{exposed}</div>
                  <div className="mono">packages exposed</div>
                </div>
                <div className="bstat">
                  <div className="bstat-num display">{graph?.stats.max_hop ?? 0}</div>
                  <div className="mono">hops deep</div>
                </div>
                <div className="bstat">
                  <div className="bstat-num display trace">{ms}<span className="bstat-unit">ms</span></div>
                  <div className="mono">traversal</div>
                </div>
              </div>
            </div>

            {/* intelligence tabs */}
            <div className="tabs mono">
              {(["services", "maintainers", "typosquats"] as Tab[]).map((t) => (
                <button
                  key={t}
                  className={tab === t ? "tab-on" : ""}
                  onClick={() => setTab(t)}
                  data-cursor="lock"
                >
                  {t}
                  <span className="tab-count">
                    {t === "services" && (report?.services.hit_count ?? 0)}
                    {t === "maintainers" &&
                      (report?.shared_maintainers.maintainers.length ?? 0)}
                    {t === "typosquats" &&
                      ((report?.typosquats.graph_linked.length ?? 0) +
                        (report?.typosquats.candidates.length ?? 0))}
                  </span>
                </button>
              ))}
            </div>
            <div className="tab-body">
              {tab === "services" && (
                <ul className="tab-list">
                  {report?.services.hits.slice(0, 8).map((h, i) => (
                    <li key={i}>
                      <span className="signal">▸</span> {h.service}
                      <span className="dim"> resolved </span>
                      {h.package}@{h.version}
                    </li>
                  ))}
                  {!report?.services.hits.length && (
                    <li className="dim">no internal service resolved this package</li>
                  )}
                </ul>
              )}
              {tab === "maintainers" && (
                <ul className="tab-list">
                  {report?.shared_maintainers.maintainers.slice(0, 6).map((m, i) => (
                    <li key={i}>
                      <span className="trace">◈</span> {m.maintainer}
                      <span className="dim"> also controls </span>
                      {m.also_maintains.slice(0, 5).join(", ")}
                    </li>
                  ))}
                  {!report?.shared_maintainers.maintainers.length && (
                    <li className="dim">no shared-maintainer pivot found</li>
                  )}
                </ul>
              )}
              {tab === "typosquats" && (
                <ul className="tab-list">
                  {report?.typosquats.graph_linked.map((n, i) => (
                    <li key={"g" + i}>
                      <span className="danger">⚠</span> {n}
                      <span className="dim"> — TYPOSQUAT_OF {pkg}</span>
                    </li>
                  ))}
                  {report?.typosquats.candidates.slice(0, 6).map((c, i) => (
                    <li key={"c" + i}>
                      <span className="danger">⚠</span> {c.name}
                      <span className="dim"> — edit distance {c.distance}</span>
                    </li>
                  ))}
                  {!report?.typosquats.graph_linked.length &&
                    !report?.typosquats.candidates.length && (
                      <li className="dim">no lookalikes within edit distance 1</li>
                    )}
                </ul>
              )}
            </div>
          </div>
        </div>

        {compare && (
          <div className="verdict mono">
            <span>
              npm audit: <b className="dim">{compare.naive_direct_only.exposed_count} direct</b>
            </span>
            <span className="verdict-arrow">→</span>
            <span>
              blast radius:{" "}
              <b className="signal">
                {compare.graph_full_closure.exposed_count} transitive
              </b>{" "}
              in {Math.round(compare.graph_full_closure.elapsed_ms)}ms
            </span>
            {compare.multiplier && (
              <span className="verdict-mult">{compare.multiplier}× wider than it looks</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
