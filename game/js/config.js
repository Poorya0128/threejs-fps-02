// Every tunable (PLAN.md §5.1). Metres and seconds.
export const TICK = 1 / 64, MAX_TICKS_PER_FRAME = 5;

export const MOVE = {
	friction: 5.5, stopSpeed: 1.9, accelGround: 10, accelAir: 1.2, gravity: 15, jumpVel: 4.8,
	speed: { pistol: 5.7, smg: 5.6, rifle: 5.1, marksman: 4.6 }, walkMul: .52, crouchMul: .34, scopeMul: .6,
	radius: .32, heightStand: 1.8, heightCrouch: 1.25, eyeStand: 1.62, eyeCrouch: 1.12, crouchTime: .12, stepUp: .4, stepStride: .38,
};
export const ROUND = { buyTime: 12, liveTime: 105, fuseTime: 35, postTime: 5, winRounds: 7, swapAfter: 6, plantTime: 3, defuseTime: 7 };
export const ECON = {
	start: 900, cap: 12000, winElim: 3000, winObjective: 3300, loss: 1500, lossBonus: 400, lossMax: 3100, plant: 300, plantLossBonus: 600,
	kill: { pistol: 250, smg: 550, rifle: 250, marksman: 100 },
};
// Bot skill: reaction time range, aim error (rad per metre), headshot chance, burst length range.
export const BOT = { react: [.2, .38], aimErr: .016, head: .15, burst: [3, 5] };
export const RENDER = {
	exposure: 1.15, fogColor: 0xc4a58f, fogDensity: .0042, skyZenith: 0x3a4f78, horizon: 0xf2b48a, sunDisc: 0xffd2a1,
	sunColor: 0xffc890, sunIntensity: 3.6, sunElevDeg: 15, sunAzimDeg: 280, shadowSize: 4096, shadowBias: -.00025, shadowNormalBias: .035, shadowRadius: 2,
	hemiSky: 0x9ab0d0, hemiGround: 0x9a8070, hemiIntensity: 1.5, bloomThreshold: 1, bloomStrength: .07,
};

// spread: [base, crouch ×, move ×, air, bloom per shot] rad; kick: [pitch, climb per shot, sway, shots until level].
export const WEAPONS = {
	wren: { name: 'WREN', cls: 'pistol', price: 0, dmg: 28, rpm: 380, mag: 15, reserve: 45, reload: 1.1, falloff: .9, noise: 30, spread: [.004, .75, .7, .04, .008], kick: [.012, 0, .002, 1] },
	hornet: { name: 'HORNET', cls: 'smg', price: 1250, dmg: 24, rpm: 850, auto: true, mag: 30, reserve: 120, reload: 1.7, falloff: .78, noise: 34, spread: [.006, .8, .45, .03, .0025], kick: [.005, .08, .005, 10] },
	talon: { name: 'TALON', cls: 'rifle', price: 2700, dmg: 34, rpm: 600, auto: true, mag: 30, reserve: 90, reload: 2.3, falloff: .9, noise: 46, spread: [.0028, .7, 1, .05, .0035], kick: [.0085, .12, .006, 9] },
	gavel: { name: 'GAVEL', cls: 'rifle', price: 3000, dmg: 31, rpm: 660, auto: true, mag: 25, reserve: 75, reload: 2.1, falloff: .93, noise: 44, spread: [.0024, .7, 1, .05, .003], kick: [.0075, .1, .004, 9] },
	longbow: { name: 'LONGBOW', cls: 'marksman', price: 4500, dmg: 112, rpm: 40, mag: 5, reserve: 20, reload: 3, falloff: .97, noise: 55, zoom: [36, 14], spread: [.05, .8, 2, .08, .02], scoped: .0006, kick: [.05, 0, 0, 1] },
};
export const GRENADES = {
	shard: { name: 'SHARD', price: 300, max: 1, fuse: 1.6, dmg: 98, radius: 6 },
	veil: { name: 'VEIL', price: 300, max: 1, fuse: 2, dur: 15, radius: 3.2 },
};
export const GEAR = { armor: ['PLATE VEST', 650], helm: ['PLATE + HELM', 1000] };
export const THROW = { full: 16, lob: 8, up: 2.5, gravity: 15, bounce: .45, cool: .9 };
// Buy menu columns: [title, [[id, key, note]]].
export const BUY = [
	['WEAPONS', [['hornet', '1', '850 rpm · forgiving on the move'], ['talon', '2', '34 dmg · strong climb'], ['gavel', '3', '31 dmg · tight, flat spray'], ['longbow', '4', '112 dmg · two-step scope']]],
	['GEAR · UTILITY', [['armor', '5', 'absorbs half of body damage'], ['helm', '6', 'vest and head cover'], ['shard', '7', 'frag · falls off over 6 m'], ['veil', '8', 'smoke · 15 s, blocks sight']]],
];
export const BUY_KEYS = Object.fromEntries(BUY.flatMap(([, items]) => items.map(([id, key]) => [key, id])));
export const HIT = { head: 4, headHelm: 2.4, chest: 1, stomach: 1, arm: .9, leg: .75 }, ARMOR_RATIO = .5;
export const TEAM_LOOK = {
	strand: { cloth: 0xc2b28c, gear: 0x8f7f5a, accent: 0xe8800f, helmet: 0xb7a67c },
	bastion: { cloth: 0x8796a6, gear: 0x55616e, accent: 0x0fb3a0, helmet: 0x6d7a88 },
};
export const INPUT = { mouseSens: .0023, pitchMax: 1.55, fov: 78 };
