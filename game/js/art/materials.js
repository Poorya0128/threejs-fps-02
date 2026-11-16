// Procedural PBR (ART.md §5): GLSL patterns, roughness, bump, edge wear, dirt and rime in MeshStandardMaterial.
import { MeshStandardMaterial, Color, Vector4 } from 'three';

const GLSL = /* glsl */`
varying vec3 vP,vW,vN;varying float vE;
uniform float uPat;uniform vec3 uC2;uniform vec4 uK,uL;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
	return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
	mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+1.),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n3(p);p=p*2.03+1.7;a*=.5;}return s;}
float vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
	for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),o=vec2(h3(vec3(i+g,1.)),h3(vec3(i+g,7.)));
	float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return d2-d1;}
float aline(float d,float w){float fw=max(fwidth(d),1e-4);return (1.-smoothstep(w-fw,w+fw,d))*min(1.,2.*w/fw);}
float grid(vec2 q,vec2 s,float w){vec2 g=fract(q/s);vec2 e=min(g,1.-g)*s;return max(aline(e.x,w),aline(e.y,w));}
void surface(out vec3 c,out float r,out float h,out float mt){
	vec3 an=abs(vN);bool top=an.y>an.x&&an.y>an.z;
	vec2 q=top?vP.xz:an.x>an.z?vP.zy:vP.xy;
	vec3 p=vP*uK.x;float n=fbm(p*1.7),lo=fbm(vW*.07+3.),f=n3(p*9.);
	c=diffuse*(1.+uK.y*(n-.5)*2.)*(.88+.24*lo);r=mix(uK.z,uK.w,n);h=n*.4+f*.2;mt=1.;
	int P=int(uPat+.5);
	if(P==0){float s=grid(q,vec2(2.4,1.2),.012)*(top?.35:1.);vec2 t=abs(fract(q/.6)-.5)*.6;float o=aline(length(t),.016)*(1.-s);
	c*=1.-.3*s-.45*o;h-=s*.6+o*.8;c*=1.-.12*smoothstep(.5,.9,fbm(vec3(q.x*5.,q.y*.35,4.)));}
	else if(P==1){vec2 b=q/vec2(.24,.075);b.x+=floor(b.y)*.5;float m=grid(b,vec2(1.),.06),pe=smoothstep(.63,.67,fbm(p*.7+7.));
	vec3 br=uC2*(.75+.5*h3(vec3(floor(b),1.)))*(1.-.55*m);c=mix(c,br,pe);h=mix(h*.4,.5-m*.6,pe);
	c*=1.-.16*smoothstep(.45,.85,fbm(vec3(q.x*4.,q.y*.25,2.)));r=mix(r,.9,pe);}
	else if(P==2){float b=n3(vec3(q.x*3.,q.y*90.,0.)),ru=smoothstep(.58,.78,fbm(p*.7+2.));
	c=mix(c*(.9+.2*b),uC2*(.6+.7*f),ru);r=mix(r,.92,ru);mt=1.-ru;h+=ru*f*.7+b*.05;}
	else if(P==3){float w=top?0.:sin(q.x*41.9),s=smoothstep(.45,.85,fbm(vec3(q.x*2.5,q.y*.22,5.)));
	h=w*.55+f*.15;c*=.9+.1*w;c=mix(c,uC2,s*.7);r=mix(r,.95,s);mt=1.-s*.9;
	float ch=smoothstep(.62,.7,fbm(p*1.5+9.));c=mix(c,vec3(.42,.4,.37),ch*.8);r=mix(r,.6,ch);}
	else if(P==4){float v=q.y/.145,id=floor(v),g=aline(min(fract(v),1.-fract(v))*.145,.006);
	float gr=fbm(vec3(q.x*.9+id*3.1,q.y*24.,id));c*=(.72+.4*h3(vec3(id,2.,3.)))*(.78+.38*gr)*(1.-.55*g);h=gr*.3-g*.8;}
	else if(P==5){float s=step(.5,fract((q.x+q.y)*1.6)),ch=smoothstep(.58,.68,fbm(p*2.2));
	c=mix(mix(c,uC2,s),vec3(.5,.48,.45),ch*.75);r=mix(r,.9,ch);h-=ch*.3;}
	else if(P==6){float cr=aline(vor(vW.xz*.32),.03)*smoothstep(.45,.6,lo),wet=smoothstep(.64,.7,fbm(vW*.12+1.));
	c*=(.82+.34*f)*(1.-.5*cr)*(1.-.4*wet);h=mix(f*.6-cr,0.,wet);r=mix(r,.06,wet);}
	else if(P==7){float v=vor(vW.xz*2.6)+.35*n,rg=aline(v,.025)*.6;c*=(.9+.12*f)*(1.-.08*smoothstep(.25,.0,v))*(.92+.1*fbm(vW*.3));
	c=mix(c,vec3(.97,.96,.94),rg*.5);h=rg*.9+f*.35;r=mix(r,.3,step(.94,n3(vW*55.)));}
	else if(P==8){float w=sin(q.x*300.)*sin(q.y*300.);h=w*.15+n*.4;c*=.94+.06*w;}
	else if(P==9){h=f*.5;r+=.1*f;}
	else if(P==10){vec2 b=q/vec2(.4,.2);b.x+=floor(b.y)*.5;float m=grid(b,vec2(1.),.025);
	c*=(.88+.24*h3(vec3(floor(b),4.)))*(1.-.35*m);h=h*.4-m*.7;}
	else if(P==11){float k=smoothstep(.66,.74,fbm(vW*.7)+.2*f);c=mix(c*(.92+.1*n),uC2*(.94+.06*f),k);
	r=mix(.05,.75,k);h=k*(.4+f*.4);}
	else{if(vE>2.5){r=.45;mt=0.;}else if(vE>1.5){r=.38+.2*n;}else if(vE>.5){r=.62+.2*f;mt=0.;h=f*.4;}else{float w=sin(q.x*380.)*sin(q.y*380.);h=w*.12+n*.3;r=.88;mt=0.;}}
	if(P<12){float side=1.-an.y,y=vW.y;
	float d=(1.-smoothstep(0.,1.5,y))*smoothstep(.3,.7,fbm(vW*.8+5.))*uL.y*side;c*=1.-.5*d;r=min(1.,r+.2*d);
	float rm=uL.z*(1.-smoothstep(.05,.45+.35*n,y))*side;c=mix(c,vec3(.92,.91,.87),rm*.85);r=mix(r,.95,rm);h+=rm*f*.6;
	float we=uL.w*vE*smoothstep(.3,.55,fbm(vP*7.));c=mix(c,c*1.4+.05,we);r*=1.-.3*we;}
	r=clamp(r,.05,1.);
}`;
const BUMP = `{vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);float hx=dFdx(ph),hy=dFdy(ph);
	vec3 r1=cross(dy,normal),r2=cross(normal,dx);float dt=dot(dx,r1);
	normal=normalize(abs(dt)*normal-sign(dt)*(hx*r1+hy*r2)*uL.x/(1.+length(vViewPosition)*.06));}`;
