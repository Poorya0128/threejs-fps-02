// SALTLINE render.js — renderer, cameras, interpolation, resize, pass
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
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2140);
  scene.fog = new THREE.Fog(RENDER.fogColor, RENDER.fogNear, RENDER.fogFar);

  const camera = new THREE.PerspectiveCamera(INPUT.fov, window.innerWidth / window.innerHeight, 0.1, 600);
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

