// Brinehold level authoring (dev only). Run `node tools/brinehold.mjs` to regenerate game/maps/brinehold.lvl,
// the JSON level file the game loads. Axes: x east, z south (north is -z). Box = [x0, y0, z0, x1, y1, z1, material].
import { writeFileSync } from 'node:fs';
const boxes = [], buildings = [], props = [], floors = [];
const R = (x0, z0, x1, z1, y1, m, y0 = 0) => { boxes.push([x0, y0, z0, x1, y1, z1, m]); return boxes.length - 1; };
const BLD = (x0, z0, x1, z1, h, m = 8) => buildings.push(R(x0, z0, x1, z1, h, m));
const CRATE = (x, z, n = 1, s = 1.2) => { for (let i = 0; i < n; i++) R(x - s / 2, z - s / 2, x + s / 2, z + s / 2, s * (i + 1), 6, s * i); };
const BARREL = (...xz) => { for (let k = 0; k < xz.length; k += 2) { R(xz[k] - 0.31, xz[k + 1] - 0.31, xz[k] + 0.31, xz[k + 1] + 0.31, 0.9, 13); props.push(['barrel', xz[k], xz[k + 1]]); } };
const CONT = (x, z, alongZ, m, y0 = 0) => alongZ ? R(x - 1.22, z - 3.05, x + 1.22, z + 3.05, y0 + 2.6, m, y0) : R(x - 3.05, z - 1.22, x + 3.05, z + 1.22, y0 + 2.6, m, y0);
// wall(alongX, from, to, c0, c1, h, mat, gaps): a wall with openings [g0, g1, yLo, yHi] (door yLo = 0, window yLo > 0).
function wall(ax, a0, a1, c0, c1, h, m, gaps = []) {
  const put = (s, e, y0, y1) => (ax ? R(s, c0, e, c1, y1, m, y0) : R(c0, s, c1, e, y1, m, y0));
  let s = a0;
  for (const [g0, g1, lo, hi] of gaps) {
    put(s, g0, 0, h);
    if (lo > 0) put(g0, g1, 0, lo);
    if (hi < h) put(g0, g1, hi, h);
    s = g1;
  }
  put(s, a1, 0, h);
}
// Stairs climbing toward +dz or -dz along z, 8 steps of 0.4 m (the step-up height), 0.45 m run.
const STAIRS = (x0, x1, z, dz) => { for (let i = 0; i < 8; i++) { const a = z + dz * 0.45 * i; R(x0, Math.min(a, a + dz * 0.45), x1, Math.max(a, a + dz * 0.45), 0.4 * (i + 1), 0); } };

R(-50, -38, 50, 38, 0, 12, -0.5);
wall(1, -51, 51, -39, -38, 7, 0); wall(1, -51, 51, 38, 39, 7, 0);
wall(0, -38, 38, -51, -50, 7, 0); wall(0, -38, 38, 50, 51, 7, 0);

