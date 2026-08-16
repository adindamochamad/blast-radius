import { Component, type ReactNode } from "react";

/** Prevents a WebGL/Canvas failure from taking down the whole page.
 *  On error, renders a static fallback instead. */
export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — fallback covers it */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
