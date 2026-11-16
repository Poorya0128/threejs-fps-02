// SALTLINE config.js every tunable lives here (PLAN.md §5.1). Numbers in
export const TICK = 1 / 64;
export const MAX_TICKS_PER_FRAME = 5;

export const PALETTE = {
  salt: 0xe8e2d6,concrete: 0xcfc6b4,plaster: 0xd9d2c3,
  steel: 0x6b6f73,rust: 0x8a4a2c,teal: 0x2f7f78,wood: 0x7a5a3c,
  asphalt: 0x2e2d2b,darkSteel: 0x30343a,rubber: 0x1d1d1f,
  amber: 0xf0a03c,tealBright: 0x2f8f86,
  sun: 0xffd2a1,skyZenith: 0x3a4f78,horizon: 0xf2b48a,shadowFill: 0x6f86a8,
  dusk: 0x2b2140,
};

export const MATERIALS = [
  { color: PALETTE.concrete,roughness: 0.95,metalness: 0.0 },
  { color: PALETTE.salt,roughness: 0.95,metalness: 0.0 },
  { color: PALETTE.steel,roughness: 0.55,metalness: 0.85 },
  { color: PALETTE.rust,roughness: 0.9,metalness: 0.2 },
  { color: PALETTE.teal,roughness: 0.6,metalness: 0.4 },
  { color: PALETTE.amber,roughness: 0.6,metalness: 0.2 },
  { color: PALETTE.wood,roughness: 0.9,metalness: 0.0 },
  { color: PALETTE.asphalt,roughness: 1.0,metalness: 0.0 },
  { color: PALETTE.plaster,roughness: 0.95,metalness: 0.0 },
  { color: PALETTE.darkSteel,roughness: 0.5,metalness: 0.9 },
];

export const MOVE = {
  friction: 5.5,stopSpeed: 1.9,accelGround: 10,accelAir: 1.2,
  gravity: 15,jumpVel: 4.8,
  speed: { knife: 6.0,pistol: 5.7,smg: 5.6,rifle: 5.1,marksman: 4.6 },
  defaultSpeed: 5.5,walkMul: 0.52,crouchMul: 0.34,scopeMul: 0.6,
  radius: 0.32,heightStand: 1.8,heightCrouch: 1.25,
  eyeStand: 1.62,eyeCrouch: 1.12,crouchTime: 0.12,stepUp: 0.4,
  stepNoiseStride: 0.38,landNoiseMinFall: 1.2,
};

export const ROUND = {
  buyTime: 12,liveTime: 105,fuseTime: 40,postTime: 5,
  winRounds: 7,swapAfter: 6,
  plantTime: 3.0,defuseTime: 7.0,defuseCuttersTime: 3.5,
};

export const ECON = {
  start: 900,cap: 12000,
  winElim: 3000,winObjective: 3300,
  loss: 1500,lossBonus: 400,lossMax: 3100,
  kill: { pistol: 250,smg: 550,shotgun: 750,rifle: 250,marksman: 100,knife: 150 },
  plant: 300,plantLossBonus: 600,
};

export const BOT = {
  recruit: { react: [0.45,0.7],aimErr: 0.032,head: 0.05,burst: [2,3] },
  regular: { react: [0.2,0.38],aimErr: 0.016,head: 0.15,burst: [3,5] },
  veteran: { react: [0.12,0.22],aimErr: 0.01,head: 0.3,burst: [4,6] },
};

export const RENDER = {
  exposure: 1.3,fogColor: 0xa5836d,fogNear: 55,fogFar: 190,
  sunColor: 0xffd2a1,sunIntensity: 3.2,sunElevDeg: 10,sunAzimDeg: 235,
  shadowSize: 4096,shadowBias: -0.0003,shadowNormalBias: 0.03,shadowRadius: 2,
  hemiSky: 0x8aa6d1,hemiGround: 0xa4886a,hemiIntensity: 0.65,
  envIntensity: 0.85,bloomThreshold: 1.0,bloomStrength: 0.06,
  maxPointLights: 12,
};

