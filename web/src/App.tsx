import { useState } from "react";
import { useLenis } from "./hooks/useLenis";
import Cursor from "./components/Cursor";
import Loader from "./components/Loader";
import Hero from "./components/Hero";
import Problem from "./components/Problem";
import LiveDemo from "./components/LiveDemo";
import HowGraph from "./components/HowGraph";
import UnderHood from "./components/UnderHood";
import Footer from "./components/Footer";

export default function App() {
  const skip =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).has("skipboot") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const only =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("only")
      : null;
  const [booted, setBooted] = useState(skip);
  useLenis();

  if (only) {
    return (
      <>
        <Cursor />
        <main className="booted">
          {only === "demo" && <LiveDemo />}
          {only === "problem" && <Problem />}
          {only === "how" && <HowGraph />}
          {only === "hood" && <UnderHood />}
          {only === "footer" && <Footer />}
        </main>
      </>
    );
  }

  return (
    <>
      <Cursor />
      {!booted && <Loader onDone={() => setBooted(true)} />}
      <main className={booted ? "booted" : "pre-boot"}>
        <Hero />
        <Problem />
        <LiveDemo />
        <HowGraph />
        <UnderHood />
        <Footer />
      </main>
    </>
  );
}
