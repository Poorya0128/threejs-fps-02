// SALTLINE config.js — every tunable lives here (PLAN.md §5.1). Numbers in
// this file only; logic elsewhere. Palette is strict (PLAN.md §4.1).
export const TICK = 1 / 64;
export const MAX_TICKS_PER_FRAME = 5;

// --- palette (sRGB hex) ---
export const PALETTE = {
  salt: 0xe8e2d6, concrete: 0xcfc6b4, plaster: 0xd9d2c3,
  steel: 0x6b6f73, rust: 0x8a4a2c, teal: 0x2f7f78, wood: 0x7a5a3c,
  asphalt: 0x2e2d2b, darkSteel: 0x30343a, rubber: 0x1d1d1f,
  amber: 0xf0a03c, tealBright: 0x2f8f86,
  sun: 0xffd2a1, skyZenith: 0x3a4f78, horizon: 0xf2b48a, shadowFill: 0x6f86a8,
  dusk: 0x2b2140,
};

// Blockout material ids (map.js boxes reference these). Flat colours in M1;
// ART.md §5 replaces them with procedural PBR from M5 on.
export const MATERIALS = [
  { color: PALETTE.concrete, roughness: 0.95, metalness: 0.0 }, // 0 concrete
  { color: PALETTE.salt, roughness: 0.95, metalness: 0.0 },     // 1 salt crust
  { color: PALETTE.steel, roughness: 0.55, metalness: 0.85 },   // 2 steel
  { color: PALETTE.rust, roughness: 0.9, metalness: 0.2 },      // 3 rust
  { color: PALETTE.teal, roughness: 0.6, metalness: 0.4 },      // 4 teal paint
  { color: PALETTE.amber, roughness: 0.6, metalness: 0.2 },     // 5 amber paint
  { color: PALETTE.wood, roughness: 0.9, metalness: 0.0 },      // 6 wood
  { color: PALETTE.asphalt, roughness: 1.0, metalness: 0.0 },   // 7 dark ground
  { color: PALETTE.plaster, roughness: 0.95, metalness: 0.0 },  // 8 plaster
  { color: PALETTE.darkSteel, roughness: 0.5, metalness: 0.9 }, // 9 dark steel
];

// --- movement (PLAN.md §6) ---
export const MOVE = {
  friction: 5.5, stopSpeed: 1.9, accelGround: 10, accelAir: 1.2,
  gravity: 15, jumpVel: 4.8,
  speed: { knife: 6.0, pistol: 5.7, smg: 5.6, rifle: 5.1, marksman: 4.6 },
  defaultSpeed: 5.5, walkMul: 0.52, crouchMul: 0.34, scopeMul: 0.6,
  radius: 0.32, heightStand: 1.8, heightCrouch: 1.25,
  eyeStand: 1.62, eyeCrouch: 1.12, crouchTime: 0.12, stepUp: 0.4,
  stepNoiseStride: 0.38, landNoiseMinFall: 1.2,
};

// --- round / match (PLAN.md §4.3, used from M3; defined now so state is stable) ---
export const ROUND = {
  buyTime: 12, liveTime: 105, fuseTime: 40, postTime: 5,
  winRounds: 7, swapAfter: 6,
  plantTime: 3.0, defuseTime: 7.0, defuseCuttersTime: 3.5,
};

// --- render / light (ART.md §2-3) ---
export const RENDER = {
  exposure: 1.3, fogColor: 0xa5836d, fogNear: 55, fogFar: 190,
  sunColor: 0xffd2a1, sunIntensity: 3.2, sunElevDeg: 10, sunAzimDeg: 235,
  shadowSize: 4096, shadowBias: -0.0003, shadowNormalBias: 0.03, shadowRadius: 2,
  hemiSky: 0x8aa6d1, hemiGround: 0xa4886a, hemiIntensity: 0.65,
  envIntensity: 0.85, bloomThreshold: 1.0, bloomStrength: 0.06,
  maxPointLights: 12,
};

// --- input ---
export const INPUT = {
  mouseSens: 0.0023, pitchMax: 1.55, fov: 78,
};
