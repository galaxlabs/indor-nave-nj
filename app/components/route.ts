import type { Building, Node, Step } from './types';

export function dijkstra(building: Building, from: string, to: string, accessible: boolean) {
  const nodes = new Map(building.nodes.map(n => [n.id, n]));
  const adj = new Map<string, string[]>();
  for (const [u, v] of building.edges) {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u)!.push(v);
    adj.get(v)!.push(u);
  }
  const w = (a: string, b: string) => {
    const A = nodes.get(a)!; const B = nodes.get(b)!;
    let d = Math.hypot(B.x - A.x, B.y - A.y) + (A.floor === B.floor ? 0 : 200);
    if (accessible && (A.type === 'stair' || B.type === 'stair')) d += 1e6;
    return d;
  };

  const dist = new Map<string, number>(); const prev = new Map<string, string>();
  for (const n of building.nodes) dist.set(n.id, Infinity);
  dist.set(from, 0);

  const Q = new Set(building.nodes.map(n => n.id));
  while (Q.size) {
    let u: string | null = null, best = Infinity;
    for (const id of Q) { const d = dist.get(id)!; if (d < best) { best = d; u = id; } }
    if (u == null) break;
    Q.delete(u);
    if (u === to) break;
    for (const v of adj.get(u) ?? []) {
      const alt = dist.get(u)! + w(u, v);
      if (alt < dist.get(v)!) { dist.set(v, alt); prev.set(v, u); }
    }
  }
  const path: string[] = [];
  let cur: string | undefined = to;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    path.unshift(cur);
    if (cur === from) break;
    cur = prev.get(cur);
  }
  return path;
}

export function pathLen(ids: string[], nodesById: Map<string, Node>) {
  let L = 0;
  for (let i = 1; i < ids.length; i++) {
    const a = nodesById.get(ids[i - 1])!, b = nodesById.get(ids[i])!;
    L += Math.hypot(b.x - a.x, b.y - a.y) + (a.floor === b.floor ? 0 : 200);
  }
  return L;
}

export function posAlong(ids: string[], nodesById: Map<string, Node>, t: number) {
  let rem = t;
  for (let i = 1; i < ids.length; i++) {
    const a = nodesById.get(ids[i - 1])!, b = nodesById.get(ids[i])!;
    const d = Math.hypot(b.x - a.x, b.y - a.y) + (a.floor === b.floor ? 0 : 200);
    if (rem <= d) {
      const u = Math.max(0, Math.min(1, rem / d));
      const same = a.floor === b.floor;
      return {
        x: same ? a.x + (b.x - a.x) * u : b.x,
        y: same ? a.y + (b.y - a.y) * u : b.y,
        floor: same ? a.floor : b.floor,
        segIndex: i
      };
    }
    rem -= d;
  }
  const last = nodesById.get(ids[ids.length - 1] || '');
  return last ? { x: last.x, y: last.y, floor: last.floor, segIndex: ids.length - 1 } : undefined;
}

export function buildSteps(ids: string[], nodesById: Map<string, Node>): Step[] {
  const s: Step[] = [];
  for (let i = 1; i < ids.length; i++) {
    const A = nodesById.get(ids[i - 1])!, B = nodesById.get(ids[i])!;
    const vertical = (A.type === 'stair' || A.type === 'lift' || B.type === 'stair' || B.type === 'lift') && (A.floor !== B.floor);
    const dist = Math.hypot(B.x - A.x, B.y - A.y);
    const stepsCount = Math.max(1, Math.round(dist / 3.5));
    if (vertical) {
      const via = (A.type === 'lift' || B.type === 'lift') ? 'lift' : 'stairs';
      const dir = (B.floor > A.floor) ? 'up' : 'down';
      s.push({ seg: i, text: `Take the ${via} ${dir} to Floor ${B.floor}` });
    } else {
      s.push({ seg: i, text: `Go ${stepsCount} steps straight` });
    }
  }
  return s;
}
