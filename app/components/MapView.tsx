'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Building, Node } from './types';
import { dijkstra, pathLen, posAlong, buildSteps } from './route';
import clsx from 'clsx';

type Props = { slug?: string };

export default function MapView({ slug }: Props) {
  const effectiveSlug = slug ?? 'demo';

  const [building, setBuilding] = useState<Building | null>(null);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [accessible, setAccessible] = useState(false);
  const [follow, setFollow] = useState(true);
  const [route, setRoute] = useState<string[]>([]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeSeg, setActiveSeg] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ----- load building json (basePath-aware + content-type guard) -----
  useEffect(() => {
    (async () => {
      try {
        setLoadError(null);
        const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const url = `${base}/projects/${encodeURIComponent(effectiveSlug)}.json`;

        const res = await fetch(url, { cache: 'no-store' });
        const ctype = res.headers.get('content-type') || '';

        if (!res.ok || !ctype.includes('application/json')) {
          const body = await res.text().catch(() => '');
          throw new Error(
            `Failed to load ${url} — status ${res.status} ${res.statusText}; ` +
            `content-type=${ctype}; body="${body.slice(0, 120)}"`
          );
        }

        const b: Building = await res.json();
        setBuilding(b);
        setCurrentFloor(b.floors[0] ?? 0);
        const rooms = b.nodes.filter(n => n.type === 'room');
        setFrom(rooms[0]?.id ?? '');
        setTo(rooms[1]?.id ?? '');
        console.log('Loaded project', effectiveSlug, { floors: b.floors, rooms: rooms.length });
      } catch (err: any) {
        console.error(err);
        setLoadError(err?.message || 'Could not load project JSON.');
        setBuilding(null);
        setFrom('');
        setTo('');
      }
    })();
  }, [effectiveSlug]);

  // ----- memo helpers -----
  const nodesById = useMemo(
    () => new Map((building?.nodes ?? []).map(n => [n.id, n])),
    [building]
  );
  const rooms = useMemo(
    () => (building?.nodes ?? []).filter(n => n.type === 'room'),
    [building]
  );
  const floors = building?.floors ?? [];

  // ----- recompute route on selection change -----
  useEffect(() => {
    if (!building || !from || !to) return;
    const p = dijkstra(building, from, to, accessible);
    setRoute(p);
    setPlaying(false);
    setT(0);
    setActiveSeg(0);
  }, [building, from, to, accessible]);

  // ----- animation / runner -----
  useEffect(() => {
    if (!playing || route.length < 2) return;
    let raf = 0;
    const tick = () => {
      setT(prev => {
        const L = pathLen(route, nodesById);
        const next = Math.min(L, prev + 95 * (1 / 60));
        const p = posAlong(route, nodesById, next);
        if (p) {
          if (follow && p.floor !== currentFloor) setCurrentFloor(p.floor);
          setActiveSeg(p.segIndex);
        }
        if (next >= L) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, route, nodesById, follow, currentFloor]);

  // ----- svg camera (pan/zoom) -----
  const cam = useRef({ x: 0, y: 0, z: 1 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const svg = svgRef.current!;
    const apply = () =>
      svg.setAttribute(
        'viewBox',
        `${cam.current.x} ${cam.current.y} ${420 * cam.current.z} ${260 * cam.current.z}`
      );
    apply();
    let pan = false,
      last = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      pan = true;
      last = { x: e.clientX, y: e.clientY };
      svg.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!pan) return;
      const dx = (last.x - e.clientX) * 0.5 * cam.current.z,
        dy = (last.y - e.clientY) * 0.5 * cam.current.z;
      cam.current.x += dx;
      cam.current.y += dy;
      last = { x: e.clientX, y: e.clientY };
      apply();
    };
    const onUp = () => {
      pan = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = Math.exp((e.deltaY > 0 ? -1 : 1) * 0.12);
      cam.current.z = Math.max(0.6, Math.min(3, cam.current.z * s));
      apply();
    };
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('wheel', onWheel as any);
    };
  }, []);

  const pos = (route.length && posAlong(route, nodesById, t)) || null;

  return (
    <div className="h-dvh w-full">
      {/* Error banner */}
      {loadError && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 text-sm">
          {loadError}
        </div>
      )}

      {/* Map + controls overlay */}
      <div className="relative h-[calc(100dvh-0px)] w-full bg-white">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full touch-none select-none"
        />
        <Controls
          floors={floors}
          currentFloor={currentFloor}
          onFloor={setCurrentFloor}
          rooms={rooms}
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
          accessible={accessible}
          setAccessible={setAccessible}
          follow={follow}
          setFollow={setFollow}
          playing={playing}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onReset={() => {
            setPlaying(false);
            setT(0);
            setActiveSeg(0);
          }}
          steps={buildSteps(route, nodesById)}
          activeSeg={activeSeg}
        />
      </div>

      {/* Draw layers when data is ready */}
      {building && (
        <SVGContent
          svgRef={svgRef}
          building={building}
          currentFloor={currentFloor}
          route={route}
          nodesById={nodesById}
          pos={pos}
          setFrom={setFrom}
          setTo={setTo}
        />
      )}
    </div>
  );
}