// Characters (pattern 12; uL = bump, rim, accent glow, hit flash): fresnel rim, glowing accents, hit flash.
const GLOW = `if(int(uPat+.5)==12)totalEmissiveRadiance+=diffuseColor.rgb*step(2.5,vE)*uL.z+vec3(1.,.4,.3)*uL.w
	+vec3(1.,.92,.82)*pow(1.-abs(dot(normal,normalize(vViewPosition))),3.)*uL.y*(.35+.65*diffuseColor.rgb);`;

// o: { c, c2, pat, scale, cvar, r0, r1, bump, dirt, rime, wear, metal, env } in uniforms, so all share one program.
export function procMaterial(o) {
	const m = new MeshStandardMaterial({ color: o.c, metalness: o.metal ?? 0, roughness: 1, vertexColors: true, envMapIntensity: o.env ?? 1 });
	const u = m.userData.u = {
		uPat: { value: o.pat ?? 9 }, uC2: { value: new Color(o.c2 ?? 0) },
		uK: { value: new Vector4(o.scale ?? 1, o.cvar ?? .08, o.r0 ?? .6, o.r1 ?? .9) },
		uL: { value: new Vector4(o.bump ?? .02, o.dirt ?? 0, o.rime ?? 0, o.wear ?? 0) },
	};
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, u);
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vP,vW,vN;varying float vE;attribute float aE;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP=position;vN=normal;vE=aE;')
			.replace('#include <project_vertex>', '#include <project_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', `#include <common>\n${GLSL}`)
			.replace('#include <map_fragment>', '#include <map_fragment>\nvec3 pc;float pr,ph,pm;surface(pc,pr,ph,pm);diffuseColor.rgb=pc;')
			.replace('#include <roughnessmap_fragment>', 'float roughnessFactor=pr;')
			.replace('#include <metalnessmap_fragment>', 'float metalnessFactor=metalness*pm;')
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${BUMP}`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${GLOW}`);
	};
	m.customProgramCacheKey = () => 'saltline-proc';
	return m;
}

