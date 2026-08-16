export default function HowGraph() {
  return (
    <section className="how" id="graph">
      <div className="wrap">
        <span className="mono-tag">04 / WHY A GRAPH</span>
        <h2 className="display how-title">
          A vector index measures <span className="dim">similarity.</span>
          <br />
          An attack travels <span className="trace">edges.</span>
        </h2>

        <div className="how-cols">
          <div className="how-col">
            <div className="mono how-k">01 · reverse closure</div>
            <p>
              "Who depends on <code>debug</code>?" is not one query — it's the
              transitive set of everything that depends on anything that depends
              on it. We walk incoming <code>DEPENDS_ON</code> edges hop by hop
              until the frontier is empty.
            </p>
          </div>
          <div className="how-col">
            <div className="mono how-k">02 · temporal resolution</div>
            <p>
              Each lockfile resolution is an <code>INSTALLED&#123;at&#125;</code>
              event on a <code>Version</code> node. A numeric time-window filter
              answers <i>which</i> services pulled the bad version <i>while it was
              live</i> — not just which could have.
            </p>
          </div>
          <div className="how-col">
            <div className="mono how-k">03 · maintainer pivot</div>
            <p>
              One leaked credential rarely touches one package. A two-edge
              <code> MAINTAINS</code> pattern surfaces every other package the
              same human can publish — the attacker's next move, pre-computed.
            </p>
          </div>
        </div>

        <div className="how-note mono dim">
          none of these are similarity problems. cosine distance cannot express
          "reachable via a chain of typed edges." a graph can.
        </div>
      </div>
    </section>
  );
}
