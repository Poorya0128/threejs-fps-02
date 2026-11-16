// SALTLINE map.js — Brinehold, an original salt works at dusk (PLAN.md §10). The layout is level data in
// maps/brinehold.lvl (authored with tools/brinehold.mjs): 100 × 76 m, Strand Yard spawn (west), Bastion Court (east)
// and three lanes — Conveyor (north, a 28 m sightline into Pans), the walk-through Pumphouse and its courtyard (mid),
// and the Culvert (south, a roofed tunnel with a split and a corner). Sites: Pans (A), open evaporation basins under
// a pump tower; Boiler (B), an indoor hall with a catwalk and three doors. Fields: boxes [x0,y0,z0,x1,y1,z1,material]
// feed collision, rendering and the radar; nodes [name,x,z,y,flags 1 hold|2 Pans|4 Boiler,holdYaw°] and plans feed the
// bots; floors, buildings and props are dressing for art/geo.js.
export const MAP = await (await fetch(new URL('../maps/brinehold.lvl', import.meta.url))).json();
export const buildBoxes = () => MAP.boxes.map((b) => ({ min: { x: b[0], y: b[1], z: b[2] }, max: { x: b[3], y: b[4], z: b[5] }, mat: b[6] }));
