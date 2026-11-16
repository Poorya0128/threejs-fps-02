// Waypoint graph (PLAN.md §9.1): nodes linked where a body-sized sweep is clear; allocation-free A*.
export function nearestNode(nodes, x, z) {
	let best = 0, bd = 1e9;
	for (let i = 0; i < nodes.length; i++) { const d = (nodes[i][1] - x) ** 2 + (nodes[i][2] - z) ** 2; if (d < bd) { bd = d; best = i; } }
	return best;
}
export const callName = (name) => name.replace(/([a-z])([A-Z0-9])/g, '$1 $2'); // 'PansWest' → 'Pans West'

// Can a 0.8 × 1.7 m body walk straight there at height y? Low boxes are stepped over.
function sweepClear(boxes, x0, z0, x1, z1, y) {
	const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .8));
	for (let s = 0; s <= n; s++) {
		const x = x0 + (x1 - x0) * s / n, z = z0 + (z1 - z0) * s / n;
		for (const b of boxes) if (y + 1.7 > b.min.y && b.max.y - y > .45 && x + .4 >= b.min.x && x - .4 <= b.max.x && z + .4 >= b.min.z && z - .4 <= b.max.z) return false;
	}
	return true;
}

export function buildNav(map, boxes) {
	const N = map.nodes, n = N.length, links = N.map(() => []), dist = (i, j) => Math.hypot(N[j][1] - N[i][1], N[j][2] - N[i][2]);
	for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
		const [, x0, z0, y0] = N[i], [, x1, z1, y1] = N[j], y = Math.min(y0, y1);
		if (dist(i, j) <= 20 && Math.abs(y0 - y1) <= .5 && sweepClear(boxes, x0, z0, x1, z1, y) && sweepClear(boxes, x0, z0, x1, z1, y + .9)) { links[i].push(j); links[j].push(i); }
	}
	const ids = new Map(N.map((nd, i) => [nd[0], i])), g = new Float32Array(n), f = new Float32Array(n), from = new Int32Array(n), closed = new Uint8Array(n), open = new Int32Array(n * 2), out = [];
	return {
		byName: (name) => ids.get(name) ?? -1,
		findPath(start, goal) {
			g.fill(Infinity); closed.fill(0);
			let len = 0;
			g[start] = 0; f[start] = dist(start, goal); open[len++] = start;
			while (len > 0) {
				let bi = 0;
				for (let i = 1; i < len; i++) if (f[open[i]] < f[open[bi]]) bi = i;
				const cur = open[bi];
				open[bi] = open[--len];
				if (closed[cur]) continue;
				closed[cur] = 1;
				if (cur === goal) break;
				for (const nb of links[cur]) {
					const cost = g[cur] + dist(cur, nb) + Math.abs(N[nb][3] - N[cur][3]) * 2;
					if (!closed[nb] && cost < g[nb]) { g[nb] = cost; f[nb] = cost + dist(nb, goal); from[nb] = cur; open[len++] = nb; }
				}
			}
			out.length = 0;
			if (closed[goal]) for (let c = goal; ; c = from[c]) { out.unshift(c); if (c === start) break; }
			return out;
		},
	};
}
