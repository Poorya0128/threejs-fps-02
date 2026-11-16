// SALTLINE art/lighting.js — sun, sky fill, image-based light (ART.md §3).
// PMREM environment lifts shadowed faces to blue-grey, never black
// (the M0 failure: hemisphere 0.35 was the only fill).
import * as THREE from 'three';
import { RENDER, PALETTE } from '../config.js';

// Small sky dome: gradient zenith -> horizon + sun disc glow. Used both as
// the visible sky and as the PMREM environment source.
export function buildSkyMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(PALETTE.skyZenith) },
      horizon: { value: new THREE.Color(PALETTE.horizon) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(PALETTE.sun) },
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 zenith, horizon, sunDir, sunColor;
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.55));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 350.0) * 3.0 + pow(s, 24.0) * 0.35);
        col = mix(col, horizon * 0.55, smoothstep(0.0, -0.05, vDir.y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function sunDirection() {
  const el = RENDER.sunElevDeg * Math.PI / 180;
  const az = RENDER.sunAzimDeg * Math.PI / 180;
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

export function buildLighting(renderer, scene, map) {
  const dir = sunDirection();
  const sun = new THREE.DirectionalLight(RENDER.sunColor, RENDER.sunIntensity);
  sun.position.copy(dir).multiplyScalar(90);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RENDER.shadowSize, RENDER.shadowSize);
  // Orthographic shadow camera fitted to the playable bounds in light space.
  const sc = sun.shadow.camera;
  sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75;
  sc.near = 10; sc.far = 220;
  sun.shadow.bias = RENDER.shadowBias;
  sun.shadow.normalBias = RENDER.shadowNormalBias;
  sun.shadow.radius = RENDER.shadowRadius;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(RENDER.hemiSky, RENDER.hemiGround, RENDER.hemiIntensity);
  scene.add(hemi);

  // Sky dome (visible) + PMREM environment (reflections + shadow lift).
  const skyMat = buildSkyMaterial(dir);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), skyMat);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), buildSkyMaterial(dir)));
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = RENDER.envIntensity;
  pmrem.dispose();

  // Interior sodium lights (no shadows) + one visible fixture each (M5 adds
  // the fixture meshes; the light itself is the M1 deliverable).
  const points = [];
  for (const [x, y, z] of map.lights) {
    if (points.length >= RENDER.maxPointLights) break;
    const p = new THREE.PointLight(0xffb062, 22, 14, 2);
    p.position.set(x, y, z);
    scene.add(p); points.push(p);
  }
  // Fake bounce: dim warm lights where sun hits light floors, to lift the
  // walls next to them. Strong enough that shadowed ground reads blue-grey
  // with detail, never black.
  const bounce = [];
  for (const [x, z] of [[-28, -8], [0, 18], [-38, 26]]) {
    const p = new THREE.PointLight(0xffd9a8, 12, 18, 2);
    p.position.set(x, 2.5, z);
    scene.add(p); bounce.push(p);
  }
  // Muzzle-flash light, pooled: always in the scene, intensity 0 when off
  // (adding/removing lights recompiles shaders).
  const flash = new THREE.PointLight(0xffc06a, 0, 12, 2);
  scene.add(flash);

  return { sun, hemi, points, bounce, flash, sky };
}
