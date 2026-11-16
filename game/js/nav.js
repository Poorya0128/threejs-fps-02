// SALTLINE nav.js — the bots' waypoint graph (PLAN.md §9.1): nodes from the level file are linked automatically when
// a body-sized sweep between them is clear at foot and chest height, and findPath runs A* without allocating.

export function nearestNode(nodes, x, z) {
	let best = 0, bd = 1e9;
	for (let i = 0; i < nodes.length; i++) { const d = (nodes[i][1] - x) ** 2 + (nodes[i][2] - z) ** 2; if (d < bd) { bd = d; best = i; } }
	return best;
}
export const callName = (name) => name.replace(/([a-z])([A-Z0-9])/g, '$1 $2'); // 'PansWest' → 'Pans West'

// Can a 0.8 m wide, 1.7 m tall body walk straight from (x0, z0) to (x1, z1) at height y? Low boxes are stepped over.
function sweepClear(boxes, x0, z0, x1, z1, y) {
	const dx = x1 - x0, dz = z1 - z0, steps = Math.max(2, Math.ceil(Math.hypot(dx, dz) / .8));
	for (let s = 0; s <= steps; s++) {
		const t = s / steps, x = x0 + dx * t, z = z0 + dz * t;
		for (const b of boxes) if (y + 1.7 > b.min.y && y < b.max.y && b.max.y - y > .45 && x + .4 >= b.min.x && x - .4 <= b.max.x && z + .4 >= b.min.z && z - .4 <= b.max.z) return false;
	}
	return true;
}

export function buildNav(map, boxes) {
	const nodes = map.nodes, n = nodes.length, links = nodes.map(() => []), dist = (i, j) => Math.hypot(nodes[j][1] - nodes[i][1], nodes[j][2] - nodes[i][2]);
	for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
		const a = nodes[i], b = nodes[j], y = Math.min(a[3], b[3]);
		if (dist(i, j) <= 20 && Math.abs(a[3] - b[3]) <= .5 && sweepClear(boxes, a[1], a[2], b[1], b[2], y) && sweepClear(boxes, a[1], a[2], b[1], b[2], y + .9)) { links[i].push(j); links[j].push(i); }
	}
	const ids = new Map(nodes.map((nd, i) => [nd[0], i])), g = new Float32Array(n), f = new Float32Array(n), from = new Int32Array(n), closed = new Uint8Array(n), open = new Int32Array(n * 2);
	return {
		_out: [],
		byName: (name) => ids.get(name) ?? -1,
		// A* over the links (climbing costs double); fills out with node indices start → goal, empty when unreachable.
		findPath(start, goal, out) {
			g.fill(Infinity); f.fill(Infinity); closed.fill(0);
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
					const cost = g[cur] + dist(cur, nb) + Math.abs(nodes[nb][3] - nodes[cur][3]) * 2;
					if (!closed[nb] && cost < g[nb]) { g[nb] = cost; f[nb] = cost + dist(nb, goal); from[nb] = cur; open[len++] = nb; }
				}
			}
			out.length = 0;
			if (!closed[goal]) return out;
			for (let c = goal; c !== start; c = from[c]) out.push(c);
			out.push(start);
			return out.reverse();
		},
	};
}
