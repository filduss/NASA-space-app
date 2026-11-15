import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { backdropSprite, boneMaterial, holoUniforms, platform, pointMaterial, sampleDust, ToneMapShader } from './holo.ts'
import { ZONES, ZONE_OF_BONE, type Level, type ZoneKey, type ZoneState } from './model.ts'
import { prepareBone } from './subdivide.ts'

// The skeleton as an X-ray hologram. Each bone is tagged with its body zone, so the shaders
// tint and pulse a whole zone orange or red from four uniforms.

const ZONE_INDEX: Record<ZoneKey, number> = { head: 0, chest: 1, core: 2, limbs: 3 }
const LEVEL_VALUE: Record<Level, number> = { ok: 0, watch: 1, alert: 2 }
const DUST_POINTS = 160_000
const DUST_MIN_PER_BONE = 600
/** Dust point diameter in CSS pixels at the whole-body framing distance. */
const POINT_PX = 1.1
/** Render budget: never more device pixels than a 4K frame (3840 x 2160). */
const MAX_RENDER_PIXELS = 3840 * 2160
const STAGE_BG = 0x06070b

/** Camera framing: whole body, or close on one zone. [target y, distance] */
const FRAMING: Record<ZoneKey | 'body', [number, number]> = {
  body: [0.9, 4.1],
  head: [1.56, 1.25],
  chest: [1.28, 1.6],
  core: [1.0, 1.6],
  limbs: [0.75, 3.0],
}

/**
 * Supersampled pixel ratio: at least 2x even on a 1x screen, so thin rims and dust stay crisp
 * after the browser scales the canvas down, capped by the 4K budget. `scale` drops below 1 only
 * when the machine cannot hold the frame rate.
 */
function renderRatio(w: number, h: number, scale: number): number {
  const wanted = Math.min(Math.max(window.devicePixelRatio * 1.5, 2), 3) * scale
  const budget = Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, w * h))
  return Math.max(1, Math.min(wanted, budget))
}

/** Bones from the GLB, smoothed, in world space, each tagged with its zone. */
function prepareSkeleton(root: THREE.Object3D): { bones: THREE.BufferGeometry; dust: THREE.BufferGeometry } {
  root.updateMatrixWorld(true)
  const parts: { geometry: THREE.BufferGeometry; zone: number }[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || ZONE_OF_BONE[m.name] === undefined) return
    const geometry = prepareBone(m)
    const zone = ZONE_INDEX[ZONE_OF_BONE[m.name]]
    geometry.setAttribute('aZone', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(zone), 1))
    parts.push({ geometry, zone })
  })
  const dust = sampleDust(parts, DUST_POINTS, DUST_MIN_PER_BONE)
  const bones = mergeGeometries(parts.map((p) => p.geometry))
  parts.forEach((p) => p.geometry.dispose())
  return { bones, dust }
}

interface Props {
  zones: Record<ZoneKey, ZoneState>
  focus: ZoneKey | null
  onFocus: (z: ZoneKey | null) => void
}

