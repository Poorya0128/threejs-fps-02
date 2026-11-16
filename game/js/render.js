// SALTLINE render.js — renderer, cameras, interpolation, resize, pass
// order (PLAN.md §5.2). Render reads state, never writes it.
import * as THREE from 'three';
import { INPUT, RENDER } from './config.js';
import { createPost } from './art/post.js';

export function createRenderer(holder) {
  const renderer = new THREE.WebGLRenderer({
    antialias: false, powerPreference: 'high-performance', stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // tone mapping in post.js
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // No auto-clear: renderFrame() renders the world and then the viewmodel
  // into the same HDR target, and an auto-clear on the second render would
  // wipe the world. Clears are explicit in renderFrame().
  renderer.autoClear = false;
  // Stats must cover the whole frame (world + viewmodel + post): don't let
  // info auto-reset after each render() call; renderFrame() resets once.
  renderer.info.autoReset = false;
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2140);
  // Fog must blend distant ground into the sky colour (ART.md §13): a
  // dusty rose between the peach horizon and the ground, not dark violet.
  scene.fog = new THREE.Fog(RENDER.fogColor, RENDER.fogNear, RENDER.fogFar);

  const camera = new THREE.PerspectiveCamera(INPUT.fov, window.innerWidth / window.innerHeight, 0.1, 600);
  // Viewmodel scene (M2+): own camera, rendered into the same HDR target.
  const vmScene = new THREE.Scene();
  const vmCamera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.01, 4);

  const post = createPost(renderer);
  const api = {
    renderer, scene, camera, vmScene, vmCamera, post,
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      vmCamera.aspect = w / h; vmCamera.updateProjectionMatrix();
      renderer.setSize(w, h);
      post.resize(w, h);
    },
    // Position the eye camera from interpolated agent state. Scope zooms
    // the FOV (Longbow: 40° / 15°); the camera shows ~50 % of the aim
    // punch as view kick (PLAN.md §7).
    placeCamera(agent, alpha) {
      const x = agent.prevPos.x + (agent.pos.x - agent.prevPos.x) * alpha;
      const y = agent.prevPos.y + (agent.pos.y - agent.prevPos.y) * alpha;
      const z = agent.prevPos.z + (agent.pos.z - agent.prevPos.z) * alpha;
      camera.position.set(x, y + agent.eyeHeight, z);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(agent.yaw + agent.recoil.yaw * 0.5);
      camera.rotateX(agent.pitch + agent.recoil.pitch * 0.5);
      const w = agent.weapons.length ? agent.weapons[agent.active] : '';
      let fov = INPUT.fov;
      if (agent.scoped && w === 'longbow') fov = agent.scopeLevel === 2 ? 15 : 40;
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    // One frame: world into HDR target, viewmodel into the same target,
    // then the post chain to the screen.
    renderFrame(time) {
      renderer.info.reset();
      renderer.setRenderTarget(post.target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(vmScene, vmCamera);
      post.finish(renderer, time);
    },
  };
  window.addEventListener('resize', () => api.resize());
  return api;
}

