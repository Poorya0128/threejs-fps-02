// SALTLINE config.js — every tunable lives here (PLAN.md §5.1).
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

export const MOVE = {
	friction: 5.5,stopSpeed: 1.9,accelGround: 10,accelAir: 1.2,
	gravity: 15,jumpVel: 4.8,
	speed: { knife: 6.0,pistol: 5.7,smg: 5.6,rifle: 5.1,marksman: 4.6 },
	defaultSpeed: 5.5,walkMul: .52,crouchMul: .34,scopeMul: .6,
	radius: .32,heightStand: 1.8,heightCrouch: 1.25,
	eyeStand: 1.62,eyeCrouch: 1.12,crouchTime: .12,stepUp: .4,
	stepNoiseStride: .38,landNoiseMinFall: 1.2,
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
	recruit: { react: [.45,.7],aimErr: .032,head: .05,burst: [2,3] },
	regular: { react: [.2,.38],aimErr: .016,head: .15,burst: [3,5] },
	veteran: { react: [.12,.22],aimErr: .01,head: .3,burst: [4,6] },
};

export const RENDER = {
	exposure: 1.15, fogColor: 0xc4a58f, fogDensity: .0042,
	sunColor: 0xffc890, sunIntensity: 3.6, sunElevDeg: 15, sunAzimDeg: 280,
	shadowSize: 4096, shadowBias: -.00025, shadowNormalBias: .035, shadowRadius: 2,
	hemiSky: 0x9ab0d0, hemiGround: 0x9a8070, hemiIntensity: 1.5,
	envIntensity: 1.0, bloomThreshold: 1.0, bloomStrength: .07,
};

// spread: [base, crouch ×, move ×, air, bloom per shot] radians; kick: [pitch, climb/shot, sway, shots to level].
export const WEAPONS = {
	wren:    { name: 'WREN', cls: 'pistol', price: 0, dmg: 28, rpm: 380, auto: false, mag: 15, reserve: 45, reload: 1.1, pellets: 1, falloff: .9, noise: 30, spread: [.004,.75,.7,.04,.008], kick: [.012,0,.002,1] },
	mako:    { name: 'MAKO .45', cls: 'pistol', price: 700, dmg: 52, rpm: 220, auto: false, mag: 7, reserve: 28, reload: 1.4, pellets: 1, falloff: .88, noise: 34, spread: [.005,.75,1.2,.05,.014], kick: [.022,0,.004,1] },
	hornet:  { name: 'HORNET', cls: 'smg', price: 1250, dmg: 24, rpm: 850, auto: true, mag: 30, reserve: 120, reload: 1.7, pellets: 1, falloff: .78, noise: 34, spread: [.006,.8,.45,.03,.0025], kick: [.005,.08,.005,10] },
	breaker: { name: 'BREAKER', cls: 'shotgun', price: 1100, dmg: 11, rpm: 70, auto: false, mag: 6, reserve: 30, reload: .55, shell: true, pellets: 9, falloff: .6, noise: 42, spread: [.045,.9,.6,.04,0], kick: [.04,0,.004,1] },
	talon:   { name: 'TALON', cls: 'rifle', price: 2700, dmg: 34, rpm: 600, auto: true, mag: 30, reserve: 90, reload: 2.3, pellets: 1, falloff: .9, noise: 46, spread: [.0028,.7,1,.05,.0035], kick: [.0085,.12,.006,9] },
	gavel:   { name: 'GAVEL', cls: 'rifle', price: 3000, dmg: 31, rpm: 660, auto: true, mag: 25, reserve: 75, reload: 2.1, pellets: 1, falloff: .93, noise: 44, spread: [.0024,.7,1,.05,.003], kick: [.0075,.1,.004,9] },
	longbow: { name: 'LONGBOW', cls: 'marksman', price: 4500, dmg: 112, rpm: 40, auto: false, mag: 5, reserve: 20, reload: 3, pellets: 1, falloff: .97, noise: 55, scope: true, zoomFov: [36,14], spread: [.05,.8,2,.08,.02], scopedSpread: .0006, kick: [.05,0,0,1] },
	cutlass: { name: 'CUTLASS', cls: 'knife', price: 0, dmg: 40, backstab: 90, rpm: 100, auto: false, mag: 0, reserve: 0, reload: 0, pellets: 1, falloff: 1, noise: 0, spread: [0,1,0,0,0], kick: [0,0,0,1] },
};

export const GRENADES = {
	shard: { name: 'SHARD',price: 300,max: 1,fuse: 1.6,dmg: 98,radius: 6 },
	veil: { name: 'VEIL',price: 300,max: 1,fuse: 2,dur: 15,radius: 3.2 },
	glare: { name: 'GLARE',price: 200,max: 2,fuse: 1.4,blind: 2.5,range: 40 },
};
export const THROW = { full: 16,lob: 8,up: 2.5,gravity: 15,bounce: .45,cool: .9 };
// Buy menu columns: [title, [[id, key, note]]]. Keys are the digit row (0, - and = included).
export const BUY = [
	['SIDEARM · CLOSE', [['mako', '1', '52 dmg · slow, punishing on the move'], ['hornet', '2', '850 rpm · forgiving while moving'], ['breaker', '3', '9 pellets · shell-by-shell reload']]],
	['RIFLES', [['talon', '4', '34 dmg · strong climb'], ['gavel', '5', '31 dmg · tight, flat spray'], ['longbow', '6', '112 dmg · two-step scope']]],
	['GEAR', [['armor', '7', 'PLATE VEST — absorbs half of body damage'], ['helm', '8', 'PLATE + HELM — vest and head cover'], ['cutters', '9', 'CUTTERS — Bastion, halves the cut']]],
	['UTILITY', [['shard', '0', 'frag · falls off over 6 m'], ['veil', '-', 'smoke · 15 s, blocks sight'], ['glare', '=', 'flash · blinds by view angle']]],
];
export const BUY_KEYS = Object.fromEntries(BUY.flatMap(([, items]) => items.map(([id, key]) => [key, id])));
// Utility lineups: [node, grenade, targetX, targetZ] (Strand smokes for the two site entrances).
export const LINEUPS = [['ConveyorEnd', 'veil', 1,-24], ['CulvertCorner', 'veil', 5,26]];

export const HIT = { head: 4,headHelm: 2.4,chest: 1,stomach: 1,arm: .9,leg: .75 };
export const ARMOR_RATIO = .5;

export const TEAM_LOOK = {
	strand: { cloth: 0xc2b28c, gear: 0x8f7f5a, accent: 0xe8800f, helmet: 0xb7a67c },
	bastion: { cloth: 0x8796a6, gear: 0x55616e, accent: 0x0fb3a0, helmet: 0x6d7a88 },
};


export const INPUT = {
	mouseSens: .0023,pitchMax: 1.55,fov: 78,
};
