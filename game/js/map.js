// Brinehold (PLAN.md §10) from maps/brinehold.lvl (tools/brinehold.mjs): boxes [x0, y0, z0, x1, y1, z1, material],
// nodes [name, x, z, y, flags 1 hold | 2 Pans | 4 Boiler, yaw°], plans, callouts, floors, buildings, props.
export const MAP = await (await fetch(new URL('../maps/brinehold.lvl', import.meta.url))).json();
export const buildBoxes = () => MAP.boxes.map((b) => ({ min: { x: b[0], y: b[1], z: b[2] }, max: { x: b[3], y: b[4], z: b[5] }, mat: b[6] }));
