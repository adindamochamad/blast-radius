import { useEffect, useState } from "react";
import { STATS } from "../lib/api";

/** Defender / Attacker toggle — flips the accent from hazard-signal (defense)
 *  to danger-red (offense). A quiet homage to Basement's Human/Machine switch. */
export default function Footer() {
  const [attacker, setAttacker] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--signal", attacker ? "#e5484d" : "#ff4d1c");
  }, [attacker]);

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-cta">
          <h2 className="display">
            Know your blast radius
            <br />
            before the worm does.
          </h2>
          <a
            className="btn-primary"
            href="https://github.com/hydra-db/hydradb"
            target="_blank"
            rel="noreferrer"
            data-cursor="lock"
          >
            Build on HydraDB ↗
          </a>
        </div>

        <hr className="hairline" />

        <div className="footer-grid mono">
          <div>
            <div className="brand display">BLAST RADIUS</div>
            <div className="dim">
              Hack Hydra · Track 02A · supply-chain reverse-dependency closure
            </div>
            <div className="dim">
              {STATS.packages.toLocaleString()} real npm packages · synthetic
              "Northwind" services (disclosed)
            </div>
          </div>
          <div className="footer-toggle">
            <span className={!attacker ? "signal" : "dim"}>DEFENDER</span>
            <button
              className={`switch ${attacker ? "switch-on" : ""}`}
              onClick={() => setAttacker((a) => !a)}
              aria-label="toggle perspective"
              data-cursor="lock"
            >
              <span />
            </button>
            <span className={attacker ? "danger" : "dim"}>ATTACKER</span>
          </div>
        </div>

        <div className="footer-legal mono dim">
          © 2026 · open source · AGPL-3.0 · not affiliated with npm, Inc.
        </div>
      </div>
    </footer>
  );
}
