import { useEffect, useRef, useState } from "react";

/** A crosshair reticle cursor — becomes a target lock over interactive elements. */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      setHidden(true);
      return;
    }
    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { ...pos };
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (dot.current)
        dot.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      const el = e.target as HTMLElement;
      setActive(
        !!el.closest("button, a, input, [data-cursor='lock']")
      );
    };
    const loop = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      if (ring.current)
        ring.current.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (hidden) return null;
  return (
    <>
      <div ref={dot} className="cursor-dot" />
      <div ref={ring} className={`cursor-ring ${active ? "is-lock" : ""}`}>
        <span className="reticle reticle-t" />
        <span className="reticle reticle-r" />
        <span className="reticle reticle-b" />
        <span className="reticle reticle-l" />
      </div>
    </>
  );
}
