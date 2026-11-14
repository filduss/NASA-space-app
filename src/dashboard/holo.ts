import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'

// The look of the 3D body: an X-ray hologram. Bones are smooth translucent surfaces lit at
// their silhouette (fresnel rim), with a fine layer of points on top. Everything adds up in an
// HDR buffer, bloom spreads the bright parts, and a hue-preserving tone map keeps orange orange.

/** Shared GLSL: zone level, colours (linear light), pulse and the scan band. */
const COMMON = /* glsl */ `
  uniform vec4 uLevel;
  uniform float uTime;
  uniform float uMotion;
  uniform float uReveal;

  float zoneLevel(float z) {
    return z < 0.5 ? uLevel.x : z < 1.5 ? uLevel.y : z < 2.5 ? uLevel.z : uLevel.w;
  }
  vec3 zoneColor(float lvl) {
    vec3 base = vec3(0.56, 0.74, 1.0);
    vec3 orange = vec3(1.0, 0.58, 0.06);
    vec3 red = vec3(1.0, 0.2, 0.16);
    return pow(lvl < 1.0 ? mix(base, orange, lvl) : mix(orange, red, lvl - 1.0), vec3(2.2));
  }
  /** 0..1 breathing for flagged zones: slow for watch, faster for alert; a wave runs up the bone. */
  float zonePulse(float lvl, float y) {
    float speed = mix(1.6, 3.6, clamp(lvl - 1.0, 0.0, 1.0));
    return 0.5 + 0.5 * sin(uTime * speed * uMotion - y * 7.0);
  }
  float scanBand(float y) {
    float scanY = mod(uTime * 0.28 * uMotion, 2.4) - 0.3;
    return smoothstep(0.05, 0.0, abs(y - scanY));
  }
  /** Height of the reveal front: the body draws itself from the feet up. */
  float revealY() {
    return uReveal * 1.95 - 0.05;
  }
`

const BONE_VERTEX = /* glsl */ `
  ${COMMON}
  attribute float aZone;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  varying float vLvl;
  void main() {
    vLvl = zoneLevel(aZone);
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const BONE_FRAGMENT = /* glsl */ `
  ${COMMON}
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  varying float vLvl;
  void main() {
    float front = revealY();
    if (vPos.y > front) discard;

    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(vView);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float rim = pow(1.0 - ndv, 2.4);
    float key = max(dot(n, normalize(vec3(0.35, 0.75, 0.55))), 0.0);

    float flagged = clamp(vLvl, 0.0, 1.0);
    float pulse = zonePulse(vLvl, vPos.y);
    vec3 col = zoneColor(vLvl);

    float body = 0.01 + 0.03 * key;
    float edge = rim * mix(0.6, 1.0 + 0.7 * pulse, flagged);
    vec3 c = col * (body + edge);
    c += col * scanBand(vPos.y) * 0.5;
    // A bright seam where the body is still drawing itself in.
    c += vec3(0.5, 0.75, 1.0) * smoothstep(0.06, 0.0, front - vPos.y) * step(uReveal, 0.999) * 2.0;
    // Inner (back) faces dimmer, so depth stays readable through the translucent bone.
    c *= gl_FrontFacing ? 1.0 : 0.35;
    gl_FragColor = vec4(c, 1.0);
  }
`

const POINT_VERTEX = /* glsl */ `
  ${COMMON}
  uniform float uSize;
  uniform float uDistance;
  attribute float aZone;
  attribute float aRand;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float lvl = zoneLevel(aZone);
    float flagged = clamp(lvl, 0.0, 1.0);
    float pulse = zonePulse(lvl, position.y);
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.2 * uMotion + aRand * 40.0);
    vColor = zoneColor(lvl) * (mix(twinkle, 0.8 + 0.6 * pulse, flagged) + scanBand(position.y) * 1.5);
    vAlpha = position.y > revealY() ? 0.0 : mix(0.07, 0.09, flagged);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Softer than true perspective, so the dust stays fine when the camera zooms onto a zone.
    gl_PointSize = uSize * (0.7 + 0.6 * fract(aRand * 7.31)) * pow(uDistance / -mv.z, 0.6);
  }
`

const POINT_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.15, d) * vAlpha);
  }
`

export interface HoloUniforms {
  [name: string]: THREE.IUniform
  uLevel: { value: THREE.Vector4 }
  uTime: { value: number }
  uMotion: { value: number }
  uReveal: { value: number }
  uSize: { value: number }
  uDistance: { value: number }
}