// Strand Yard (attacker spawn) with exits north (Conveyor), east (Mid) and south (Culvert).
wall(0, -6, 12, -35, -34, 4, 11, [[0, 4, 0, 4]]);
wall(1, -50, -34, -7, -6, 4, 11, [[-46, -40, 0, 4]]);
wall(1, -50, -34, 12, 13, 4, 11, [[-46, -40, 0, 4]]);
CONT(-48.3, -1, true, 4); CONT(-48.3, 5.2, true, 10); CONT(-48.3, -1, true, 3, 2.6);
CONT(-38.5, 10.6, false, 3); BLD(-39.5, -4.5, -36.5, -1.5, 2.9, 8);
CRATE(-36.2, 6.5, 2); CRATE(-37.4, 6.5);
// North Yard and the Conveyor lane (28 m sightline into Pans).
BLD(-50, -38, -6, -28, 8.5, 8);
BLD(-34, -20, -6, -12, 6.5, 8);
wall(0, -12, -7, -35, -34, 4, 11);
CONT(-48.3, -21, true, 3); CONT(-48.3, -14.6, true, 4); CRATE(-38, -17, 2); CRATE(-36.8, -17); CRATE(-16, -20.65); CRATE(-14.8, -20.65, 2); CRATE(-46, -10.5);
R(-32, -27.2, -10, -25.6, 1.4, 13);
CRATE(-24, -21.4, 2); R(-17, -21.2, -14, -20.6, 0.85, 5); CRATE(-31, -21.2);
// Pans (site A): evaporation basins, pump tower, salt piles.
wall(1, -6, 24, -17, -16, 3.6, 0, [[1, 7, 0, 3.6]]);
wall(0, -38, -16, 23, 24, 3.6, 0, [[-25, -19, 0, 3.6]]);
for (const [x0, x1] of [[-3, 3], [4, 10], [11, 17]]) for (const [z0, z1] of [[-36, -30], [-29, -23]]) {
  R(x0, z0, x1, z0 + 0.3, 0.32, 1); R(x0, z1 - 0.3, x1, z1, 0.32, 1); R(x0, z0, x0 + 0.3, z1, 0.32, 1); R(x1 - 0.3, z0, x1, z1, 0.32, 1);
  // Barrels (cover, with colliders) and a sandbag line in the courtyard.
BARREL(-45, -26, -44.2, -26.6, 22.5, -36.6, 3.4, 34.6, 4.2, 34.8, 47.6, -2, 22.8, -10.6, 23.2, -9.8, 22.4, -9.6, -44.6, 11, -45.3, 11.2,
  -5, -37, 24.8, 17.2, 24.9, 18, 16.6, 11.2);
R(10, 7, 13.6, 7.7, 1.1, 13);
floors.push([x0 + 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3, 3]);
}
R(13, -36, 19.5, -30, 3.25, 2, 3.0);
for (const [x, z] of [[13.2, -35.8], [19.3, -35.8], [13.2, -30.2], [19.3, -30.2]]) R(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 3.0, 2);
STAIRS(13.4, 14.4, -26.4, -1);
CRATE(5.5, -21, 2); CRATE(6.7, -21); CRATE(-2.5, -19.8); CRATE(18.5, -26.2, 2); R(1.5, -31.4, 2.1, -27.6, 1.15, 0);
R(-1.6, -34.2, 1.6, -31.8, 1.5, 13); R(18.2, -21.2, 21.6, -18.6, 1.4, 13);
R(8, -19.6, 12, -18.9, 1.1, 13);
// Mid: tank yard, Pumphouse (walk-through), courtyard with the gauge hut.
R(-30.2, -9.2, -25.8, -4.8, 5.5, 13); R(-26.2, 5.8, -21.8, 10.2, 5.5, 13);
CRATE(-31, 9.5); CRATE(-21.5, -10.6, 2);
wall(1, -18, -4, -7, -6.6, 5, 8, [[-15, -13, 2.4, 3.6], [-9, -7, 2.4, 3.6]]);
wall(1, -18, -4, 6.6, 7, 5, 8, [[-15, -13, 2.4, 3.6], [-9, -7, 2.4, 3.6]]);
wall(0, -6.6, 6.6, -18, -17.6, 5, 8, [[0, 3, 0, 3.1]]);
wall(0, -6.6, 6.6, -4.4, -4, 5, 8, [[-2, 1, 0, 3.1]]);
R(-18, -7, -4, 7, 5.4, 7, 5);
R(-12.5, -4, -9, -1, 1.6, 2); R(-14.2, 3, -13.8, 3.4, 5, 2); R(-8.2, 3, -7.8, 3.4, 5, 2); CRATE(-6, 5.2);
BLD(10, -9, 14, -4.5, 3.2, 8);
R(-2, -10.8, 1.6, -10.2, 0.85, 5); R(16, 2, 16.6, 6, 0.85, 5); CRATE(2, 4.6, 2); CRATE(3.2, 4.6);
CONT(17, -13.8, false, 4); CRATE(20.5, 9.5, 2);
wall(0, -16, 16, 24, 25, 4, 11, [[-4, 4, 0, 4]]);
BLD(-34, 12, -4, 20, 6, 8); BLD(-4, 12, 2, 20, 4.5, 11);
// Culvert (south lane): concrete channel with a roofed tunnel section and a corner into Boiler.
BLD(-34, 28.5, 2, 38, 5, 8);
R(-26, 20, -10, 28.5, 4.2, 0, 3.8);
R(-16, 22.5, -14, 25.5, 1.2, 9);
R(-2, 20, 2, 23.5, 3, 0);
CONT(-47, 30, true, 10); CONT(-47, 19.5, true, 4); CRATE(-37, 33, 2); CRATE(-38.2, 33);
// Boiler hall (site B): high windows on the west wall, skylights, the boiler, an east catwalk.
wall(1, 2, 26, 16, 16.4, 7, 8, [[8, 12, 0, 3.4], [15, 18, 4, 6], [20, 23, 4, 6]]);
wall(0, 16, 36, 2, 2.4, 7, 8, [[18.5, 21.5, 4, 6], [24, 28, 0, 3.4], [30.5, 33.5, 4, 6]]);
wall(0, 16, 36, 25.6, 26, 7, 8, [[19, 22.5, 0, 3.4]]);
wall(1, 2, 26, 35.6, 36, 7, 8);
for (const [z0, z1] of [[16, 19.5], [21, 25.5], [27, 31.5], [33, 36]]) R(2, z0, 26, z1, 7.4, 7, 7);
R(10, 27, 18, 31, 4.3, 13);
R(22, 26, 25.6, 35.6, 3.2, 2, 3.0); STAIRS(22.6, 23.6, 22.4, 1);
for (const [x, z] of [[7, 20], [7, 32], [19.5, 20.5]]) R(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 7, 0);
CRATE(5, 33.5, 2); CRATE(6.2, 33.5); CRATE(20, 18.6); CRATE(8.6, 25.6); CRATE(16, 34.6);
// Bastion Court (defender spawn).
BLD(30, -38, 48, -26, 6, 8); BLD(33, 12, 50, 36, 7, 11);
CONT(29.2, -11, true, 3); CONT(39, -10.8, false, 10); CONT(39, -10.8, false, 4, 2.6); CONT(45.2, 7, true, 3);
CRATE(27.5, -33, 2); CRATE(28.7, -33); CRATE(30, 26.5, 2); CRATE(28.8, 30); R(26.5, 33, 32, 33.6, 0.85, 5);