// World presets by map material id. pat: 0 formwork concrete, 1 plaster over brick, 2 metal, 3 corrugated, 4 planks,
// 5 hazard, 6 asphalt, 7 salt crust, 8 cloth, 9 polymer, 10 block masonry, 11 brine, 12 character.
const tin = (c, c2, o) => ({ c, c2, pat: 3, scale: .7, r0: .5, r1: .75, metal: .15, bump: .04, dirt: .6, rime: .5, wear: 1, ...o });
export const WORLD = [
	{ c: 0xb9b2a4, pat: 0, scale: .6, cvar: .1, r0: .75, r1: .95, bump: .025, dirt: 1, rime: 1, wear: .6 },
	{ c: 0xd8d2c4, pat: 10, scale: .8, r0: .8, r1: .95, dirt: .7, rime: 1, wear: .5 },
	{ c: 0x62676d, c2: 0x7a4a2c, pat: 2, scale: .9, r0: .45, r1: .7, metal: .35, bump: .01, dirt: .4, wear: 1 },
	tin(0x9a4430, 0x5a2c1a), tin(0x3b7f78, 0x6b3a22),
	{ c: 0xe39a2e, c2: 0x1c1c1e, pat: 5, r0: .5, r1: .7, dirt: .8, wear: .8 },
	{ c: 0x9a7650, pat: 4, scale: 1.2, cvar: .12, r0: .7, bump: .03, dirt: .5, wear: .8 },
	tin(0x4a4744, 0x6b3a22, { scale: .6, r0: .6, r1: .85, metal: .2, bump: .03, dirt: 0, rime: 0, wear: 0 }),
	{ c: 0xcdbfa8, c2: 0x8a6250, pat: 1, scale: .5, cvar: .1, r0: .8, r1: .95, bump: .025, dirt: 1, rime: .8, wear: .5 },
	{ c: 0xb4b8ba, c2: 0x7a4a2c, pat: 2, scale: .8, r0: .35, r1: .55, metal: .55, bump: .01, dirt: .5, rime: .4, wear: 1 },
	tin(0x4a6278, 0x5a2c1a), tin(0xa3a6a6, 0x7a4a2c, { r0: .4, r1: .6, metal: .45, bump: .035, dirt: .7, rime: .6 }),
];
// Floors: asphalt, concrete, salt gravel, brine, wet concrete.
export const GROUND = [
	{ c: 0x76716a, pat: 6, scale: 1.4, cvar: .1, r0: .75, r1: .95, bump: .03 },
	{ c: 0x9d978c, pat: 0, scale: .6, cvar: .12, r0: .7, r1: .92 },
	{ c: 0xd9d1c4, pat: 7, scale: 1.5, cvar: .06, r0: .75, r1: .95, bump: .04 },
	{ c: 0x9c8682, c2: 0xece7de, pat: 11, cvar: .06, bump: .015 },
	{ c: 0x6e6c66, pat: 6, scale: 1.2, cvar: .1, r0: .25, r1: .6, bump: .025 },
];
