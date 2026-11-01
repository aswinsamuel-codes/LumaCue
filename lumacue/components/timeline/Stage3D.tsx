'use client'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { CostumeLayout, Pt } from '@/lib/show/body'
import { renderDancer } from '@/lib/show/render'
import type { ShowProject } from '@/lib/show/model'

/**
 * The digital twin in 3D: a simple mannequin per dancer with its LEDs on the
 * front and back of the body. Drag to orbit, scroll to zoom. Uses the same
 * frames as the 2D twin (renderDancer), so what lights here is the show.
 *
 * Figure coordinates (100 × 200 front view) map to metres-ish world units:
 * X = (x − 50) / 100, Y = (200 − y) / 100 (feet on the floor), Z towards the audience.
 */

const SPACING = 1.25
const wx = (x: number) => (x - 50) / 100
const wy = (y: number) => (200 - y) / 100

// Body parts in figure coordinates (same shapes as the 2D silhouette).
const HEAD = { x: 50, y: 21, r: 13 }
const LIMBS: { a: [number, number]; b: [number, number]; r: number }[] = [
  { a: [35, 46], b: [22, 78], r: 4.5 }, { a: [22, 78], b: [13, 110], r: 4 },   // left arm
  { a: [65, 46], b: [78, 78], r: 4.5 }, { a: [78, 78], b: [87, 110], r: 4 },   // right arm
  { a: [44, 108], b: [41, 152], r: 6 }, { a: [41, 152], b: [39, 192], r: 5 },  // left leg
  { a: [56, 108], b: [59, 152], r: 6 }, { a: [59, 152], b: [61, 192], r: 5 },  // right leg
]

/** Distance from a point to a segment, in figure units. */
function segDist(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** How far in front of (or behind) the body's centre an LED sits, in figure units. */
function surfaceDepth(p: Pt) {
  const dh = Math.hypot(p.x - HEAD.x, p.y - HEAD.y)
  if (dh <= HEAD.r) return Math.sqrt(HEAD.r * HEAD.r - dh * dh) + 0.8
  if (p.y >= 41 && p.y <= 110) {
    const half = 17 - ((p.y - 41) / 69) * 4 // torso narrows from shoulders to hips
    if (Math.abs(p.x - 50) <= half) return 9.5 * Math.sqrt(Math.max(0.15, 1 - ((p.x - 50) / half) ** 2)) + 0.8
  }
  let best = Infinity, r = 5
  for (const l of LIMBS) {
    const d = segDist(p.x, p.y, l.a, l.b)
    if (d < best) { best = d; r = l.r }
  }
  return Math.sqrt(Math.max(r * r * 0.3, r * r - best * best)) + 0.8
}

function ledPosition(p: Pt, dancerX: number) {
  const z = surfaceDepth(p) / 100
  return new THREE.Vector3(dancerX + wx(p.x), wy(p.y), p.back ? -z : z)
}

/** A capsule between two figure points. */
function limbMesh(a: [number, number], b: [number, number], r: number, mat: THREE.Material) {
  const A = new THREE.Vector3(wx(a[0]), wy(a[1]), 0), B = new THREE.Vector3(wx(b[0]), wy(b[1]), 0)
  const dir = B.clone().sub(A)
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r / 100, dir.length(), 4, 10), mat)
  mesh.position.copy(A).add(B).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return mesh
}

function mannequin(mat: THREE.Material) {
  const g = new THREE.Group()
  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD.r / 100, 20, 14), mat)
  head.position.set(wx(HEAD.x), wy(HEAD.y), 0)
  g.add(head)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 12), mat)
  neck.position.set(0, wy(37), 0)
  g.add(neck)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.69, 20), mat)
  torso.scale.z = 0.55
  torso.position.set(0, wy(75.5), 0)
  g.add(torso)
  for (const l of LIMBS) g.add(limbMesh(l.a, l.b, l.r, mat))
  return g
}

interface Props {
  project: ShowProject
  layout: CostumeLayout
  timeMs: number
  view: 'all' | 'single'
  focusDancer: number
  dark?: boolean
}