floors.push([-50, -38, 50, 38, 0], [-34, -16, 24, 12, 1], [-6, -38, 24, -16, 2], [-18, -7, -4, 7, 1],
  [2, 16, 26, 36, 1], [-34, 20, 2, 28.5, 4], [-50, -6, -34, 12, 0]);
props.push(
  ['tank', -28, -7, 2.2, 5.5], ['tank', -24, 8, 2.2, 5.5], ['pile', 0, -33, 2.6, 2.1], ['pile', 19.9, -19.9, 2.4, 1.9],
  ['conveyor', -32, -10, -27.2, -25.6, 1.4], ['boiler', 10, 18, 29, 2.15],
  ['rail', 14.6, -30, 19.5, -30, 3.25], ['rail', 13, -36, 13, -30, 3.25], ['rail', 22, 26, 22, 35.6, 3.2],
  ['lamp', -36.5, 1, 'w'], ['lamp', -22, -20.4, 'n'], ['lamp', -40, -26.5, 'n'], ['lamp', 3, -18, 'n'], ['lamp', 20, -36.5, 'n'],
  ['lamp', 8, 11.5, 'n'], ['lamp', 36, -24.5, 'n'], ['wlamp', -11, 4.8, 6.2], ['wlamp', -18, 3.6, 24], ['wlamp', -4, 3.6, 24],
  ['wlamp', 9, 6.4, 22], ['wlamp', 18, 6.4, 33],
  ['pipe', -26, 4.6, -7, -26, 4.6, -3, -17, 4.6, -3], ['pipe', -24, 4.6, 8, -24, 4.6, 4, -17, 4.6, 4],
  ['pipe', -33.6, 1.2, 20.4, -4.4, 1.2, 20.4], ['pipe', -33.6, 2, 28.1, -4, 2, 28.1], ['pipe', 14, 4.3, 29, 14, 7, 29],
  ['pipe', 24.6, 0.6, -15, 24.6, 0.6, -5, 24.6, 3, -5],
  ['sign', 'PANS', -8, 3.6, -20.05, 0, 3], ['sign', 'BOILER', 10, 4.6, 16, 0, 3.6], ['sign', 'CONVEYOR', -34.05, 3.4, -14, 1, 3.4],
  ['sign', 'CULVERT', -34.05, 3.4, 22, 1, 3], ['sign', 'PUMPHOUSE', -17.95, 3.9, 1.5, 1, 3.4], ['sign', 'BRINEHOLD SALTWORKS', -20, 6, -12, 2, 9],
  ['sign', 'BASTION', 30, 4.4, -26, 2, 3.4],
  ['bags', 8, -19.6, 12, -18.9, 1.1], ['bags', 10, 7, 13.6, 7.7, 1.1], ['shaft', 2.4, 4, 6, 18.5, 21.5], ['tape', 10, 15.6, 4, 0], ['tape', 1.6, 26, 4, Math.PI / 2], ['tape', 26.4, 20.75, 3.5, Math.PI / 2],
  ['tape', -5.6, -24.5, 6, Math.PI / 2], ['tape', 4, -15.6, 5, 0], ['tape', 24.4, -23, 5, Math.PI / 2], ['shaft', 2.4, 4, 6, 30.5, 33.5], ['zone', 8, -26, 'A'], ['zone', 13, 22, 'B'],
);


