import { useEffect, useRef, useState } from "react";

const CHARS = "!<>-_\\/[]{}—=+*^?#01__";

/** Decodes text with a glitch scramble on mount. */
export function useScramble(text: string, delay = 0, speed = 1) {
  const [out, setOut] = useState(text);
  const raf = useRef(0);
  useEffect(() => {
    let frame = 0;
    const queue = text.split("").map((ch, i) => ({
      ch,
      start: Math.floor(delay / 16 + i * 1.4),
      end: Math.floor(delay / 16 + i * 1.4 + 12 / speed),
    }));
    const run = () => {
      let output = "";
      let done = 0;
      for (const q of queue) {
        if (frame >= q.end) {
          output += q.ch;
          done++;
        } else if (frame >= q.start) {
          output += CHARS[Math.floor(Math.random() * CHARS.length)];
        } else {
          output += q.ch === " " ? " " : "";
        }
      }
      setOut(output);
      frame++;
      if (done < queue.length) raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [text, delay, speed]);
  return out;
}
