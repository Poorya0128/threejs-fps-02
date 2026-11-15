// SALTLINE nav.js — waypoint graph, auto-linking, A* (PLAN.md §9.1).
// Nodes come from map.js. Links are built once at boot: two nodes link when
// a capsule-sized sweep between them is clear (ray tests at knee and chest
// height). A* uses preallocated buffers — no allocations per search.
import { rayAABB } from './math.js';

const MAX_LINK_DIST = 14;

// Test whether a straight walk from (x0,z0) to (x1,z1) at ground y is clear:
// sample the segment and check a capsule (radius 0.4) against every box.
function sweepClear(boxes, x0, z0, x1, z1, y) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return true;
  const steps = Math.max(2, Math.ceil(len / 0.8));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + dx * t, z = z0 + dz * t;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (y + 1.7 <= b.min.y || y >= b.max.y) continue;
      if (x + 0.4 < b.min.x || x - 0.4 > b.max.x) continue;
      if (z + 0.4 < b.min.z || z - 0.4 > b.max.z) continue;
      // A low box is steppable; only block when its top is above knee height.
      if (b.max.y - y <= 0.45) continue;
      return false;
    }
  }
  return true;
}

export function buildNav(map, boxes) {
  const nodes = map.nodes;
  const n = nodes.length;
  const links = [];
  for (let i = 0; i < n; i++) links.push([]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b[1] - a[1], dz = b[2] - a[2];
      const dist = Math.hypot(dx, dz);
      if (dist > MAX_LINK_DIST) continue;
      if (Math.abs(a[3] - b[3]) > 0.5) continue; // different floors: stairs only
      const y = Math.min(a[3], b[3]);
      if (!sweepClear(boxes, a[1], a[2], b[1], b[2], y)) continue;
      if (!sweepClear(boxes, a[1], a[2], b[1], b[2], y + 0.9)) continue;
      links[i].push(j); links[j].push(i);
    }
  }
  return {
    nodes, links,
    byName(name) { for (let i = 0; i < n; i++) if (nodes[i][0] === name) return i; return -1; },
    // A* with reused buffers. Returns node indices into `out` (reused array).
    _g: new Float32Array(n), _f: new Float32Array(n),
    _from: new Int32Array(n), _closed: new Uint8Array(n),
    _open: new Int32Array(n * 2), _out: [],
    findPath(start, goal, out) {
      const g = this._g, f = this._f, from = this._from, closed = this._closed;
      const open = this._open;
      for (let i = 0; i < n; i++) { g[i] = Infinity; f[i] = Infinity; closed[i] = 0; }
      let openLen = 0;
      const hx = (i) => { const a = nodes[i], b = nodes[goal]; return Math.hypot(b[1] - a[1], b[2] - a[2]); };
      g[start] = 0; f[start] = hx(start);
      open[openLen++] = start;
      while (openLen > 0) {
        // Pop the lowest-f entry (linear scan: n is small).
        let bi = 0;
        for (let i = 1; i < openLen; i++) if (f[open[i]] < f[open[bi]]) bi = i;
        const cur = open[bi];
        open[bi] = open[--openLen];
        if (closed[cur]) continue;
        closed[cur] = 1;
        if (cur === goal) break;
        const ls = links[cur];
        for (let k = 0; k < ls.length; k++) {
          const nb = ls[k];
          if (closed[nb]) continue;
          const a = nodes[cur], b = nodes[nb];
          const cost = g[cur] + Math.hypot(b[1] - a[1], b[2] - a[2]) + Math.abs(b[3] - a[3]) * 2;
          if (cost < g[nb]) {
            g[nb] = cost; f[nb] = cost + hx(nb); from[nb] = cur;
            open[openLen++] = nb;
          }
        }
      }
      out.length = 0;
      if (!closed[goal]) return out;
      let c = goal;
      while (c !== start) { out.push(c); c = from[c]; }
      out.push(start);
      out.reverse();
      return out;
    },
  };
}
