// SALTLINE art/lighting.js — sun, sky fill, image-based light (ART.md §3).
import * as THREE from 'three';
import { RENDER, PALETTE } from '../config.js';

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
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.55));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 350.0) * 3.0 + pow(s, 24.0) * 0.35);
        vec2 cuv = vDir.xz / (0.25 + vDir.y);
        float cl = smoothstep(0.55, 0.85, vn(cuv * 1.4)) * smoothstep(0.05, 0.3, vDir.y);
        col = mix(col, vec3(0.92, 0.82, 0.78), cl * 0.4);
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

function mkPoint(scene, color, intensity, dist, x, y, z) {
  const p = new THREE.PointLight(color, intensity, dist, 2);
  p.position.set(x, y, z);
  scene.add(p);
  return p;
}

export function buildLighting(renderer, scene, map) {
  const dir = sunDirection();
  const sun = new THREE.DirectionalLight(RENDER.sunColor, RENDER.sunIntensity);
  sun.position.copy(dir).multiplyScalar(90);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RENDER.shadowSize, RENDER.shadowSize);
  const sc = sun.shadow.camera;
  sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75;
  sc.near = 10; sc.far = 220;
  sun.shadow.bias = RENDER.shadowBias;
  sun.shadow.normalBias = RENDER.shadowNormalBias;
  sun.shadow.radius = RENDER.shadowRadius;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(RENDER.hemiSky, RENDER.hemiGround, RENDER.hemiIntensity);
  scene.add(hemi);

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

  const points = [];
  for (const [x, y, z] of map.lights) {
    if (points.length >= RENDER.maxPointLights) break;
    points.push(mkPoint(scene, 0xffb062, 22, 14, x, y, z));
  }
  const bounce = [];
  for (const [x, z] of [[-28, -8], [0, 18], [-38, 26]]) bounce.push(mkPoint(scene, 0xffd9a8, 12, 18, x, 2.5, z));
  bounce.push(mkPoint(scene, 0xffb062, 10, 10, 14, 2.0, 28.5));
  const flash = new THREE.PointLight(0xffc06a, 0, 12, 2);
  scene.add(flash);

  return { sun, hemi, points, bounce, flash, sky };
}