export function holoUniforms(motion: boolean, distance: number): HoloUniforms {
  return {
    uLevel: { value: new THREE.Vector4() },
    uTime: { value: 0 },
    uMotion: { value: motion ? 1 : 0 },
    uReveal: { value: 0 },
    uSize: { value: 1 },
    uDistance: { value: distance },
  }
}

export function boneMaterial(uniforms: HoloUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: BONE_VERTEX,
    fragmentShader: BONE_FRAGMENT,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

export function pointMaterial(uniforms: HoloUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function area(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute('position')
  const idx = g.getIndex()!
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const t = new THREE.Triangle()
  let sum = 0
  for (let i = 0; i < idx.count; i += 3) {
    t.set(a.fromBufferAttribute(pos, idx.getX(i)), b.fromBufferAttribute(pos, idx.getX(i + 1)), c.fromBufferAttribute(pos, idx.getX(i + 2)))
    sum += t.getArea()
  }
  return sum
}

/** Point dust over the bone surfaces, spread by area. `bones` are world-space geometries. */
export function sampleDust(bones: { geometry: THREE.BufferGeometry; zone: number }[], total: number, minPerBone: number): THREE.BufferGeometry {
  const areas = bones.map((b) => area(b.geometry))
  const sum = areas.reduce((s, x) => s + x, 0)
  const counts = areas.map((x) => Math.max(minPerBone, Math.round((total * x) / sum)))
  const n = counts.reduce((s, x) => s + x, 0)
  const positions = new Float32Array(n * 3)
  const zones = new Float32Array(n)
  const rands = new Float32Array(n)
  const p = new THREE.Vector3()
  let k = 0
  bones.forEach((b, i) => {
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(b.geometry)).build()
    for (let j = 0; j < counts[i]; j++, k++) {
      sampler.sample(p)
      positions[k * 3] = p.x
      positions[k * 3 + 1] = p.y
      positions[k * 3 + 2] = p.z
      zones[k] = b.zone
      rands[k] = Math.random() * 10
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('aZone', new THREE.BufferAttribute(zones, 1))
  g.setAttribute('aRand', new THREE.BufferAttribute(rands, 1))
  return g
}

/**
 * Final pass: hue-preserving tone map. Below the knee nothing changes (background, dim
 * surfaces); above it brightness rolls off smoothly, and only the hottest cores drift a little
 * toward white, like a real glow.
 */
export const ToneMapShader = {
  name: 'HueToneMap',
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float m = max(c.r, max(c.g, c.b));
      const float k = 0.6;
      float t = m < k ? m : k + (1.0 - k) * (1.0 - exp(-(m - k) / (1.0 - k)));
      vec3 mapped = m > 0.0 ? c * (t / m) : c;
      mapped = mix(mapped, vec3(t), smoothstep(3.0, 12.0, m) * 0.35);
      gl_FragColor = vec4(mapped, 1.0);
      #include <colorspace_fragment>
    }
  `,
}

export function platform(): THREE.Group {
  const group = new THREE.Group()
  const mat = (opacity: number) =>
    new THREE.MeshBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const rings: [number, number, number][] = [
    [0.36, 0.364, 0.4],
    [0.5, 0.502, 0.2],
    [0.66, 0.661, 0.12],
  ]
  for (const [r0, r1, o] of rings) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 192), mat(o))
    m.rotation.x = -Math.PI / 2
    group.add(m)
  }
  // Tick marks on the inner ring, like a dial.
  const ticks = new THREE.Group()
  for (let i = 0; i < 120; i++) {
    const major = i % 10 === 0
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.0025, major ? 0.04 : 0.018), mat(major ? 0.55 : 0.22))
    const a = (i / 120) * Math.PI * 2
    t.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42)
    t.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2)
    ticks.add(t)
  }
  group.add(ticks)
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 96),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float d = distance(vUv, vec2(0.5)); gl_FragColor = vec4(0.12,0.24,0.75, smoothstep(0.5,0.0,d)*0.3); }',
    }),
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.y = -0.002
  group.add(glow)
  group.userData.ticks = ticks
  return group
}

/** A soft blue glow behind the body. A sprite always faces the camera, so it survives orbiting. */
export function backdropSprite(): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256)
  grad.addColorStop(0, 'rgba(46, 72, 140, 0.5)')
  grad.addColorStop(0.45, 'rgba(30, 44, 96, 0.2)')
  grad.addColorStop(1, 'rgba(6, 7, 11, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }))
  sprite.scale.set(2.6, 2.6, 1)
  sprite.position.set(0, 0.95, -0.3)
  sprite.renderOrder = -1
  return sprite
}
