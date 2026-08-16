import { useEffect, useRef } from "react";
import type { GraphResp } from "../lib/api";

type P = { id: number; name: string; hop: number; x: number; y: number; kind: string };

const COL = {
  void: "#0b0a09",
  bone: "#ede6d8",
  ash: "#6b6459",
  signal: "#ff4d1c",
  trace: "#4be0c4",
};

/** Radial "detonation": source at center, exposed packages bloom outward in
 *  hop rings with expanding shockwaves. runKey retriggers the animation. */
export default function BlastCanvas({
  graph,
  runKey,
}: {
  graph: GraphResp | null;
  runKey: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !graph) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0, H = 0, cx = 0, cy = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2;
      layout();
    };

    const maxHop = Math.max(1, ...graph.nodes.map((n) => n.hop));
    const pts: Record<number, P> = {};
    const byHop: Record<number, typeof graph.nodes> = {};
    graph.nodes.forEach((n) => {
      (byHop[n.hop] ??= []).push(n);
    });

    function layout() {
      const ringStep = Math.min(W, H) / 2 / (maxHop + 1);
      Object.entries(byHop).forEach(([hopS, arr]) => {
        const hop = Number(hopS);
        arr.forEach((n, i) => {
          if (hop === 0) {
            pts[n.id] = { ...n, x: cx, y: cy };
            return;
          }
          const golden = 2.399963;
          const a = i * golden + hop * 1.7;
          const jitter = ((i % 5) - 2) * ringStep * 0.08;
          const rad = ringStep * hop + jitter;
          pts[n.id] = {
            ...n,
            x: cx + Math.cos(a) * rad,
            y: cy + Math.sin(a) * rad * 0.82,
          };
        });
      });
    }

    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    const REVEAL = 1500; // ms to sweep all hops
    const draw = (t: number) => {
      const elapsed = t - start;
      const prog = Math.min(1, elapsed / REVEAL);
      const revealedHop = prog * (maxHop + 0.5);

      ctx.clearRect(0, 0, W, H);

      // edges
      ctx.lineWidth = 1;
      for (const l of graph.links) {
        const a = pts[l.source], b = pts[l.target];
        if (!a || !b) continue;
        const hh = Math.max(a.hop, b.hop);
        if (hh > revealedHop) continue;
        const fade = Math.max(0, Math.min(1, revealedHop - hh + 1));
        ctx.strokeStyle = `rgba(75,224,196,${0.10 * fade})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // shockwave rings per hop boundary
      const ringStep = Math.min(W, H) / 2 / (maxHop + 1);
      for (let hop = 1; hop <= maxHop; hop++) {
        const local = revealedHop - hop;
        if (local < 0 || local > 1.2) continue;
        const alpha = Math.max(0, 0.5 * (1 - local / 1.2));
        ctx.strokeStyle = `rgba(255,77,28,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ringStep * hop * (0.6 + local * 0.5), ringStep * hop * 0.82 * (0.6 + local * 0.5), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // nodes
      for (const n of Object.values(pts)) {
        if (n.hop > revealedHop) continue;
        const appear = Math.max(0, Math.min(1, revealedHop - n.hop + 0.4));
        if (n.hop === 0) {
          // source — pulsing signal
          const pulse = 4 + Math.sin(t / 200) * 2;
          ctx.fillStyle = COL.signal;
          ctx.shadowColor = COL.signal;
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 6 + pulse * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          const r = 2.4 * appear;
          const mix = n.hop === 1 ? COL.signal : COL.bone;
          ctx.fillStyle = mix;
          ctx.globalAlpha = appear;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // source label
      if (pts[graph.nodes[0]?.id]) {
        const s = pts[graph.nodes[0].id];
        ctx.fillStyle = COL.signal;
        ctx.font = "600 13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(graph.package, s.x, s.y - 16);
      }

      if (prog < 1 || true) raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, [graph, runKey]);

  return <canvas ref={ref} className="blast-canvas" />;
}
