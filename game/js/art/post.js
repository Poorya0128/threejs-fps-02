// SALTLINE art/post.js — HDR pipeline (ART.md §2). The renderer itself does
// no tone mapping: world -> HDR target (HalfFloat, MSAA) -> bloom -> one
// final fullscreen pass (exposure, ACES, grade, vignette, grain) -> screen.
import * as THREE from 'three';
import { RENDER } from '../config.js';

const ACES = `
vec3 aces(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}`;

function quadMaterial(frag, uniforms) {
  return new THREE.ShaderMaterial({ uniforms, vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: frag, depthTest: false, depthWrite: false });
}

export function createPost(renderer) {
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const w = Math.max(2, size.x | 0), h = Math.max(2, size.y | 0);

  // Note: no depthTexture here — a multisampled (samples>0) target cannot
  // also carry a depth texture in WebGL2, and the render comes out black.
  // SSAO (which needs depth) gets its own depth-only target in M5.
  const hdr = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, samples: 4,
  });
  // Bloom chain at half resolution: 3 mip levels, 13-tap down / 9-tap tent up.
  // Down writes blooms[]; up writes a separate up[] chain (never render into
  // a target while sampling it — that is a GL feedback loop).
  const bw = w >> 1, bh = h >> 1;
  const blooms = [], ups = [];
  for (let i = 0; i < 3; i++) {
    blooms.push(new THREE.WebGLRenderTarget(Math.max(2, bw >> i), Math.max(2, bh >> i), { type: THREE.HalfFloatType }));
    ups.push(new THREE.WebGLRenderTarget(Math.max(2, bw >> i), Math.max(2, bh >> i), { type: THREE.HalfFloatType }));
  }
  const downMat = quadMaterial(`
    varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 texel;
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb * 0.25;
      c += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2( 1.0, -1.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2(-1.0,  1.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2( 1.0,  1.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2(-2.0, 0.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2( 2.0, 0.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2(0.0, -2.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2(0.0,  2.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2(-1.0, 0.0)).rgb * 0.125;
      c += texture2D(tSrc, vUv + texel * vec2( 1.0, 0.0)).rgb * 0.125;
      c += texture2D(tSrc, vUv + texel * vec2(0.0, -1.0)).rgb * 0.125;
      c += texture2D(tSrc, vUv + texel * vec2(0.0,  1.0)).rgb * 0.125;
      gl_FragColor = vec4(c, 1.0);
    }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
  const upMat = quadMaterial(`
    varying vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 texel; uniform float uHasAdd;
    void main(){
      vec3 c = vec3(0.0);
      c += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2( 1.0, -1.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2(-1.0,  1.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2( 1.0,  1.0)).rgb * 0.0625;
      c += texture2D(tSrc, vUv + texel * vec2(-1.0, 0.0)).rgb * 0.125;
      c += texture2D(tSrc, vUv + texel * vec2( 1.0, 0.0)).rgb * 0.125;
      c += texture2D(tSrc, vUv + texel * vec2(0.0, -1.0)).rgb * 0.125;
      c += texture2D(tSrc, vUv + texel * vec2(0.0,  1.0)).rgb * 0.125;
      c += texture2D(tSrc, vUv).rgb * 0.25;
      if (uHasAdd > 0.5) c += texture2D(tAdd, vUv).rgb;
      gl_FragColor = vec4(c, 1.0);
    }`, { tSrc: { value: null }, tAdd: { value: null }, texel: { value: new THREE.Vector2() }, uHasAdd: { value: 0 } });
  const finalMat = quadMaterial(`
    varying vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tBloom;
    uniform float exposure, time;
    ${ACES}
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb;
      c += texture2D(tBloom, vUv).rgb * ${RENDER.bloomStrength.toFixed(3)};
      c *= exposure;
      c = aces(c);
      // Grade: warm highlights, cool shadows, saturation 0.95.
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 0.95);
      c.r += 0.03 * l * l; c.b += 0.02 * (1.0 - l) * (1.0 - l);
      // Vignette 0.15 + faint animated grain 0.015.
      vec2 q = vUv - 0.5;
      c *= 1.0 - 0.15 * dot(q, q) * 2.2;
      c += (hash(vUv * 913.0 + fract(time) * 7.0) - 0.5) * 0.015;
      gl_FragColor = vec4(c, 1.0);
    }`, {
    tSrc: { value: null }, tBloom: { value: null },
    exposure: { value: RENDER.exposure }, time: { value: 0 },
  });

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.BufferGeometry();
  quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  quadGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const quad = new THREE.Mesh(quadGeo, finalMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  function renderBloom(renderer, src) {
    // Threshold is implicit: only HDR values above ~1.0 survive the first
    // downsample strongly; the chain blurs the bright tail into the bloom.
    let cur = src;
    for (let i = 0; i < blooms.length; i++) {
      downMat.uniforms.tSrc.value = cur.texture;
      const t = blooms[i];
      downMat.uniforms.texel.value.set(1 / t.width, 1 / t.height);
      quad.material = downMat;
      renderer.setRenderTarget(t);
      renderer.render(quadScene, quadCam);
      cur = t;
    }
    // Upsample smallest level into ups[2] (no add), then up the chain,
    // adding the matching bloom level at each step.
    upMat.uniforms.uHasAdd.value = 0;
    upMat.uniforms.tSrc.value = blooms[2].texture;
    upMat.uniforms.texel.value.set(1 / ups[2].width, 1 / ups[2].height);
    quad.material = upMat;
    renderer.setRenderTarget(ups[2]);
    renderer.render(quadScene, quadCam);
    upMat.uniforms.uHasAdd.value = 1;
    for (let i = 2; i > 0; i--) {
      upMat.uniforms.tSrc.value = ups[i].texture;
      upMat.uniforms.tAdd.value = blooms[i - 1].texture;
      const t = ups[i - 1];
      upMat.uniforms.texel.value.set(1 / t.width, 1 / t.height);
      quad.material = upMat;
      renderer.setRenderTarget(t);
      renderer.render(quadScene, quadCam);
    }
    return ups[0].texture;
  }

  return {
    target: hdr,
    resize(w2, h2) {
      hdr.setSize(w2, h2);
      for (let i = 0; i < blooms.length; i++) {
        blooms[i].setSize(Math.max(2, (w2 >> 1) >> i), Math.max(2, (h2 >> 1) >> i));
        ups[i].setSize(Math.max(2, (w2 >> 1) >> i), Math.max(2, (h2 >> 1) >> i));
      }
    },
    finish(renderer, time) {
      const bloomTex = renderBloom(renderer, hdr);
      finalMat.uniforms.tSrc.value = hdr.texture;
      finalMat.uniforms.tBloom.value = bloomTex;
      finalMat.uniforms.time.value = time;
      quad.material = finalMat;
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    },
  };
}
