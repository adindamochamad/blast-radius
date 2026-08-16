import { useEffect, useState } from "react";
import { STATS } from "../lib/api";

/** "ARMING" boot sequence — counts up versions indexed, then lifts. */
export default function Loader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [gone, setGone] = useState(false);
  const target = 14326; // versions indexed in the demo graph

  useEffect(() => {
    const dur = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setTimeout(() => setGone(true), 320);
        setTimeout(onDone, 900);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className={`loader ${gone ? "loader-gone" : ""}`}>
      <div className="loader-inner">
        <div className="mono-tag">HYDRADB · GRAPH ARMED</div>
        <div className="loader-num display">{count.toLocaleString()}</div>
        <div className="mono">
          versions indexed · {STATS.packages.toLocaleString()} packages · reverse
          edges compiled
        </div>
        <div className="loader-bar">
          <span style={{ width: `${(count / target) * 100}%` }} />
        </div>
        <div className="mono signal">ARMING</div>
      </div>
    </div>
  );
}
