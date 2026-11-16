// SALTLINE map.js — Brinehold, an original salt works at dusk (PLAN.md §10), loaded from maps/brinehold.lvl (written by
// tools/brinehold.mjs). Fields: boxes [x0, y0, z0, x1, y1, z1, material] for collision, rendering and the radar;
// nodes [name, x, z, y, flags 1 hold | 2 Pans | 4 Boiler, hold yaw°] and plans for the bots; callouts for the radar;
// floors, buildings and props for art/geo.js.
export const MAP = await (await fetch(new URL('../maps/brinehold.lvl', import.meta.url))).json();
export const buildBoxes = () => MAP.boxes.map((b) => ({ min: { x: b[0], y: b[1], z: b[2] }, max: { x: b[3], y: b[4], z: b[5] }, mat: b[6] }));