const MAP = {
  bounds: { x0: -50, x1: 50, z0: -38, z1: 38 },
  boxes, buildings, props, floors,
  // Radar lane names [text, x, z].
  callouts: [['PANS', 4, -34], ['BOILER', 18, 32], ['CONVEYOR', -22, -21], ['CULVERT', -22, 24], ['PUMPHOUSE', -11, 3], ['COURTYARD', 12, -4],
    ['YARD', -42, 8], ['COURT', 40, 5], ['NORTH YARD', -42, -18], ['BRINE', 30, -18]],
  spawns: { strand: [-42, 3], bastion: [40, 0] },
  zones: {
    buyStrand: { x0: -50, z0: -6, x1: -34, z1: 12 },
    buyBastion: { x0: 32, z0: -10, x1: 48, z1: 10 },
    sitePans: { cx: 8, cz: -26, r: 7 },
    siteBoiler: { cx: 13, cz: 22, r: 6 },
  },
  // [name, x, z, y, flags (1 hold/cover, 2 Pans site, 4 Boiler site), holdYawDeg]
  nodes: [
    ['StrandYardA', -42, 3, 0, 0, null], ['StrandYardB', -38, 0, 0, 0, null], ['StrandYardC', -45.5, 4, 0, 0, null],
    ['YardNorthGate', -43, -6.5, 0, 0, null], ['NorthYard', -42, -15, 0, 0, null], ['NorthCorner', -41, -24, 0, 0, null],
    ['ConveyorStart', -30, -23.5, 0, 0, null], ['ConveyorMid', -19, -23, 0, 1, -90], ['ConveyorEnd', -10, -23.5, 0, 0, null],
    ['PansWest', -3, -24.5, 0, 1, -90], ['PansFront', 4, -19.5, 0, 2, null], ['PansCenter', 8, -26.5, 0, 2, null],
    ['PansHold1', 20, -28.5, 0, 3, 90], ['PansHold2', 10, -21, 0, 3, 135], ['PansEast', 21, -23, 0, 3, 90],
    ['PansNorth', 3.6, -37, 0, 2, null], ['TowerFoot', 12.4, -24.8, 0, 2, null],
    ['BrineGate', 27, -22, 0, 0, null], ['BrineCorner', 27, -31, 0, 0, null],
    ['MidGate', -33, 2, 0, 0, null], ['MidYard', -27, 1.5, 0, 0, null], ['MidYardN', -23, -9, 0, 0, null], ['MidYardS', -28.5, 9.5, 0, 0, null],
    ['PumpWest', -20, 1.5, 0, 0, null], ['PumpInside', -14.5, 0.5, 0, 1, -90], ['PumpEast', -6, -0.5, 0, 0, null],
    ['CourtyardW', 2, -1, 0, 0, null], ['CourtyardN', 4, -13, 0, 0, null], ['CourtyardMid', 10, 1.5, 0, 0, null],
    ['GaugeHut', 16, -2, 0, 1, 90], ['CourtyardS', 6, 13.5, 0, 0, null], ['CourtyardE', 21, 0, 0, 0, null],
    ['BoilerNorthDoor', 10, 15, 0, 0, null], ['MidGateE', 27, 0, 0, 0, null],
    ['SouthGate', -43, 12.5, 0, 0, null], ['SouthYard', -41, 23, 0, 0, null], ['CulvertIn', -32, 24, 0, 0, null],
    ['CulvertTunnel', -20, 24, 0, 0, null], ['CulvertSplitN', -15, 21.3, 0, 0, null], ['CulvertSplitS', -15, 26.8, 0, 0, null],
    ['CulvertCorner', -6, 25.5, 0, 1, -90], ['CulvertOut', 0, 26, 0, 0, null], ['BoilerWestDoor', 3.6, 26, 0, 4, null],
    ['BoilerHall', 9, 22, 0, 4, null], ['BoilerCenter', 13, 22.5, 0, 4, null], ['BoilerHold1', 20.5, 24.5, 0, 5, 90],
    ['BoilerHold2', 5.5, 29.5, 0, 5, -15], ['BoilerEastDoor', 24.6, 20.75, 0, 4, null], ['BoilerBack', 20, 32.5, 0, 4, null],
    ['BoilerSouth', 10, 33, 0, 4, null],
    ['BastionCourtA', 40, 0, 0, 0, null], ['BastionCourtB', 38, 6, 0, 0, null], ['BastionCourtC', 42, -5, 0, 0, null],
    ['CourtWest', 31, 1, 0, 0, null], ['CourtNorth', 33, -20, 0, 0, null], ['LoadingDock', 29.5, 19, 0, 0, null],
    ['DockDoor', 27.5, 20.75, 0, 0, null],
  ],
  plans: {
    strand: {
      rushPans: [['YardNorthGate', 'NorthYard', 'NorthCorner', 'ConveyorStart', 'ConveyorMid', 'ConveyorEnd', 'PansWest', 'PansCenter'],
        ['YardNorthGate', 'NorthCorner', 'ConveyorMid', 'ConveyorEnd', 'PansWest', 'PansFront'],
        ['YardNorthGate', 'NorthYard', 'ConveyorStart', 'ConveyorEnd', 'PansWest'],
        ['MidGate', 'MidYard', 'PumpWest', 'PumpInside', 'PumpEast', 'CourtyardW', 'CourtyardN', 'PansFront'],
        ['MidGate', 'PumpWest', 'PumpEast', 'CourtyardN', 'PansFront', 'PansCenter']],
      rushBoiler: [['SouthGate', 'SouthYard', 'CulvertIn', 'CulvertTunnel', 'CulvertSplitN', 'CulvertCorner', 'CulvertOut', 'BoilerWestDoor', 'BoilerCenter'],
        ['SouthGate', 'CulvertIn', 'CulvertTunnel', 'CulvertSplitS', 'CulvertCorner', 'BoilerWestDoor', 'BoilerHall'],
        ['SouthGate', 'SouthYard', 'CulvertIn', 'CulvertSplitS', 'CulvertOut', 'BoilerWestDoor'],
        ['MidGate', 'PumpWest', 'PumpEast', 'CourtyardW', 'CourtyardS', 'BoilerNorthDoor', 'BoilerHall'],
        ['MidGate', 'MidYard', 'PumpInside', 'PumpEast', 'CourtyardMid', 'CourtyardS', 'BoilerNorthDoor']],
      split: [['YardNorthGate', 'NorthCorner', 'ConveyorEnd'], ['SouthGate', 'CulvertIn', 'CulvertCorner'], ['MidGate', 'PumpEast', 'CourtyardW'],
        ['YardNorthGate', 'ConveyorMid', 'PansWest'], ['MidGate', 'PumpInside', 'CourtyardS']],
      spread: [['YardNorthGate', 'ConveyorMid'], ['MidGate', 'PumpInside'], ['SouthGate', 'CulvertTunnel'], ['YardNorthGate', 'ConveyorEnd'], ['MidGate', 'CourtyardMid']],
    },
    bastion: { pans: ['PansHold1', 'PansHold2'], boiler: ['BoilerHold1', 'BoilerHold2'], rotator: 'GaugeHut' },
  },
};
writeFileSync(new URL('../game/maps/brinehold.lvl', import.meta.url), JSON.stringify(MAP));
console.log(`brinehold.lvl: ${boxes.length} boxes, ${props.length} props, ${MAP.nodes.length} nodes`);
