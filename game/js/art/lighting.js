// SALTLINE art/lighting.js — dusk sun with a fitted 4096² shadow map, sky fill, sky dome and image-based light
// from a PMREM of that sky (ART.md §3, §8). Point lights for interiors are placed by geo.js from map props.
import { ShaderMaterial, BackSide, Color, Vector3, Mesh, SphereGeometry, CircleGeometry, MeshBasicMaterial, DirectionalLight,
	HemisphereLight, PointLight, PMREMGenerator, Scene, FogExp2 } from 'three';
import { RENDER, PALETTE } from '../config.js';

// Sky: elevation gradient, warm sun-side haze, Mie glow, sun disc (HDR, for bloom) and thin FBM cirrus.
export function skyMaterial(sunDir) {
	return new ShaderMaterial({
		side: BackSide, depthWrite: false, fog: false,
		uniforms: { zen: { value: new Color(PALETTE.skyZenith) }, hor: { value: new Color(PALETTE.horizon) }, sun: { value: sunDir }, sc: { value: new Color(PALETTE.sun) } },
		vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
		fragmentShader: `varying vec3 vD;uniform vec3 zen,hor,sun,sc;
	float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
	float n(vec2 p){vec2 i=floor(p),f=fract(p);f*=f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
	void main(){
	vec3 d=normalize(vD);float y=d.y,s=max(dot(d,sun),0.);
	vec3 c=mix(hor,zen,pow(clamp(y,0.,1.),.45));
	c=mix(c,hor*vec3(1.15,.92,.82),(1.-smoothstep(0.,.35,y))*pow(s,2.)*.8);
	c+=sc*(pow(s,6.)*.28+pow(s,60.)*.7+smoothstep(.9994,.9997,s)*30.);
	vec2 q=d.xz/(y+.25)*.9+vec2(3.,1.);float cl=0.,a=.5;
	for (int k=0;k<5;k++){cl+=n(q)*a;q=q*2.03+1.3;a*=.5;}
	cl=smoothstep(.5,.78,cl)*smoothstep(.03,.3,y);
	c=mix(c,mix(vec3(.85,.62,.58),sc*1.4,pow(s,3.)),cl*.55);
	c=mix(c,hor*.42,smoothstep(.0,-.08,y));
	gl_FragColor=vec4(c,1.);
	}`,
	});
}

export function sunDirection() {
	const el = RENDER.sunElevDeg * Math.PI / 180, az = RENDER.sunAzimDeg * Math.PI / 180;
	return new Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

export function buildLighting(renderer, scene) {
	const dir = sunDirection();
	const sun = new DirectionalLight(RENDER.sunColor, RENDER.sunIntensity);
	sun.position.copy(dir).multiplyScalar(120);
	sun.castShadow = true;
	sun.shadow.mapSize.set(RENDER.shadowSize, RENDER.shadowSize);
	Object.assign(sun.shadow.camera, { left: -66, right: 66, top: 60, bottom: -60, near: 40, far: 240 });
	sun.shadow.bias = RENDER.shadowBias; sun.shadow.normalBias = RENDER.shadowNormalBias; sun.shadow.radius = RENDER.shadowRadius;
	scene.add(sun, sun.target);
	scene.add(new HemisphereLight(RENDER.hemiSky, RENDER.hemiGround, RENDER.hemiIntensity));
	scene.fog = new FogExp2(RENDER.fogColor, RENDER.fogDensity);
	scene.add(new Mesh(new SphereGeometry(450, 32, 16), skyMaterial(dir)));
	const env = new Scene(), pm = new PMREMGenerator(renderer);
	env.add(new Mesh(new SphereGeometry(50, 32, 16), skyMaterial(dir)));
	const floor = new Mesh(new CircleGeometry(60, 24), new MeshBasicMaterial({ color: 0x5c5048 }));
	floor.rotation.x = -Math.PI / 2; floor.position.y = -2; env.add(floor);
	scene.environment = pm.fromScene(env, 0.03).texture;
	scene.environmentIntensity = RENDER.envIntensity;
	pm.dispose();
	const flash = new PointLight(0xffc06a, 0, 12, 2);
	scene.add(flash);
	return { sun, flash, dir };
}