function SVGContent({
  svgRef,
  building,
  currentFloor,
  route,
  nodesById,
  pos,
  setFrom,
  setTo,
}: {
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
  building: Building;
  currentFloor: number;
  route: string[];
  nodesById: Map<string, Node>;
  pos: { x: number; y: number; floor: number; segIndex: number } | null;
  setFrom: (id: string) => void;
  setTo: (id: string) => void;
}) {
  const [selectMode, setSelectMode] = useState<'from' | 'to'>('to');

  useEffect(() => {
    const svg = svgRef.current!;
    // clear
    svg.replaceChildren();
    // layers
    const NS = 'http://www.w3.org/2000/svg';
    const bg = svg.appendChild(document.createElementNS(NS, 'g'));
    const cur = svg.appendChild(document.createElementNS(NS, 'g'));
    const routeL = svg.appendChild(document.createElementNS(NS, 'g'));
    const runL = svg.appendChild(document.createElementNS(NS, 'g'));

    // background floors (dim)
    for (const f of building.floors.filter((f) => f !== currentFloor)) {
      const g = document.createElementNS(NS, 'g');
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', '80');
      r.setAttribute('y', '60');
      r.setAttribute('width', '864');
      r.setAttribute('height', '420');
      r.setAttribute('fill', '#f7faff');
      r.setAttribute('stroke', '#c9d6ff');
      r.setAttribute('stroke-width', '1');
      r.setAttribute('opacity', '0.12');
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', '86');
      t.setAttribute('y', '52');
      t.setAttribute('font-size', '10');
      t.setAttribute('fill', '#666');
      t.setAttribute('opacity', '0.12');
      t.textContent = `Floor ${f}`;
      g.append(r, t);
      bg.append(g);
    }

    // current floor
    {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', '80');
      r.setAttribute('y', '60');
      r.setAttribute('width', '864');
      r.setAttribute('height', '420');
      r.setAttribute('fill', '#f7faff');
      r.setAttribute('stroke', '#c9d6ff');
      r.setAttribute('stroke-width', '1');
      cur.append(r);

      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', '90');
      title.setAttribute('y', '52');
      title.setAttribute('font-size', '12');
      title.setAttribute('fill', '#333');
      title.textContent = `Floor ${currentFloor}`;
      cur.append(title);
    }

    // edges on current floor
    for (const [u, v] of building.edges) {
      const a = nodesById.get(u)!;
      const b = nodesById.get(v)!;
      if (a.floor === currentFloor && b.floor === currentFloor) {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', String(a.x));
        l.setAttribute('y1', String(a.y));
        l.setAttribute('x2', String(b.x));
        l.setAttribute('y2', String(b.y));
        l.setAttribute('stroke', '#9ab');
        l.setAttribute('stroke-width', '1.5');
        cur.append(l);
      }
    }

    // rooms on current floor
    for (const n of building.nodes.filter(
      (n) => n.floor === currentFloor && n.type === 'room'
    )) {
      const rr = document.createElementNS(NS, 'rect');
      rr.setAttribute('x', String(n.x - 40));
      rr.setAttribute('y', String(n.y - 20));
      rr.setAttribute('width', '80');
      rr.setAttribute('height', '40');
      rr.setAttribute('fill', '#fff');
      rr.setAttribute('stroke', '#ccd7ea');
      rr.setAttribute('stroke-width', '1');
      rr.addEventListener('click', () =>
        selectMode === 'from' ? setFrom(n.id) : setTo(n.id)
      );

      const tt = document.createElementNS(NS, 'text');
      tt.setAttribute('x', String(n.x - 34));
      tt.setAttribute('y', String(n.y + 4));
      tt.setAttribute('font-size', '10');
      tt.setAttribute('fill', '#333');
      tt.textContent = n.label ?? n.id;
      cur.append(rr, tt);
    }

    // core (stair / lift)
    const stair = document.createElementNS(NS, 'rect');
    stair.setAttribute('x', '410');
    stair.setAttribute('y', '190');
    stair.setAttribute('width', '40');
    stair.setAttribute('height', '60');
    stair.setAttribute('fill', '#ffe8e8');
    stair.setAttribute('stroke', '#ffb3b3');
    cur.append(stair);

    const stairT = document.createElementNS(NS, 'text');
    stairT.setAttribute('x', '418');
    stairT.setAttribute('y', '186');
    stairT.setAttribute('font-size', '10');
    stairT.setAttribute('fill', '#c44');
    stairT.textContent = 'Stair A';
    cur.append(stairT);

    const lift = document.createElementNS(NS, 'rect');
    lift.setAttribute('x', '460');
    lift.setAttribute('y', '190');
    lift.setAttribute('width', '40');
    lift.setAttribute('height', '60');
    lift.setAttribute('fill', '#e8fff1');
    lift.setAttribute('stroke', '#b3ffcc');
    cur.append(lift);

    const liftT = document.createElementNS(NS, 'text');
    liftT.setAttribute('x', '468');
    liftT.setAttribute('y', '186');
    liftT.setAttribute('font-size', '10');
    liftT.setAttribute('fill', '#2a6');
    liftT.textContent = 'Lift A';
    cur.append(liftT);

    // route on current floor
    if (route.length >= 2) {
      const pts = route
        .map((id) => nodesById.get(id)!)
        .filter((n) => n && n.floor === currentFloor);
      if (pts.length >= 2) {
        const d =
          'M' + pts.map((p, i) => `${i === 0 ? '' : 'L'}${p.x},${p.y}`).join(' ');
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#1a73e8');
        path.setAttribute('stroke-width', '2.8');
        path.setAttribute('fill', 'none');
        routeL.append(path);
      }
    }

    // runner
    if (pos && pos.floor === currentFloor) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', String(pos.x));
      c.setAttribute('cy', String(pos.y));
      c.setAttribute('r', '5');
      c.setAttribute('fill', '#1a73e8');
      runL.append(c);

      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', String(pos.x + 8));
      t.setAttribute('y', String(pos.y - 8));
      t.setAttribute('font-size', '10');
      t.textContent = '🏃';
      runL.append(t);
    }
  }, [building, currentFloor, route, pos, setFrom, setTo, svgRef, selectMode]);

  return null;
}

