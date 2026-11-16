// SALTLINE render.js — renderer, world and viewmodel cameras, interpolated camera placement, resize and pass order:
// world → HDR target, depth cleared, viewmodel on top, then post (bloom + grade) to the screen.
import { WebGLRenderer, Scene, PerspectiveCamera, SRGBColorSpace, NoToneMapping, PCFShadowMap } from 'three';
import { WEAPONS } from './config.js';
import { createPost } from './art/post.js';

export function createRenderer(holder) {
	const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
	renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
	renderer.setSize(innerWidth, innerHeight);
	Object.assign(renderer, { outputColorSpace: SRGBColorSpace, toneMapping: NoToneMapping, autoClear: false });
	renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
	renderer.info.autoReset = false;
	holder.appendChild(renderer.domElement);
	const scene = new Scene(), vmScene = new Scene();
	const camera = new PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 900), vmCamera = new PerspectiveCamera(54, innerWidth / innerHeight, 0.01, 5);
	camera.rotation.order = 'YXZ';
	const post = createPost(renderer);
	addEventListener('resize', () => {
		for (const c of [camera, vmCamera]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
		renderer.setSize(innerWidth, innerHeight); post.resize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
	});
	const setFov = (f) => { if (camera.fov !== f) { camera.fov = f; camera.updateProjectionMatrix(); } };
	return {
		renderer, scene, camera, vmScene, vmCamera,
		// Eye position interpolated between the last two ticks; the camera shows half of the recoil (view punch).
		placeCamera(a, alpha, fov) {
			camera.position.lerpVectors(a.prevPos, a.pos, alpha).y += a.eyeHeight;
			camera.rotation.set(a.pitch + a.recoil.pitch * 0.5, a.yaw + a.recoil.yaw * 0.5, 0);
			const w = WEAPONS[a.weapons[a.active]];
			setFov(a.scoped && w && w.zoomFov ? w.zoomFov[a.scopeLevel - 1] : fov);
		},
		orbit(t) {
			const r = 34, ang = t * 0.04 + 2.2;
			camera.position.set(Math.cos(ang) * r, 15, -12 + Math.sin(ang) * r * 0.7);
			camera.lookAt(0, 1, -10); setFov(62);
		},
		renderFrame(time) {
			renderer.info.reset();
			renderer.setRenderTarget(post.target); renderer.clear();
			renderer.render(scene, camera);
			renderer.clearDepth();
			renderer.render(vmScene, vmCamera);
			post.finish(renderer, time);
		},
	};
}
