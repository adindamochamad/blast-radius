import snapshots from "../data/snapshots.json";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8000";

export type GraphNode = { id: number; name: string; hop: number; kind: string };
export type GraphLink = { source: number; target: number };
export type GraphResp = {
  package: string;
  stats: {
    exposed_count: number;
    max_hop: number;
    elapsed_ms: number;
    rendered_nodes: number;
  };
  nodes: GraphNode[];
  links: GraphLink[];
};
export type CompareResp = {
  package: string;
  naive_direct_only: { exposed_count: number; elapsed_ms: number; note: string };
  graph_full_closure: {
    exposed_count: number;
    max_hop: number;
    elapsed_ms: number;
    note: string;
  };
  multiplier: number | null;
};
export type Report = {
  blast_radius: {
    package: string;
    exposed_count: number;
    max_hop: number;
    elapsed_ms: number;
    affected: { id: number; name: string; hop: number }[];
  };
  services: {
    hit_count: number;
    hits: { service: string; package: string; version: string; at: number }[];
  };
  shared_maintainers: {
    maintainers: { maintainer: string; also_maintains: string[] }[];
  };
  typosquats: {
    candidates: { name: string; distance: number }[];
    graph_linked: string[];
  };
};

const snap = snapshots as any;
let liveOk: boolean | null = null;

async function tryLive<T>(path: string): Promise<T | null> {
  if (liveOk === false) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1800);
    const r = await fetch(API_BASE + path, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    liveOk = true;
    return (await r.json()) as T;
  } catch {
    liveOk = false;
    return null;
  }
}

export function isLive() {
  return liveOk === true;
}

export const DEMO_PACKAGES = snap.generated_for as string[];
export const CATALOG = snap.packages as string[];
export const STATS = snap.stats as { packages: number; generated_at: string };

export function searchPackages(q: string, limit = 8): string[] {
  const ql = q.toLowerCase().trim();
  if (!ql) return DEMO_PACKAGES;
  const starts = CATALOG.filter((n) => n.toLowerCase().startsWith(ql));
  const contains = CATALOG.filter(
    (n) => n.toLowerCase().includes(ql) && !n.toLowerCase().startsWith(ql)
  );
  return [...starts, ...contains].slice(0, limit);
}

export async function getGraph(pkg: string): Promise<GraphResp> {
  const live = await tryLive<GraphResp>(
    `/api/graph/${encodeURIComponent(pkg)}?hops=4&limit=260`
  );
  if (live) return live;
  const s = snap.byPackage[pkg]?.graph;
  if (s) return s;
  throw new Error("no data");
}

export async function getReport(pkg: string): Promise<Report> {
  const live = await tryLive<Report>(
    `/api/report/${encodeURIComponent(pkg)}?hops=6`
  );
  if (live) return live;
  const s = snap.byPackage[pkg]?.report;
  if (s) return s;
  throw new Error("no data");
}

export async function getCompare(pkg: string): Promise<CompareResp> {
  const live = await tryLive<CompareResp>(
    `/api/compare/${encodeURIComponent(pkg)}`
  );
  if (live) return live;
  const s = snap.byPackage[pkg]?.compare;
  if (s) return s;
  throw new Error("no data");
}

export function hasData(pkg: string): boolean {
  return !!snap.byPackage[pkg];
}