function Controls(props: {
  floors: number[];
  currentFloor: number;
  onFloor: (f: number) => void;
  rooms: Node[];
  from: string;
  to: string;
  setFrom: (id: string) => void;
  setTo: (id: string) => void;
  accessible: boolean;
  setAccessible: (v: boolean) => void;
  follow: boolean;
  setFollow: (v: boolean) => void;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  steps: { seg: number; text: string }[];
  activeSeg: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute left-3 top-3 z-20 rounded-lg border bg-white/90 px-3 py-2 shadow"
        title="Toggle controls"
      >
        ☰
      </button>

      <aside
        className={clsx(
          'absolute right-3 top-3 bottom-3 z-20 w-[min(92vw,360px)] rounded-xl border bg-white/95 p-3 shadow-xl backdrop-blur',
          open ? 'translate-x-0' : 'translate-x-[calc(100%+16px)]',
          'transition-transform'
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <strong>Indoor Nav</strong>
          <button onClick={() => setOpen(false)} className="rounded-md border px-2 py-1">
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="w-12 text-xs text-slate-600">From</label>
            <select
              className="flex-1 rounded-md border px-2 py-2"
              value={props.from}
              onChange={(e) => props.setFrom(e.target.value)}
            >
              <option value="">Select…</option>
              {props.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label ?? r.id} (F{r.floor})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="w-12 text-xs text-slate-600">To</label>
            <select
              className="flex-1 rounded-md border px-2 py-2"
              value={props.to}
              onChange={(e) => props.setTo(e.target.value)}
            >
              <option value="">Select…</option>
              {props.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label ?? r.id} (F{r.floor})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="w-12 text-xs text-slate-600">Floor</label>
            <div className="flex flex-wrap gap-2">
              {props.floors.map((f) => (
                <button
                  key={f}
                  onClick={() => props.onFloor(f)}
                  className={clsx(
                    'rounded-full border px-3 py-1',
                    props.currentFloor === f && 'border-blue-600 bg-blue-600 text-white'
                  )}
                >
                  F{f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => props.setAccessible(!props.accessible)}
              className={clsx(
                'rounded-md border px-3 py-2',
                props.accessible && 'border-blue-600 bg-blue-600 text-white'
              )}
            >
              Accessible: {props.accessible ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => props.setFollow(!props.follow)}
              className={clsx(
                'rounded-md border px-3 py-2',
                props.follow && 'border-blue-600 bg-blue-600 text-white'
              )}
            >
              Follow: {props.follow ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={props.onPlay} className="rounded-md border px-3 py-2">
              ▶
            </button>
            <button onClick={props.onPause} className="rounded-md border px-3 py-2">
              ⏸
            </button>
            <button onClick={props.onReset} className="rounded-md border px-3 py-2">
              ⟲
            </button>
          </div>

          <div className="mt-2">
            <div className="mb-1 font-medium">Steps</div>
            <ol className="max-h-[28vh] space-y-1 overflow-auto pl-5">
              {props.steps.map((s) => (
                <li
                  key={s.seg}
                  className={clsx(
                    'rounded-md border px-2 py-1',
                    s.seg === props.activeSeg && 'border-blue-400 bg-blue-50'
                  )}
                >
                  {s.text}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>
    </>
  );
}