export const WEAPONS = {
  wren:    { name: 'WREN',cls: 'pistol',price: 0,dmg: 28,rpm: 380,auto: false,mag: 15,reserve: 45,reload: 1.1,pellets: 1,falloff: 0.92,noise: 30,spread: [0.004,0.7,1.0,0.03,0.006],kick: [0.006,0.0007,0.001,4] },
  mako:    { name: 'MAKO .45',cls: 'pistol',price: 700,dmg: 52,rpm: 220,auto: false,mag: 7,reserve: 28,reload: 1.4,pellets: 1,falloff: 0.9,noise: 32,spread: [0.006,0.7,1.8,0.035,0.01],kick: [0.011,0.0007,0.002,4] },
  hornet:  { name: 'HORNET',cls: 'smg',price: 1250,dmg: 24,rpm: 850,auto: true,mag: 30,reserve: 120,reload: 1.6,pellets: 1,falloff: 0.8,noise: 35,spread: [0.006,0.7,0.6,0.025,0.003],kick: [0.004,0.0004,0.002,6] },
  breaker: { name: 'BREAKER',cls: 'shotgun',price: 1100,dmg: 9,rpm: 70,auto: false,mag: 6,reserve: 30,reload: 0.6,shell: true,pellets: 9,falloff: 0.75,noise: 40,spread: [0.02,0.8,1.0,0.04,0],kick: [0.02,0,0,1] },
  talon:   { name: 'TALON',cls: 'rifle',price: 2700,dmg: 34,rpm: 600,auto: true,mag: 30,reserve: 90,reload: 2.2,pellets: 1,falloff: 0.9,noise: 45,spread: [0.0035,0.7,1.0,0.03,0.004],kick: [0.007,0.001,0.003,6] },
  gavel:   { name: 'GAVEL',cls: 'rifle',price: 3000,dmg: 31,rpm: 660,auto: true,mag: 25,reserve: 75,reload: 2.0,pellets: 1,falloff: 0.92,noise: 45,spread: [0.003,0.7,1.0,0.03,0.0035],kick: [0.006,0.0006,0.002,6] },
  longbow: { name: 'LONGBOW',cls: 'marksman',price: 4500,dmg: 112,rpm: 40,auto: false,mag: 5,reserve: 20,reload: 2.8,pellets: 1,falloff: 0.95,noise: 50,scope: true,zoomFov: [40,15],spread: [0.05,0.7,1.0,0.06,0.012],scopedSpread: 0.0008,kick: [0.03,0,0,1] },
  cutlass: { name: 'CUTLASS',cls: 'knife',price: 0,dmg: 40,backstab: 65,rpm: 100,auto: false,mag: 0,reserve: 0,reload: 0,pellets: 1,falloff: 1,noise: 0,range: 1.9,spread: [0,1,0,0,0],kick: [0,0,0,1] },
};

export const GRENADES = {
  shard: { name: 'SHARD',price: 300,max: 1,fuse: 1.6,dmg: 98,radius: 6 },
  veil: { name: 'VEIL',price: 300,max: 1,fuse: 2,dur: 15,radius: 3.2 },
  glare: { name: 'GLARE',price: 200,max: 2,fuse: 1.4,blind: 2.5,range: 40 },
};
export const THROW = { full: 16,lob: 8,up: 2.5,gravity: 15,bounce: 0.45,cool: 0.9 };
export const BUY = [
  ['talon','TALON RIFLE',2700,'1'],['gavel','GAVEL RIFLE',3000,'2'],
  ['longbow','LONGBOW MARKSMAN',4500,'3'],['hornet','HORNET SMG',1250,'4'],
  ['breaker','BREAKER SHOTGUN',1100,'5'],['mako','MAKO .45 PISTOL',700,'6'],
  ['shard','SHARD FRAG',300,'7'],['veil','VEIL SMOKE',300,'8'],
  ['glare','GLARE FLASH',200,'9'],['armor','PLATE VEST',650,'0'],
  ['helm','PLATE + HELM',1000,''],['cutters','CUTTERS (BASTION)',400,''],
];
export const LINEUPS = [
  ['ConveyorEnd','veil',-16,-26],['CulvertCorner','veil',18,24],
];

export const HIT = { head: 4,headHelm: 2.4,chest: 1,stomach: 1,arm: 0.9,leg: 0.75 };
export const ARMOR_RATIO = 0.5;

export const VM = {
  wren:    { barrel: 0.12,mag: 'straight',stock: false,accent: 0x8a7a5a,grip: 0 },
  mako:    { barrel: 0.14,mag: 'straight',stock: false,accent: 0x5a5a52,grip: 0 },
  hornet:  { barrel: 0.2,mag: 'straight',stock: true,accent: 0x2f7f78,grip: 1 },
  breaker: { barrel: 0.5,mag: 'tube',stock: true,accent: 0x7a5a3c,grip: 0 },
  talon:   { barrel: 0.4,mag: 'curved',stock: true,accent: 0xf0a03c,grip: 1 },
  gavel:   { barrel: 0.36,mag: 'straight',stock: true,accent: 0x4a6a7a,grip: 1 },
  longbow: { barrel: 0.62,mag: 'straight',stock: true,accent: 0x2b4a3a,grip: 0,scope: true },
  cutlass: { barrel: 0,mag: 'none',stock: false,accent: 0xc8c0b0,grip: 0 },
};


export const INPUT = {
  mouseSens: 0.0023,pitchMax: 1.55,fov: 78,
};
