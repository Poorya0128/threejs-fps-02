// Renderer, cameras and passes: world into the HDR target, viewmodel on top, then post.
import { WebGLRenderer, Scene, PerspectiveCamera, SRGBColorSpace, NoToneMapping, PCFShadowMap } from 'three';
import { WEAPONS } from './config.js';
import { createPost } from './art/post.js';

export function createRenderer(holder) {
	const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false }), aspect = () => innerWidth / innerHeight;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
	renderer.setSize(innerWidth, innerHeight);
	Object.assign(renderer, { outputColorSpace: SRGBColorSpace, toneMapping: NoToneMapping, autoClear: false });
	renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap; renderer.info.autoReset = false;
	holder.appendChild(renderer.domElement);
	const scene = new Scene(), vmScene = new Scene(), post = createPost(renderer), camera = new PerspectiveCamera(80, aspect(), .05, 900), vmCamera = new PerspectiveCamera(54, aspect(), .01, 5);
	camera.rotation.order = 'YXZ';
	addEventListener('resize', () => {
		for (const c of [camera, vmCamera]) { c.aspect = aspect(); c.updateProjectionMatrix(); }
		renderer.setSize(innerWidth, innerHeight); post.resize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
	});
	const setFov = (f) => { if (camera.fov !== f) { camera.fov = f; camera.updateProjectionMatrix(); } };
	return {
		renderer, scene, camera, vmScene,
		placeCamera(a, alpha, fov) {
			camera.position.lerpVectors(a.prevPos, a.pos, alpha).y += a.eyeHeight;
			camera.rotation.set(a.pitch + a.recoil.pitch * .5, a.yaw + a.recoil.yaw * .5, 0);
			const zoom = WEAPONS[a.weapons[a.active]]?.zoom;
			setFov(a.scoped && zoom ? zoom[a.scopeLevel - 1] : fov);
		},
		orbit(t) {
			const ang = t * .04 + 2.2;
			camera.position.set(Math.cos(ang) * 34, 15, Math.sin(ang) * 24 - 12); camera.lookAt(0, 1, -10); setFov(62);
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