export default function Stage3D({ project, layout, timeMs, view, focusDancer, dark = false }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const three = useRef<{
    renderer: THREE.WebGLRenderer
    composer: EffectComposer
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    scene: THREE.Scene
    leds: THREE.InstancedMesh | null
    bodies: THREE.Group
    draw: () => void
  } | null>(null)
  const frame = useRef(new Float32Array(0))
  const dancers = useMemo(
    () => (view === 'single' ? [Math.max(0, Math.min(focusDancer, project.dancers - 1))] : Array.from({ length: project.dancers }, (_, i) => i)),
    [view, focusDancer, project.dancers],
  )

  // Renderer, camera, lights and floor: once.
  useEffect(() => {
    const el = host.current
    if (!el) return
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#06060a')
    scene.fog = new THREE.Fog('#06060a', 6, 16)
    scene.add(new THREE.HemisphereLight('#8080b0', '#101018', 0.6))
    const key = new THREE.DirectionalLight('#ffffff', 0.5)
    key.position.set(2, 4, 3)
    scene.add(key)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: '#0b0b12', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    const grid = new THREE.GridHelper(16, 32, '#2a2340', '#15121f')
    grid.position.y = 0.001
    scene.add(grid)

    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1, 0)
    controls.enableDamping = false
    controls.maxPolarAngle = Math.PI * 0.495 // stay above the floor
    controls.minDistance = 0.8
    controls.maxDistance = 14

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.4, 0.2))
    composer.addPass(new OutputPass())

    const bodies = new THREE.Group()
    scene.add(bodies)
    const draw = () => composer.render()
    controls.addEventListener('change', draw)

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1
      renderer.setSize(w, h)
      composer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    three.current = { renderer, composer, camera, controls, scene, leds: null, bodies, draw }
    resize()

    return () => {
      ro.disconnect()
      controls.dispose()
      composer.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
      three.current = null
    }
  }, [])

  // Mannequins and LED dots: when the costume layout or the dancers change.
  useEffect(() => {
    const t = three.current
    if (!t) return
    t.bodies.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    t.bodies.clear()
    if (t.leds) { t.scene.remove(t.leds); t.leds.geometry.dispose(); (t.leds.material as THREE.Material).dispose(); t.leds = null }

    const bodyMat = new THREE.MeshStandardMaterial({ color: '#191922', roughness: 0.85, metalness: 0.05 })
    const xs = dancers.map((_, k) => (k - (dancers.length - 1) / 2) * SPACING)
    xs.forEach((x) => { const m = mannequin(bodyMat); m.position.x = x; t.bodies.add(m) })

    const count = Math.max(1, dancers.length * layout.total)
    const leds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), count)
    const m = new THREE.Matrix4()
    let i = 0
    xs.forEach((x) => {
      for (const z of layout.zones) for (const p of z.points) { m.setPosition(ledPosition(p, x)); leds.setMatrixAt(i++, m) }
    })
    leds.count = i
    leds.instanceMatrix.needsUpdate = true
    leds.setColorAt(0, new THREE.Color(0)) // creates the colour buffer
    t.scene.add(leds)
    t.leds = leds

    // Frame the whole line of dancers.
    const width = (dancers.length - 1) * SPACING + 1
    const dist = Math.max(2.6, width * 0.8)
    t.camera.position.set(0, 1.5, dist)
    t.controls.target.set(0, 1, 0)
    t.controls.update()
    t.draw()
  }, [dancers, layout])

  // LED colours: every show frame.
  useEffect(() => {
    const t = three.current
    if (!t?.leds) return
    if (frame.current.length !== layout.total * 3) frame.current = new Float32Array(layout.total * 3)
    const f = frame.current
    const c = new THREE.Color()
    let i = 0
    for (const d of dancers) {
      if (dark) f.fill(0)
      else renderDancer(project, layout, d, timeMs, f)
      for (let k = 0; k < layout.total; k++) {
        const r = f[k * 3], g = f[k * 3 + 1], b = f[k * 3 + 2]
        // Lit LEDs go above 1.0 so the bloom pass makes them glow; dark ones stay faintly visible.
        if (r + g + b > 12) c.setRGB((r / 255) * 1.6, (g / 255) * 1.6, (b / 255) * 1.6)
        else c.setRGB(0.06, 0.06, 0.08)
        t.leds.setColorAt(i++, c)
      }
    }
    if (t.leds.instanceColor) t.leds.instanceColor.needsUpdate = true
    t.draw()
  }, [project, layout, timeMs, dancers, dark])

  return (
    <div ref={host} className="absolute inset-0" aria-label="3D digital twin of the costumes: drag to orbit, scroll to zoom">
      <p className="absolute z-10 bottom-2 left-3 text-white/30 text-[10px] font-mono pointer-events-none select-none">3D · drag to turn · scroll to zoom</p>
    </div>
  )
}
