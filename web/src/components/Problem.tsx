export default function Problem() {
  return (
    <section className="problem" id="problem">
      <div className="wrap">
        <span className="mono-tag">02 / THE PROBLEM</span>
        <div className="problem-grid">
          <h2 className="display problem-lead">
            The worm publishes 84 artifacts in <span className="signal">6&nbsp;minutes.</span>
            <br />
            You find out in <span className="signal">6&nbsp;hours.</span>
          </h2>
          <div className="problem-body">
            <p>
              Modern supply-chain attacks are automated. When a CI token leaks,
              a worm can push dozens of malicious versions across dozens of
              packages before a human notices — self-propagating through anything
              that shares a maintainer, persisting in <code>.claude/</code> and{" "}
              <code>.vscode/</code> directories that survive an uninstall.
            </p>
            <p className="dim">
              The defender's problem is not detection. It's <b>speed of
              blast-radius resolution</b>: when a package is compromised at 09:00,
              which of your services are exposed by 09:06? That is a transitive
              reverse-dependency closure over a graph with tens of millions of
              versioned nodes.
            </p>
          </div>
        </div>

        <div className="problem-timeline mono">
          <div className="tl"><span className="tl-t signal">09:00</span> malicious version published</div>
          <div className="tl"><span className="tl-t">09:06</span> your build resolves it, unknowing</div>
          <div className="tl"><span className="tl-t">14:00</span> advisory finally lands · npm audit reacts</div>
          <div className="tl"><span className="tl-t trace">+40ms</span> blast radius already knew</div>
        </div>
      </div>
    </section>
  );
}
