// SALTLINE M0: pipeline smoke test — a lit rotating box on salt ground.
// Proves the import map, the renderer, the sun + shadow map and the frame
// loop. Replaced by the full game boot in M1 (see PLAN.md §15).
import * as THREE from 'three';

// Minimal test contract (AGENTS.md): set ready after the first frame so
// tools can wait for a settled render before screenshotting.
window.__saltline = { ready: false };

const holder = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
holder.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2140);
scene.fog = new THREE.Fog(0x2b2140, 18, 60);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(4.2, 2.6, 6.4);
camera.lookAt(0, 0.9, 0);

// Sun: low warm dusk light from the west, long shadows across the yard.
const sun = new THREE.DirectionalLight(0xffd2a1, 3.2);
sun.position.set(-9, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 30;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 2; // ART.md §3: PCFShadowMap with radius 2–3, no acne
scene.add(sun);

// Sky fill so shadows read blue-grey, never black.
scene.add(new THREE.HemisphereLight(0x8aa6d1, 0xa4886a, 0.35));

// Salt ground: bleached, rough, receives the long shadow.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.95, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// The box: salt-white, slightly warm, catches the sun on its top face.
const box = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 1.6, 1.6),
  new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.8, metalness: 0 }),
);
box.position.y = 0.8;
box.castShadow = true;
box.receiveShadow = true;
scene.add(box);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let firstFrame = true;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);
  box.rotation.y += dt * 0.6;
  box.rotation.x += dt * 0.15;
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    window.__saltline.ready = true;
  }
}
tick();