export function SkeletonView({ zones, focus, onFocus }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const target = useRef({ levels: [0, 0, 0, 0], focus: 'body' as ZoneKey | 'body' })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // The render loop reads these each frame; it never re-subscribes.
  useEffect(() => {
    target.current.levels = ZONES.map((z) => LEVEL_VALUE[zones[z.key].level])
    target.current.focus = focus ?? 'body'
  }, [zones, focus])

  useEffect(() => {
    const el = host.current
    if (!el) return
    let disposed = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // A scene background (not setClearColor) is converted for whichever target is being drawn,
    // so the HDR buffer gets the colour in linear light and the final pass encodes it once.
    scene.background = new THREE.Color(STAGE_BG)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50)
    camera.position.set(0.9, 1.25, 4.0)

    // HDR pipeline: MSAA scene render -> bloom -> hue-preserving tone map to the screen.
    const hdr = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    const composer = new EffectComposer(renderer, hdr)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.25, 0.55)
    composer.addPass(bloom)
    composer.addPass(new ShaderPass(ToneMapShader))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 0.9
    controls.maxDistance = 6
    controls.minPolarAngle = Math.PI * 0.18
    controls.maxPolarAngle = Math.PI * 0.62
    controls.autoRotate = !reduced
    controls.autoRotateSpeed = 0.55
    controls.target.set(0, FRAMING.body[0], 0)

    // While the person drags or zooms, the camera is theirs; the framing animation only runs
    // when the focus changes.
    let framing = true
    let lastFocus: string = target.current.focus
    controls.addEventListener('start', () => {
      framing = false
    })

    const uniforms = holoUniforms(!reduced, FRAMING.body[1])
    const boneMat = boneMaterial(uniforms)
    const dustMat = pointMaterial(uniforms)
    const backdrop = backdropSprite()
    scene.add(backdrop)
    const stage = platform()
    scene.add(stage)

    let ready = false
    let shownAt = 0
    const owned: THREE.BufferGeometry[] = []
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(`${import.meta.env.BASE_URL}models/skeleton.glb`)
      // Let the "Loading" text paint before the smoothing work (a few hundred ms).
      .then((gltf) => new Promise<typeof gltf>((r) => setTimeout(() => r(gltf), 30)))
      .then((gltf) => {
        if (disposed) return
        const { bones, dust } = prepareSkeleton(gltf.scene)
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh) {
            m.geometry.dispose()
            ;(Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose())
          }
        })
        owned.push(bones, dust)
        const boneMesh = new THREE.Mesh(bones, boneMat)
        const dustPoints = new THREE.Points(dust, dustMat)
        boneMesh.frustumCulled = false
        dustPoints.frustumCulled = false
        scene.add(boneMesh, dustPoints)
        shownAt = performance.now()
        ready = true
        setStatus('ready')
      })
      .catch(() => !disposed && setStatus('error'))

    let quality = 1
    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      const ratio = renderRatio(w, h, quality)
      renderer.setPixelRatio(ratio)
      renderer.setSize(w, h, false)
      composer.setPixelRatio(ratio)
      composer.setSize(w, h)
      uniforms.uSize.value = POINT_PX * ratio
      camera.aspect = w / h
      // The stylesheet can zoom in when it gives the stage less height than usual (the
      // one-screen desktop layout), so the body keeps its size on screen.
      camera.zoom = parseFloat(getComputedStyle(el).getPropertyValue('--sk-zoom')) || 1
      // Keep the whole body in frame on tall, narrow screens.
      camera.fov = w / h < 0.75 ? 38 : 30
      // On phones the zone chips take two rows at the bottom; lift the body clear of them.
      if (w < 600) camera.setViewOffset(w, h, 0, h * 0.07, w, h)
      else camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    const clock = new THREE.Clock()
    const lv = uniforms.uLevel.value
    const anchor = new THREE.Vector3()
    const goalTarget = new THREE.Vector3()
    let raf = 0
    // Frame-rate guard: if a slower machine cannot keep ~45 fps, step the resolution down.
    let sampleFrames = 0
    let sampleTime = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const frame = Math.min(clock.getDelta(), 1)
      if (ready && document.visibilityState === 'visible' && quality > 0.5) {
        sampleFrames++
        sampleTime += frame
        if (sampleFrames === 90) {
          if (sampleTime / sampleFrames > 1 / 45) {
            quality -= 0.25
            resize()
          }
          sampleFrames = 0
          sampleTime = 0
        }
      }
      const dt = Math.min(frame, 0.05)
      uniforms.uTime.value += dt
      // Wall-clock based, so a slow or throttled frame rate never leaves the body half drawn.
      if (ready) uniforms.uReveal.value = reduced ? 1 : Math.min(1, (performance.now() - shownAt) / 1800)

      // Ease each zone's colour toward its new level, so a day change reads as a transition.
      const t = target.current.levels
      const ease = 1 - Math.exp(-frame * 4)
      lv.set(lv.x + (t[0] - lv.x) * ease, lv.y + (t[1] - lv.y) * ease, lv.z + (t[2] - lv.z) * ease, lv.w + (t[3] - lv.w) * ease)

      const f = target.current.focus
      if (f !== lastFocus) {
        lastFocus = f
        framing = true
        controls.autoRotate = !reduced && f === 'body'
      }
      if (framing) {
        const [ty, dist] = FRAMING[f]
        goalTarget.set(0, ty, 0)
        const k = 1 - Math.exp(-frame * (reduced ? 30 : 3))
        controls.target.lerp(goalTarget, k)
        const offset = camera.position.clone().sub(controls.target)
        offset.setLength(offset.length() + (dist - offset.length()) * k)
        camera.position.copy(controls.target).add(offset)
        if (controls.target.distanceTo(goalTarget) < 0.002 && Math.abs(offset.length() - dist) < 0.005) framing = false
      }
      ;(stage.userData.ticks as THREE.Object3D).rotation.y += dt * 0.15 * uniforms.uMotion.value

      // In the whole-body view, zooming heads for the face: the orbit centre slides from the
      // pelvis up to the head as the camera closes in, and back down on the way out. Camera and
      // centre move together, so the view angle never jumps.
      if (!framing && f === 'body') {
        const dist = camera.position.distanceTo(controls.target)
        const t = 1 - THREE.MathUtils.smoothstep(dist, FRAMING.head[1], FRAMING.body[1])
        const dy = FRAMING.body[0] + (FRAMING.head[0] - FRAMING.body[0]) * t - controls.target.y
        if (Math.abs(dy) > 1e-5) {
          controls.target.y += dy
          camera.position.y += dy
        }
      }

      controls.update()
      composer.render(frame)

      // Pin the HTML labels to their anchors.
      const w = el.clientWidth
      const h = el.clientHeight
      for (const z of ZONES) {
        const node = labelRefs.current[z.key]
        if (!node) continue
        anchor.set(...z.anchor).project(camera)
        const x = (anchor.x * 0.5 + 0.5) * w
        const y = (-anchor.y * 0.5 + 0.5) * h
        const visible = anchor.z < 1 && x > -40 && x < w + 40 && y > -20 && y < h + 20
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        node.style.visibility = visible ? 'visible' : 'hidden'
      }
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      owned.forEach((g) => g.dispose())
      boneMat.dispose()
      dustMat.dispose()
      backdrop.material.map?.dispose()
      backdrop.material.dispose()
      stage.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.geometry.dispose()
          ;(m.material as THREE.Material).dispose()
        }
      })
      bloom.dispose()
      composer.dispose()
      hdr.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div className="sk">
      <div ref={host} className="sk-canvas" aria-hidden="true" />
      {status === 'loading' && <div className="sk-status">Loading skeleton…</div>}
      {status === 'error' && <div className="sk-status">The 3D model could not load. Every status is still listed beside it.</div>}
      <div className="sk-labels">
        {ZONES.map((z) => {
          const st = zones[z.key]
          if (st.level === 'ok' || status !== 'ready') return null
          return (
            <button
              key={z.key}
              type="button"
              ref={(n) => {
                labelRefs.current[z.key] = n
              }}
              className={`sk-label sk-label-${st.level}`}
              onClick={() => onFocus(focus === z.key ? null : z.key)}
            >
              <span className="sk-label-dot" />
              <span className="sk-label-text">
                <strong>{z.label}</strong>
                <span>{st.reasons.join(' · ')}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
