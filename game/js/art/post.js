// SALTLINE art/post.js — HDR pipeline (ART.md §2): the world renders into a 4× MSAA half-float target, bloom runs a
// three-level 13-tap downsample / 9-tap tent upsample chain, and the final pass applies exposure, ACES, a warm grade,
// a vignette and fine grain.
import { ShaderMaterial, WebGLRenderTarget, HalfFloatType, Vector2, Scene, OrthographicCamera, Mesh, BufferGeometry, BufferAttribute } from 'three';
import { RENDER } from '../config.js';

const VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const pass = (body, uniforms) => new ShaderMaterial({ uniforms: { tSrc: { value: null }, texel: { value: new Vector2() }, ...uniforms }, vertexShader: VERT, depthTest: false, depthWrite: false,
	fragmentShader: `varying vec2 vUv;uniform sampler2D tSrc,tAdd;uniform vec2 texel;uniform float uK,time;
	vec3 at(float i,float j){return texture2D(tSrc,vUv+texel*vec2(i,j)).rgb;}
	void main(){${body}}` });
// Down: weighted 5×5 pattern, thresholded on the first level. Up: 3×3 tent plus the next finer down level.
const down = pass(`vec3 c=vec3(0);
	for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){int m=abs(i)+abs(j);c+=at(float(i),float(j))*(m==0?4.:m==1?2.:m==2&&(i==0||j==0||abs(i)==1)?1.:0.);}
	gl_FragColor=vec4(max(c*.0625-uK,0.),1.);`, { uK: { value: 0 } });
const up = pass(`vec3 c=vec3(0);
	for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)c+=at(float(i),float(j))*(i==0&&j==0?4.:abs(i)+abs(j)==1?2.:1.);
	gl_FragColor=vec4(c*.0625+uK*texture2D(tAdd,vUv).rgb,1.);`, { tAdd: { value: null }, uK: { value: 0 } });
const grade = pass(`vec3 c=(at(0.,0.)+texture2D(tAdd,vUv).rgb*${RENDER.bloomStrength.toFixed(3)})*uK;
	c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);
	float l=dot(c,vec3(.2126,.7152,.0722));
	c=mix(vec3(l),c,.95);c.r+=.03*l*l;c.b+=.02*(1.-l)*(1.-l);
	vec2 q=vUv-.5;c*=1.-.33*dot(q,q);
	c+=(fract(sin(dot(vUv*913.+fract(time)*7.,vec2(127.1,311.7)))*43758.5453)-.5)*.015;
	gl_FragColor=vec4(c,1.);`, { tAdd: { value: null }, uK: { value: RENDER.exposure }, time: { value: 0 } });

export function createPost(renderer) {
	const size = renderer.getSize(new Vector2()), rt = (w, h, o) => new WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), { type: HalfFloatType, ...o });
	const hdr = rt(size.x, size.y, { samples: 4 }), downs = [0, 1, 2].map((i) => rt(size.x / 2 >> i, size.y / 2 >> i)), ups = [0, 1, 2].map((i) => rt(size.x / 2 >> i, size.y / 2 >> i));
	const scene = new Scene(), cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1), geo = new BufferGeometry(), quad = new Mesh(geo);
	geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)); // one triangle covers the screen
	geo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
	quad.frustumCulled = false; scene.add(quad);
	const draw = (mat, src, target, k, add = null) => {
		const u = mat.uniforms;
		u.tSrc.value = src.texture; u.uK.value = k; if (u.tAdd) u.tAdd.value = add;
		if (target) u.texel.value.set(1 / target.width, 1 / target.height);
		quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam);
	};
	return {
		target: hdr,
		resize(w, h) { hdr.setSize(w, h); for (const a of [downs, ups]) a.forEach((t, i) => t.setSize(Math.max(2, w / 2 >> i), Math.max(2, h / 2 >> i))); },
		finish(renderer, time) {
			for (let i = 0; i < 3; i++) draw(down, i ? downs[i - 1] : hdr, downs[i], i ? 0 : RENDER.bloomThreshold);
			draw(up, downs[2], ups[2], 0, downs[2].texture);
			for (let i = 2; i > 0; i--) draw(up, ups[i], ups[i - 1], 1, downs[i - 1].texture);
			grade.uniforms.time.value = time;
			draw(grade, hdr, null, RENDER.exposure, ups[0].texture);
		},
	};
}
