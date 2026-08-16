import HeroGraph from "./HeroGraph";
import ErrorBoundary from "./ErrorBoundary";
import { useScramble } from "../hooks/useScramble";
import { isLive, STATS } from "../lib/api";

export default function Hero() {
  const line1 = useScramble("Which of your services", 200, 1.4);
  return (
    <section className="hero" id="top">
      <div className="hero-graph-layer">
        <ErrorBoundary fallback={<div className="hero-graph-fallback" />}>
          <HeroGraph />
        </ErrorBoundary>
      </div>
      <div className="hero-scrim" />

      <header className="nav wrap">
        <div className="nav-left">
          <span className="brand display">BLAST&nbsp;RADIUS</span>
          <span className="mono-tag">TRACK 02A · SUPPLY CHAIN</span>
        </div>
        <nav className="nav-right mono">
          <a href="#problem">problem</a>
          <a href="#demo">demo</a>
          <a href="#graph">graph</a>
          <a href="#hydra">hydradb</a>
          <a
            className="nav-cta"
            href="https://github.com/hydra-db/hydradb"
            target="_blank"
            rel="noreferrer"
          >
            repo ↗
          </a>
        </nav>
      </header>

      <div className="hero-body wrap">
        <div className="hero-status mono">
          <span className={`dot ${isLive() ? "live" : "snap"}`} />
          {isLive() ? "LIVE · HYDRADB CONNECTED" : "STATIC SNAPSHOT · HYDRADB OFFLINE"}
          <span className="dim"> · {STATS.packages.toLocaleString()} packages indexed</span>
        </div>

        <h1 className="hero-title display">
          <span className="scramble">{line1}</span>
          <span className="hero-title-2">
            are exposed <span className="signal">right now?</span>
          </span>
        </h1>

        <p className="hero-lede">
          A package you trust ships malware at <b>09:00</b>. Your scanner flags it
          at <b>14:00</b>. In that five-hour window, the only question that matters
          is a graph traversal — and a vector index cannot answer it at all.
        </p>

        <div className="hero-actions">
          <a href="#demo" className="btn-primary" data-cursor="lock">
            Detonate a package →
          </a>
          <a href="#problem" className="btn-ghost mono">
            the 5-hour problem
          </a>
        </div>
      </div>

      <div className="hero-foot wrap mono">
        <span>REVERSE-DEPENDENCY CLOSURE</span>
        <span className="hero-foot-scroll">SCROLL ↓</span>
        <span>algo.SSpaths · GraphBLAS</span>
      </div>
    </section>
  );
}
