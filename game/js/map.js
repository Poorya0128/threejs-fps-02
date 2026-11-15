// SALTLINE map.js — Brinehold layout data (PLAN.md §10). One box list feeds
// collision, rendering and the radar. Format: [cx, cy, cz, sx, sy, sz, mat]
// (centre + size). Materials: 0 concrete, 1 salt, 2 steel, 3 rust, 4 teal,
// 5 amber, 6 wood, 7 dark, 8 plaster, 9 dark steel. North is -Z.
export const MAP = {
  bounds: { x0: -55, x1: 55, z0: -40, z1: 40 },
  boxes: [
    // ground + outer walls
    [0, -0.25, 0, 110, 0.5, 80, 0],
    [0, 3, -40.5, 111, 6, 1, 0], [0, 3, 40.5, 111, 6, 1, 0],
    [-55.5, 3, 0, 1, 6, 81, 0], [55.5, 3, 0, 1, 6, 81, 0],
    // Conveyor lane (west, x ~ -28, z +20..-26): belt west, low wall east
    [-32, 0.55, -3, 1.4, 1.1, 46, 2],
    [-22, 0.6, 2, 1, 1.2, 16, 0], [-22, 0.6, -18, 1, 1.2, 16, 0],
    [-30, 0.5, -18, 2, 1, 1, 6],
    // Pans site (centre -16,-30): low salt walls, 2 entrances from the south
    [-28, 0.55, -30, 1, 1.1, 14, 1], [-4, 0.55, -30, 1, 1.1, 14, 1],
    [-16, 0.55, -37, 25, 1.1, 1, 1],
    [-29, 0.55, -23, 3, 1.1, 1, 1], [-19, 0.55, -23, 7, 1.1, 1, 1],
    [-7, 0.55, -23, 3, 1.1, 1, 1],
    [-16, 0.55, -30, 8, 1.1, 1, 1], [-16, 0.55, -33, 1, 1.1, 6, 1],
    [-22, 0.3, -33, 3, 0.6, 3, 1], [-10, 0.3, -27, 2.5, 0.6, 2.5, 1],
    // Pump tower platform + stairs (elevated position over Pans)
    [-8, 2.0, -34, 4, 0.4, 4, 2],
    [-8, 0.175, -29.5, 1.2, 0.35, 0.6, 0], [-8, 0.525, -30.05, 1.2, 0.35, 0.6, 0],
    [-8, 0.875, -30.6, 1.2, 0.35, 0.6, 0], [-8, 1.225, -31.15, 1.2, 0.35, 0.6, 0],
    [-8, 1.575, -31.7, 1.2, 0.35, 0.6, 0], [-8, 1.925, -32.25, 1.2, 0.35, 0.6, 0],
    // Pumphouse (centre -2,-6): window north (overlooks Pans), door south, roof
    [-6, 2, -11, 5, 4, 1, 8], [2, 2, -11, 5, 4, 1, 8],
    [-2, 0.55, -11, 3, 1.1, 1, 8], [-2, 3.55, -11, 3, 0.9, 1, 8],
    [-5.65, 2, -1, 5.7, 4, 1, 8], [1.65, 2, -1, 5.7, 4, 1, 8],
    [-2, 3.6, -1, 1.6, 0.8, 1, 8],
    [-8, 2, -6, 1, 4, 11, 8], [4, 2, -6, 1, 4, 11, 8],
    [-2, 4.2, -6, 13, 0.4, 11, 7],
    [-2, 3.95, -6, 11, 0.08, 9, 8], // plaster ceiling (roof underside is asphalt)
    // Pumphouse roof stairs (east side, 12 steps)
    [6, 0.175, -3, 0.6, 0.35, 1.2, 0], [6.55, 0.525, -3, 0.6, 0.35, 1.2, 0],
    [7.1, 0.875, -3, 0.6, 0.35, 1.2, 0], [7.65, 1.225, -3, 0.6, 0.35, 1.2, 0],
    [8.2, 1.575, -3, 0.6, 0.35, 1.2, 0], [8.75, 1.925, -3, 0.6, 0.35, 1.2, 0],
    [9.3, 2.275, -3, 0.6, 0.35, 1.2, 0], [9.85, 2.625, -3, 0.6, 0.35, 1.2, 0],
    [10.4, 2.975, -3, 0.6, 0.35, 1.2, 0], [10.95, 3.325, -3, 0.6, 0.35, 1.2, 0],
    [11.5, 3.675, -3, 0.6, 0.35, 1.2, 0], [12.05, 4.025, -3, 0.6, 0.35, 1.2, 0],
    // Culvert tunnel (east): segment 1 N-S x 10..14 z 2..16, segment 2 E-W z 16..20
    [9.5, 1.8, 9, 1, 3.6, 15, 8], [14.5, 1.8, 9, 1, 3.6, 15, 8],
    [12, 3.6, 9, 6, 0.4, 15, 7],
    [12, 3.35, 9, 4, 0.08, 14, 8], // plaster ceiling seg 1
    [18, 1.8, 15.5, 9, 3.6, 1, 8], [18, 1.8, 20.5, 9, 3.6, 1, 8],
    [18, 3.6, 18, 9, 0.4, 6, 7],
    [18, 3.35, 18, 9, 0.08, 6, 8], // plaster ceiling seg 2
    [12, 0.02, 9, 1, 0.04, 14, 7],
    // Boiler hall (centre 18,30): walls with 2 north doors + 1 east door, roof
    [9, 2.5, 22, 7, 5, 1, 8], [20, 2.5, 22, 6, 5, 1, 8], [28, 2.5, 22, 7, 5, 1, 8],
    [14.75, 4.1, 22, 4.5, 1.8, 1, 8], [23.75, 4.1, 22, 1.5, 1.8, 1, 8],
    [18, 2.5, 38, 27, 5, 1, 8],
    [5, 2.5, 30, 1, 5, 17, 8],
    [31, 2.5, 25.25, 1, 5, 7.5, 8], [31, 2.5, 34.75, 1, 5, 7.5, 8],
    [31, 4.1, 30, 1, 1.8, 2, 8],
    [18, 5.2, 30, 27, 0.4, 17, 7],
    [18, 4.95, 30, 25, 0.08, 15, 8], // plaster ceiling (roof underside is asphalt)
    [14, 1.5, 33, 6, 3, 4, 2], // boiler vessel
    [6, 3, 30, 0.6, 6, 0.6, 3], // rust pipe column
    // Boiler catwalk (east wall) + stairs
    [28.5, 3.0, 30, 3, 0.3, 12, 2],
    [25.5, 0.175, 24.5, 0.55, 0.35, 1.2, 0], [26, 0.525, 24.5, 0.55, 0.35, 1.2, 0],
    [26.5, 0.875, 24.5, 0.55, 0.35, 1.2, 0], [27, 1.225, 24.5, 0.55, 0.35, 1.2, 0],
    [27.5, 1.575, 24.5, 0.55, 0.35, 1.2, 0], [28, 1.925, 24.5, 0.55, 0.35, 1.2, 0],
    [28.5, 2.275, 24.5, 0.55, 0.35, 1.2, 0], [29, 2.625, 24.5, 0.55, 0.35, 1.2, 0],
    // Mid connector + court cover
    [10, 0.6, -6, 8, 1.2, 1, 0],
    [-25, 0.5, 6, 1, 1, 1, 6], [-25, 0.5, -14, 1, 1, 1, 6],
    [-24, 0.5, -14, 1, 1, 1, 6], [-40, 0.5, 20, 1.5, 1, 1.5, 6],
    [-34, 0.5, 32, 1, 1, 1, 6], [8, 0.5, -2, 1, 1, 1, 6],
    [14, 0.5, -8, 2, 1, 1, 6], [26, 0.5, 4, 1, 1, 1, 6],
    [32, 0.5, -6, 1, 1, 1, 6],
    [-20, 0.45, -18, 4, 0.9, 1, 1], [6, 0.45, 14, 1, 0.9, 4, 1],
    [24, 0.45, 12, 3, 0.9, 1, 1],
    [10, 0.5, 26, 1.5, 1, 1.5, 6], [24, 0.5, 35, 1.5, 1, 1.5, 6],
  ],
  spawns: { strand: [-38, 26], bastion: [28, -2] },
  zones: {
    buyStrand: { x0: -46, z0: 18, x1: -30, z1: 34 },
    buyBastion: { x0: 20, z0: -10, x1: 36, z1: 6 },
    sitePans: { cx: -16, cz: -30, r: 9 },
    siteBoiler: { cx: 18, cz: 30, r: 8 },
  },
  // Sodium interior lights [x, y, z] (ART.md §3).
  lights: [[14, 3.5, 27], [22, 3.5, 33], [-2, 3, -6], [12, 2.8, 9], [18, 2.8, 18]],
  // Waypoints [name, x, z, y, flags, holdYawDeg|null]. flags: 1 cover, 2 site Pans, 4 site Boiler.
  nodes: [
    ['StrandYardA', -38, 26, 0, 0, null], ['StrandYardB', -33, 31, 0, 0, null],
    ['StrandYardC', -44, 21, 0, 0, null], ['YardGate', -36, 14, 0, 0, null],
    ['ConveyorStart', -30, 18, 0, 0, null], ['ConveyorMid', -28, 2, 0, 0, null],
    ['ConveyorWest', -33, -8, 0, 1, -90], ['ConveyorEnd', -27, -20, 0, 0, null],
    ['ConveyorBelt', -28, -12, 0, 1, 0], ['PansApproach', -22, -24, 0, 0, null],
    ['PansFront', -16, -26, 0, 0, null], ['PansWest', -25, -32, 0, 1, 45],
    ['PansEast', -8, -28, 0, 1, -45], ['PumpTower', -8, -34, 2.2, 1, 180],
    ['PansHold1', -12, -33, 0, 3, 0], ['PansHold2', -24, -27, 0, 3, 90],
    ['PansCenter', -16, -30, 0, 2, null], ['PansGate', -20, -21, 0, 0, null],
    ['Pumphouse', -2, -6, 0, 0, null], ['PumpStairs', 6, -3, 0, 0, null],
    ['PumpWindow', -2, -10, 0, 1, 0], ['PumpRoof', -2, -6, 4.4, 1, 0],
    ['MidLow', 6, -4, 0, 0, null], ['MidHigh', 12, -6, 0, 0, null],
    ['MidWall', 10, -6, 0, 1, -90], ['RotateMid', 16, -2, 0, 0, null],
    ['CulvertIn', 10, 2, 0, 0, null], ['CulvertMid', 12, 9, 0, 0, null],
    ['CulvertCorner', 15, 17, 0, 0, null], ['CulvertOut', 18, 21, 0, 0, null],
    ['BoilerFront', 16, 24, 0, 0, null], ['BoilerDoor', 14.5, 24, 0, 0, null],
    ['BoilerHall', 18, 30, 0, 4, null], ['BoilerBack', 22, 34, 0, 4, null],
    ['Catwalk', 28.5, 30, 3.15, 1, -90], ['BoilerHold1', 13, 32, 0, 5, 0],
    ['BoilerHold2', 23, 28, 0, 5, 180], ['BoilerCenter', 18, 30, 0, 4, null],
    ['BoilerGate', 20, 20, 0, 0, null], ['CourtGate', 22, -8, 0, 0, null],
    ['BastionCourtA', 28, -2, 0, 0, null], ['BastionCourtB', 32, 2, 0, 0, null],
    ['BastionCourtC', 24, 4, 0, 0, null], ['CourtEast', 34, -4, 0, 0, null],
    ['YardSouth', -40, 32, 0, 0, null],
  ],
  // Team plans: node names per bot (PLAN.md §9.2). Used from M3/M4.
  plans: {
    strand: {
      rushPans: [['ConveyorStart', 'ConveyorMid', 'ConveyorEnd', 'PansFront'], ['ConveyorStart', 'ConveyorMid', 'PansApproach', 'PansFront'], ['YardGate', 'ConveyorMid', 'ConveyorWest', 'PansWest'], ['MidLow', 'Pumphouse', 'PumpWindow', 'PansEast'], ['YardGate', 'ConveyorStart', 'ConveyorMid', 'PansApproach']],
      rushBoiler: [['MidLow', 'CulvertIn', 'CulvertMid', 'CulvertCorner', 'BoilerFront'], ['MidLow', 'CulvertIn', 'CulvertMid', 'CulvertOut', 'BoilerHall'], ['YardGate', 'MidLow', 'MidHigh', 'RotateMid', 'BoilerGate'], ['ConveyorStart', 'ConveyorMid', 'Pumphouse', 'MidHigh', 'BoilerFront'], ['YardGate', 'ConveyorMid', 'ConveyorEnd', 'PansFront']],
      split: [['ConveyorStart', 'ConveyorMid', 'PansApproach'], ['CulvertIn', 'CulvertMid', 'CulvertCorner'], ['YardGate', 'MidLow', 'Pumphouse'], ['ConveyorWest', 'ConveyorEnd', 'PansWest'], ['MidHigh', 'RotateMid', 'BoilerGate']],
      spread: [['ConveyorStart', 'ConveyorMid', 'ConveyorEnd'], ['MidLow', 'Pumphouse', 'PumpWindow'], ['CulvertIn', 'CulvertMid', 'CulvertCorner'], ['YardGate', 'ConveyorWest', 'PansApproach'], ['MidHigh', 'RotateMid', 'CourtGate']],
    },
    bastion: { pans: ['PansHold1', 'PansHold2'], boiler: ['BoilerHold1', 'BoilerHold2'], rotator: 'RotateMid' },
  },
};

// Build collision AABBs from the raw box list (once at boot).
export function buildBoxes() {
  const out = [];
  for (let i = 0; i < MAP.boxes.length; i++) {
    const b = MAP.boxes[i];
    out.push({
      min: { x: b[0] - b[3] / 2, y: b[1] - b[4] / 2, z: b[2] - b[5] / 2 },
      max: { x: b[0] + b[3] / 2, y: b[1] + b[4] / 2, z: b[2] + b[5] / 2 },
      mat: b[6],
    });
  }
  return out;
}
