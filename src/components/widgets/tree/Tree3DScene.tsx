import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface Props {
  /** 0..1 — overall tree maturity */
  growth: number
  /** day vs night colour palette */
  isDay: boolean
  /** if non-null, the tree is being chopped; value is ms timestamp of action */
  choppingAt?: number | null
}

// Deterministic RNG so each tree shape is stable across renders.
function seededRng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// Richer leaf palette — bright sunlit greens to deep shade greens, plus a few
// highlight tints to make canopies feel painterly rather than uniform.
const LEAF_PALETTE = [
  0xd9f99d, // lime-200 — sunlit highlights
  0xbef264, // lime-300
  0xa3e635, // lime-400
  0x86efac, // green-300
  0x4ade80, // green-400
  0x22c55e, // green-500
  0x16a34a, // green-600
  0x15803d, // green-700
  0x14532d, // green-900 — deep shade
]
const LEAF_HIGHLIGHT = [0xfde68a, 0xfef3c7] // occasional warm tint

// Fruit ripening — green → yellow → red as fruit matures
const FRUIT_GREEN = new THREE.Color(0x84cc16)
const FRUIT_YELLOW = new THREE.Color(0xfacc15)
const FRUIT_RED = new THREE.Color(0xdc2626)
const FRUIT_START = 0.6 // growth value at which fruits begin to appear

interface ClusterRef {
  group: THREE.Group
  phase: number
  amp: number
}

interface SceneRefs {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  treeGroup: THREE.Group
  branchHub: THREE.Group
  canopyGroup: THREE.Group
  baseGroup: THREE.Group
  ambient: THREE.AmbientLight
  hemi: THREE.HemisphereLight
  sun: THREE.DirectionalLight
  fill: THREE.PointLight
  stars: THREE.Points
  sun3d: THREE.Mesh
  moon3d: THREE.Mesh
  ground: THREE.Mesh
  distantHills: THREE.Group
  decorations: THREE.Group
  clusters: ClusterRef[]
  cleanup: () => void
}

export function Tree3DScene({ growth, isDay, choppingAt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const refs = useRef<SceneRefs | null>(null)
  const chopRef = useRef<number | null>(null)

  useEffect(() => {
    chopRef.current = choppingAt ?? null
  }, [choppingAt])

  // === One-shot setup ===
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const w0 = Math.max(1, container.clientWidth)
    const h0 = Math.max(1, container.clientHeight)

    const scene = new THREE.Scene()
    // Fog gives a soft horizon for the open world; near pushed back so the
    // tree stays crisp at default zoom and only the far landscape fades.
    scene.fog = new THREE.Fog(0xbbe4f6, 14, 42)

    const camera = new THREE.PerspectiveCamera(34, w0 / h0, 0.1, 120)
    camera.position.set(0, 3, 7.5)
    camera.lookAt(0, 1.8, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w0, h0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'none'
    container.appendChild(renderer.domElement)

    // === Orbit controls — drag to rotate, wheel to zoom ===
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.8, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.09
    controls.enablePan = false
    controls.enableZoom = true
    controls.zoomSpeed = 0.8
    controls.minDistance = 3.4
    controls.maxDistance = 16
    controls.rotateSpeed = 0.85
    controls.minPolarAngle = 0.15
    controls.maxPolarAngle = Math.PI * 0.52
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.7
    let resumeTimer = 0
    controls.addEventListener('start', () => {
      controls.autoRotate = false
      window.clearTimeout(resumeTimer)
      renderer.domElement.style.cursor = 'grabbing'
    })
    controls.addEventListener('end', () => {
      renderer.domElement.style.cursor = 'grab'
      window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(() => {
        controls.autoRotate = true
      }, 3500)
    })

    // === Lighting ===
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a6741, 0.8)
    scene.add(hemi)
    const ambient = new THREE.AmbientLight(0xffffff, 0.28)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfffbeb, 1.35)
    sun.position.set(5, 8, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -5
    sun.shadow.camera.right = 5
    sun.shadow.camera.top = 5
    sun.shadow.camera.bottom = -5
    sun.shadow.bias = -0.0008
    scene.add(sun)
    const fill = new THREE.PointLight(0x88aaff, 0.4, 18)
    fill.position.set(-4, 3, -3)
    scene.add(fill)

    // === Open-world ground (large plane with rolling hills) ===
    const groundGeom = new THREE.PlaneGeometry(60, 60, 96, 96)
    const gp = groundGeom.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i)
      const y = gp.getY(i)
      const d = Math.hypot(x, y)
      // Keep ground flat near the tree (r<3), let it gently roll further out.
      const ramp = Math.min(1, Math.max(0, (d - 3) / 12))
      const hills =
        Math.sin(x * 0.22) * Math.cos(y * 0.28) * 0.45 +
        Math.sin(x * 0.08 + y * 0.12) * 0.55 +
        Math.cos(x * 0.4 - y * 0.3) * 0.18
      gp.setZ(i, hills * ramp)
    }
    groundGeom.computeVertexNormals()
    groundGeom.rotateX(-Math.PI / 2)
    const ground = new THREE.Mesh(
      groundGeom,
      new THREE.MeshStandardMaterial({
        color: 0x4d7c2f,
        roughness: 0.95,
        flatShading: true,
      }),
    )
    ground.receiveShadow = true
    scene.add(ground)

    // === Distant hill silhouettes for depth (forest line at the horizon) ===
    const distantHills = new THREE.Group()
    const hillRng = seededRng(31)
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x2f5f30,
      roughness: 1,
      flatShading: true,
    })
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + hillRng() * 0.25
      const dist = 18 + hillRng() * 6
      const h = 1.4 + hillRng() * 2.5
      const w = 2 + hillRng() * 2.5
      const hill = new THREE.Mesh(new THREE.ConeGeometry(w, h, 7, 1), hillMat)
      hill.position.set(Math.cos(ang) * dist, h / 2 - 0.2, Math.sin(ang) * dist)
      hill.rotation.y = hillRng() * Math.PI
      distantHills.add(hill)
    }
    scene.add(distantHills)

    // === Soft shadow patch directly under the tree (no pot, just shading) ===
    const shadowPatch = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 }),
    )
    shadowPatch.rotation.x = -Math.PI / 2
    shadowPatch.position.y = 0.002
    scene.add(shadowPatch)

    // === Scattered grass tufts across the world ===
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      flatShading: true,
      side: THREE.DoubleSide,
      roughness: 0.9,
    })
    const tuftRng = seededRng(7)
    for (let i = 0; i < 90; i++) {
      const angle = tuftRng() * Math.PI * 2
      const r = 0.9 + tuftRng() * 6.5
      const h = 0.08 + tuftRng() * 0.14
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.05 + tuftRng() * 0.03, h, 4),
        grassMat,
      )
      tuft.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r)
      tuft.rotation.y = tuftRng() * Math.PI
      tuft.rotation.z = (tuftRng() - 0.5) * 0.25
      tuft.castShadow = true
      scene.add(tuft)
    }

    // === Decorative objects beside the tree (rocks, mushrooms, wildflowers, stump) ===
    const decorations = new THREE.Group()
    buildDecorations(decorations)
    scene.add(decorations)

    // === Tree anchor groups ===
    const treeGroup = new THREE.Group() // trunk + branches + foliage; what falls when chopped
    treeGroup.position.y = 0
    scene.add(treeGroup)

    const branchHub = new THREE.Group()
    treeGroup.add(branchHub)
    const canopyGroup = new THREE.Group()
    treeGroup.add(canopyGroup)

    const baseGroup = new THREE.Group() // earth mound + exposed roots; stays when chopped
    scene.add(baseGroup)

    // === Stars (night) ===
    const starCount = 240
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 16 + Math.random() * 8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.5 + 0.05
      starPos[i * 3] = Math.cos(theta) * Math.sin(phi) * r
      starPos[i * 3 + 1] = Math.cos(phi) * r * 0.6 + 4
      starPos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r
    }
    const starGeom = new THREE.BufferGeometry()
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.07,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
    })
    const stars = new THREE.Points(starGeom, starMat)
    scene.add(stars)

    // === Sun / Moon billboards ===
    const sun3d = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xfde68a }),
    )
    sun3d.position.set(7, 6.5, -8)
    scene.add(sun3d)

    const moon3d = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xe5e7eb }),
    )
    moon3d.position.set(-7, 6, -8)
    scene.add(moon3d)

    // === Animation loop ===
    const clusters: ClusterRef[] = []
    let raf = 0
    let lastT = performance.now()
    const t0 = performance.now()
    let chopAnim = 0

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden) {
        lastT = t
        return
      }
      const dt = Math.min(0.1, (t - lastT) / 1000)
      lastT = t
      const elapsed = (t - t0) / 1000

      // Per-cluster wind sway
      for (const c of clusters) {
        c.group.rotation.x = Math.sin(elapsed * 0.7 + c.phase) * 0.05 * c.amp
        c.group.rotation.z = Math.cos(elapsed * 0.5 + c.phase) * 0.04 * c.amp
        c.group.position.y +=
          (Math.sin(elapsed * 0.9 + c.phase) * 0.005 -
            (c.group.position.y - c.group.userData.baseY)) *
          0.1
      }

      // Trunk sway (very subtle)
      branchHub.rotation.z = Math.sin(elapsed * 0.35) * 0.012
      branchHub.rotation.x = Math.sin(elapsed * 0.27 + 1) * 0.008

      // Chop animation — tree falls, mound/roots stay
      const chopT = chopRef.current
      if (chopT) {
        const since = (Date.now() - chopT) / 1000
        chopAnim = Math.min(1, since / 1.1)
        const angle = (-Math.PI / 2) * easeInQuad(chopAnim)
        treeGroup.rotation.z = angle
        treeGroup.position.x = (1 - Math.cos(angle)) * 0.4
      } else if (chopAnim > 0) {
        chopAnim = Math.max(0, chopAnim - dt * 4)
        treeGroup.rotation.z = (-Math.PI / 2) * easeInQuad(chopAnim)
        if (chopAnim === 0) {
          treeGroup.rotation.z = 0
          treeGroup.position.x = 0
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(loop)

    // === Resize ===
    const ro = new ResizeObserver(() => {
      const w = Math.max(1, container.clientWidth)
      const h = Math.max(1, container.clientHeight)
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(container)

    refs.current = {
      renderer,
      scene,
      camera,
      treeGroup,
      branchHub,
      canopyGroup,
      baseGroup,
      ambient,
      hemi,
      sun,
      fill,
      stars,
      sun3d,
      moon3d,
      ground,
      distantHills,
      decorations,
      clusters,
      cleanup: () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        window.clearTimeout(resumeTimer)
        controls.dispose()
        try {
          container.removeChild(renderer.domElement)
        } catch {
          /* already removed */
        }
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose()
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            for (const m of mats) m.dispose()
          }
        })
        starGeom.dispose()
        starMat.dispose()
        renderer.dispose()
      },
    }

    return () => refs.current?.cleanup()
  }, [])

  // Rebuild tree on growth change
  useEffect(() => {
    const r = refs.current
    if (!r) return
    buildTree(r.branchHub, r.canopyGroup, r.baseGroup, r.clusters, growth)
  }, [growth])

  // Apply day / night palette
  useEffect(() => {
    const r = refs.current
    if (!r) return
    applyTimeOfDay(r, isDay)
  }, [isDay])

  return <div ref={containerRef} className="absolute inset-0" />
}

function easeInQuad(t: number) {
  return t * t
}

function applyTimeOfDay(r: SceneRefs, isDay: boolean) {
  if (isDay) {
    r.scene.background = new THREE.Color(0x9bd9ee)
    if (r.scene.fog instanceof THREE.Fog) r.scene.fog.color.setHex(0xbbe4f6)
    r.ambient.intensity = 0.32
    r.hemi.intensity = 0.95
    r.hemi.color.setHex(0x9bd9ee)
    r.hemi.groundColor.setHex(0x4a6741)
    r.sun.intensity = 1.45
    r.sun.color.setHex(0xfffbeb)
    r.fill.intensity = 0.3
    r.fill.color.setHex(0xfde68a)
    ;(r.stars.material as THREE.PointsMaterial).opacity = 0
    r.sun3d.visible = true
    r.moon3d.visible = false
    ;(r.ground.material as THREE.MeshStandardMaterial).color.setHex(0x4d7c2f)
    r.distantHills.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        ;(c.material as THREE.MeshStandardMaterial).color.setHex(0x2f5f30)
      }
    })
  } else {
    r.scene.background = new THREE.Color(0x0b1437)
    if (r.scene.fog instanceof THREE.Fog) r.scene.fog.color.setHex(0x05081a)
    r.ambient.intensity = 0.18
    r.hemi.intensity = 0.45
    r.hemi.color.setHex(0x4a6cff)
    r.hemi.groundColor.setHex(0x111827)
    r.sun.intensity = 0.55
    r.sun.color.setHex(0xb6c2ff)
    r.fill.intensity = 0.55
    r.fill.color.setHex(0x6366f1)
    ;(r.stars.material as THREE.PointsMaterial).opacity = 0.92
    r.sun3d.visible = false
    r.moon3d.visible = true
    ;(r.ground.material as THREE.MeshStandardMaterial).color.setHex(0x1a2e1f)
    r.distantHills.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        ;(c.material as THREE.MeshStandardMaterial).color.setHex(0x0d2410)
      }
    })
  }
}

function disposeMesh(obj: THREE.Object3D) {
  obj.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.geometry.dispose()
      const mats = Array.isArray(c.material) ? c.material : [c.material]
      for (const m of mats) m.dispose()
    }
  })
}

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const c = group.children[0]
    group.remove(c)
    disposeMesh(c)
  }
}

// === World decorations ====================================================

function buildDecorations(parent: THREE.Group) {
  const rng = seededRng(53)
  // Rocks scattered around the tree
  for (let i = 0; i < 6; i++) {
    const ang = rng() * Math.PI * 2
    const r = 1.8 + rng() * 4
    addRock(parent, Math.cos(ang) * r, Math.sin(ang) * r, 0.6 + rng() * 0.8, rng)
  }
  // Mushrooms (clusters of 1-3)
  for (let i = 0; i < 4; i++) {
    const ang = rng() * Math.PI * 2 + i
    const r = 1.4 + rng() * 3
    const cx = Math.cos(ang) * r
    const cz = Math.sin(ang) * r
    const count = 1 + Math.floor(rng() * 3)
    for (let j = 0; j < count; j++) {
      addMushroom(parent, cx + (rng() - 0.5) * 0.35, cz + (rng() - 0.5) * 0.35, rng)
    }
  }
  // Wildflower patches
  for (let i = 0; i < 10; i++) {
    const ang = rng() * Math.PI * 2
    const r = 1.6 + rng() * 5
    addWildflowerCluster(parent, Math.cos(ang) * r, Math.sin(ang) * r, rng)
  }
  // A weathered stump
  {
    const ang = rng() * Math.PI * 2
    const r = 3 + rng() * 1.5
    addStump(parent, Math.cos(ang) * r, Math.sin(ang) * r, rng)
  }
  // A fallen log
  {
    const ang = rng() * Math.PI * 2
    const r = 3.5 + rng() * 1.2
    addFallenLog(parent, Math.cos(ang) * r, Math.sin(ang) * r, rng)
  }
}

function jitterGeom(geom: THREE.BufferGeometry, amount: number, rng: () => number) {
  const pos = geom.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rng() - 0.5) * amount,
      pos.getY(i) + (rng() - 0.5) * amount,
      pos.getZ(i) + (rng() - 0.5) * amount,
    )
  }
  geom.computeVertexNormals()
}

function addRock(parent: THREE.Group, x: number, z: number, scale: number, rng: () => number) {
  const r = (0.18 + rng() * 0.14) * scale
  const geom = new THREE.DodecahedronGeometry(r, 0)
  jitterGeom(geom, r * 0.18, rng)
  const tone = 0x6b7280 + Math.floor(rng() * 0x111111) - 0x080808
  const mat = new THREE.MeshStandardMaterial({
    color: tone,
    roughness: 1,
    flatShading: true,
  })
  const rock = new THREE.Mesh(geom, mat)
  rock.position.set(x, r * 0.55, z)
  rock.scale.set(1, 0.65 + rng() * 0.15, 1)
  rock.rotation.y = rng() * Math.PI * 2
  rock.castShadow = true
  rock.receiveShadow = true
  parent.add(rock)
}

function addMushroom(parent: THREE.Group, x: number, z: number, rng: () => number) {
  const stemH = 0.14 + rng() * 0.08
  const capR = 0.08 + rng() * 0.05
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, stemH, 8),
    new THREE.MeshStandardMaterial({ color: 0xfdf6e3, roughness: 0.8 }),
  )
  stem.position.set(x, stemH / 2, z)
  stem.castShadow = true
  parent.add(stem)

  // Red cap with white spots
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(capR, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.55,
      flatShading: true,
    }),
  )
  cap.position.set(x, stemH, z)
  cap.castShadow = true
  parent.add(cap)
  const spotMat = new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.7 })
  const spotCount = 3 + Math.floor(rng() * 3)
  for (let i = 0; i < spotCount; i++) {
    const a = (i / spotCount) * Math.PI * 2 + rng() * 0.4
    const rr = capR * (0.4 + rng() * 0.4)
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.012 + rng() * 0.008, 6, 4), spotMat)
    const sx = Math.cos(a) * rr
    const sz = Math.sin(a) * rr
    // Sit the spot on the cap surface
    const sy = stemH + Math.sqrt(Math.max(0, capR * capR - sx * sx - sz * sz))
    spot.position.set(x + sx, sy + 0.005, z + sz)
    parent.add(spot)
  }
}

function addWildflowerCluster(parent: THREE.Group, x: number, z: number, rng: () => number) {
  const colors = [0xfbbf24, 0xa78bfa, 0xf472b6, 0xfde68a, 0xfb7185, 0x60a5fa]
  const count = 4 + Math.floor(rng() * 4)
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.9 })
  for (let i = 0; i < count; i++) {
    const dx = (rng() - 0.5) * 0.35
    const dz = (rng() - 0.5) * 0.35
    const h = 0.08 + rng() * 0.08
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, h, 4), stemMat)
    stem.position.set(x + dx, h / 2, z + dz)
    parent.add(stem)
    const color = colors[Math.floor(rng() * colors.length)]
    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.024 + rng() * 0.012, 6, 4),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.18,
        roughness: 0.7,
        flatShading: true,
      }),
    )
    bloom.position.set(x + dx, h + 0.022, z + dz)
    parent.add(bloom)
  }
}

function addStump(parent: THREE.Group, x: number, z: number, rng: () => number) {
  const h = 0.28 + rng() * 0.1
  const rTop = 0.22 + rng() * 0.05
  const rBot = rTop * 1.1
  const stump = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, 14),
    new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.92, flatShading: true }),
  )
  stump.position.set(x, h / 2, z)
  stump.castShadow = true
  stump.receiveShadow = true
  parent.add(stump)
  // Lighter top — exposed wood rings
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(rTop - 0.008, 18),
    new THREE.MeshStandardMaterial({ color: 0xc9a26b, roughness: 0.7, flatShading: true }),
  )
  top.rotation.x = -Math.PI / 2
  top.position.set(x, h + 0.001, z)
  parent.add(top)
  // A little moss patch on one side
  const moss = new THREE.Mesh(
    new THREE.SphereGeometry(rTop * 0.45, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.85, flatShading: true }),
  )
  moss.scale.set(1.3, 0.4, 0.6)
  moss.position.set(x + rTop * 0.6, h - 0.08, z)
  moss.rotation.y = rng() * Math.PI * 2
  parent.add(moss)
}

function addFallenLog(parent: THREE.Group, x: number, z: number, rng: () => number) {
  const len = 0.9 + rng() * 0.5
  const r = 0.1 + rng() * 0.04
  const log = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r * 1.05, len, 12),
    new THREE.MeshStandardMaterial({ color: 0x7b4f2c, roughness: 0.95, flatShading: true }),
  )
  log.rotation.z = Math.PI / 2
  log.rotation.y = rng() * Math.PI
  log.position.set(x, r, z)
  log.castShadow = true
  log.receiveShadow = true
  parent.add(log)
  // Mossy fuzz on top
  const moss = new THREE.Mesh(
    new THREE.CapsuleGeometry(r * 0.65, len * 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2ea14c, roughness: 0.9, flatShading: true }),
  )
  moss.rotation.z = Math.PI / 2
  moss.rotation.y = log.rotation.y
  moss.position.set(x, r + r * 0.6, z)
  moss.scale.set(1, 1, 0.5)
  parent.add(moss)
}

// === Base mound & exposed roots where the tree meets the ground ===========

function buildBaseMound(parent: THREE.Group, growth: number) {
  const rng = seededRng(101)
  const radius = lerp(0.28, 0.78, growth)
  // Soft earth disc
  const mound = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.5, 28),
    new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 1 }),
  )
  mound.rotation.x = -Math.PI / 2
  mound.position.y = 0.006
  parent.add(mound)
  // Small earth bumps
  for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2
    const rr = (rng() * 0.55 + 0.3) * radius
    const bump = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.04 + rng() * 0.05, 0),
      new THREE.MeshStandardMaterial({ color: 0x4a2f17, roughness: 1, flatShading: true }),
    )
    bump.position.set(Math.cos(a) * rr, 0.024, Math.sin(a) * rr)
    bump.rotation.set(rng(), rng(), rng())
    parent.add(bump)
  }
  // Root flares radiating from the base
  const rootMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1f,
    roughness: 0.95,
    flatShading: true,
  })
  const rootCount = 5 + Math.floor(growth * 4)
  for (let i = 0; i < rootCount; i++) {
    const a = (i / rootCount) * Math.PI * 2 + rng() * 0.35
    const len = (0.35 + rng() * 0.3) * Math.max(0.4, growth)
    const rad = 0.06 + growth * 0.05
    const root = new THREE.Mesh(
      new THREE.CylinderGeometry(rad * 0.35, rad, len, 7),
      rootMat,
    )
    // Lay root nearly horizontal, radiating outward
    root.rotation.z = Math.PI / 2 - 0.35
    root.rotation.y = a
    const mx = (Math.cos(a) * len) / 2
    const mz = (Math.sin(a) * len) / 2
    root.position.set(mx, rad * 0.55, mz)
    root.castShadow = true
    parent.add(root)
  }
}

// === Tree =================================================================

function buildTree(
  branchHub: THREE.Group,
  canopyGroup: THREE.Group,
  baseGroup: THREE.Group,
  clusters: ClusterRef[],
  growth: number,
) {
  clearGroup(branchHub)
  clearGroup(canopyGroup)
  clearGroup(baseGroup)
  clusters.length = 0

  const g = clamp01(growth)
  const rng = seededRng(13)

  // ===== SPROUT — special tiny render =====
  if (g < 0.05) {
    const t = g / 0.05
    const stemH = 0.18 + 0.22 * t
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.028, stemH, 6),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.75 }),
    )
    stem.position.y = stemH / 2
    stem.castShadow = true
    branchHub.add(stem)

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x86efac,
      roughness: 0.7,
      flatShading: true,
      side: THREE.DoubleSide,
    })
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1 + 0.05 * t, 12, 8), leafMat)
      leaf.scale.set(1.7, 0.4, 1)
      leaf.position.set(side * 0.13, stemH * 0.85, 0)
      leaf.rotation.z = side * 0.6
      leaf.castShadow = true
      branchHub.add(leaf)
    }
    // Tiny earth disc under the sprout
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 1 }),
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.y = 0.004
    baseGroup.add(disc)
    return
  }

  // ===== EARTH MOUND + ROOTS at the base =====
  if (g >= 0.05) buildBaseMound(baseGroup, g)

  // ===== TRUNK =====
  const trunkH = lerp(0.55, 3.3, g)
  const trunkRBottom = lerp(0.08, 0.34, g)
  const trunkRTop = trunkRBottom * 0.45

  const trunkGeom = new THREE.CylinderGeometry(trunkRTop, trunkRBottom, trunkH, 16, 8)
  const pos = trunkGeom.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const tNorm = (y + trunkH / 2) / trunkH
    // gentle S-curve bend
    const bend = Math.sin(tNorm * 1.7) * 0.08 * g
    // bark relief — combine two frequencies for a richer look
    const r = Math.hypot(x, z)
    const angle = Math.atan2(z, x)
    const bark =
      (Math.sin(y * 18 + angle * 5) * 0.5 + Math.cos(y * 32 - angle * 3) * 0.3) *
      0.024 *
      (0.4 + g * 0.6)
    // root flare at the very base
    const flare = Math.pow(1 - tNorm, 3) * 0.18 * g
    const scale = 1 + flare
    pos.setX(i, x * scale + (x / (r || 1)) * bark + bend)
    pos.setZ(i, z * scale + (z / (r || 1)) * bark)
  }
  trunkGeom.computeVertexNormals()

  const trunkColor = new THREE.Color().lerpColors(
    new THREE.Color(0x8b5a2b),
    new THREE.Color(0x3e2615),
    g * 0.85,
  )
  const trunkMat = new THREE.MeshStandardMaterial({
    color: trunkColor,
    roughness: 0.92,
    metalness: 0,
  })
  const trunk = new THREE.Mesh(trunkGeom, trunkMat)
  trunk.position.y = trunkH / 2
  trunk.castShadow = true
  trunk.receiveShadow = true
  branchHub.add(trunk)

  // ===== BRANCHES (recursive procedural) =====
  const branchMat = trunkMat.clone()
  const branchEnds: { pos: THREE.Vector3; size: number; midClusters: THREE.Vector3[] }[] = []
  const trunkTop = new THREE.Vector3(0, trunkH, 0)

  const mainBranchCount = g < 0.15 ? 1 : g < 0.35 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(g * 4)
  const maxDepth = g < 0.35 ? 1 : g < 0.7 ? 2 : 3

  // Crown foliage cluster at the top of the trunk
  branchEnds.push({
    pos: trunkTop.clone().add(new THREE.Vector3(0, lerp(0.1, 0.45, g), 0)),
    size: 1.05,
    midClusters: [],
  })

  for (let i = 0; i < mainBranchCount; i++) {
    const yaw = (i / mainBranchCount) * Math.PI * 2 + rng() * 0.32
    const pitch = lerp(0.4, 0.85, rng()) // angle from vertical (smaller = more upright)
    const dir = new THREE.Vector3(
      Math.sin(pitch) * Math.cos(yaw),
      Math.cos(pitch),
      Math.sin(pitch) * Math.sin(yaw),
    )
    const length = lerp(0.35, 1.1, g) * (0.8 + rng() * 0.35)
    const radius = trunkRTop * (0.55 + rng() * 0.18)
    growBranch(branchHub, branchMat, trunkTop, dir, length, radius, 0, maxDepth, rng, branchEnds)
  }

  // ===== FOLIAGE CLUSTERS at branch tips + a few mid-branch puffs =====
  for (const end of branchEnds) {
    addFoliageCluster(canopyGroup, end.pos, end.size, g, rng, clusters)
    // Mid-branch interior puffs (smaller) for fuller crowns
    for (const mp of end.midClusters) {
      addFoliageCluster(canopyGroup, mp, end.size * 0.55, g, rng, clusters)
    }
  }
}

function growBranch(
  parent: THREE.Group,
  branchMat: THREE.Material,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  radius: number,
  depth: number,
  maxDepth: number,
  rng: () => number,
  branchEnds: { pos: THREE.Vector3; size: number; midClusters: THREE.Vector3[] }[],
) {
  const end = origin.clone().add(dir.clone().multiplyScalar(length))

  const geom = new THREE.CylinderGeometry(radius * 0.55, radius, length, 8)
  geom.translate(0, length / 2, 0)
  const branch = new THREE.Mesh(geom, branchMat)
  branch.castShadow = true
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  )
  branch.quaternion.copy(q)
  branch.position.copy(origin)
  parent.add(branch)

  if (depth >= maxDepth || length < 0.2) {
    // Tip — main cluster here. Add 1 midpoint cluster for fullness if branch is long.
    const mids: THREE.Vector3[] = []
    if (length > 0.5) {
      mids.push(origin.clone().add(dir.clone().multiplyScalar(length * 0.6)))
    }
    branchEnds.push({ pos: end, size: lerp(0.6, 1, length / 1.3), midClusters: mids })
    return
  }

  // Spawn 2 sub-branches diverging from the tip
  const childCount = depth === 0 ? 2 : 1 + Math.floor(rng() * 2)
  for (let i = 0; i < childCount; i++) {
    const upRef =
      Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const sideA = new THREE.Vector3().crossVectors(dir, upRef).normalize()
    const sideB = new THREE.Vector3().crossVectors(dir, sideA).normalize()

    const yawA = ((i + 0.5) / childCount) * Math.PI * 2 + rng() * 0.4
    const splay = lerp(0.35, 0.55, rng())
    const childDir = dir
      .clone()
      .multiplyScalar(Math.cos(splay))
      .add(sideA.multiplyScalar(Math.sin(splay) * Math.cos(yawA)))
      .add(sideB.multiplyScalar(Math.sin(splay) * Math.sin(yawA)))
      .normalize()

    const childLen = length * lerp(0.55, 0.8, rng())
    const childR = radius * lerp(0.55, 0.72, rng())
    growBranch(parent, branchMat, end, childDir, childLen, childR, depth + 1, maxDepth, rng, branchEnds)
  }
}

// === Foliage clusters (painterly multi-blob), flowers, fruits =============

function addFoliageCluster(
  canopyGroup: THREE.Group,
  center: THREE.Vector3,
  sizeMul: number,
  g: number,
  rng: () => number,
  clusters: ClusterRef[],
) {
  const clusterGroup = new THREE.Group()
  clusterGroup.position.copy(center)
  clusterGroup.userData.baseY = center.y
  canopyGroup.add(clusterGroup)

  const baseR = lerp(0.22, 0.7, g) * sizeMul

  // Big main blob — slightly irregular icosahedron for a fluffy silhouette
  const mainColor = pickLeaf(rng, true)
  const mainGeom = new THREE.IcosahedronGeometry(baseR, 1)
  jitterGeom(mainGeom, baseR * 0.08, rng)
  const main = new THREE.Mesh(
    mainGeom,
    new THREE.MeshStandardMaterial({
      color: mainColor,
      roughness: 0.82,
      flatShading: true,
    }),
  )
  main.castShadow = true
  clusterGroup.add(main)

  // 5-9 satellite blobs of varying size + color for a painterly look
  const satCount = 5 + Math.floor(rng() * 5)
  for (let i = 0; i < satCount; i++) {
    const dx = (rng() - 0.5) * baseR * 1.7
    const dy = (rng() - 0.5) * baseR * 1.25
    const dz = (rng() - 0.5) * baseR * 1.7
    const r = baseR * lerp(0.45, 0.85, rng())
    const blobColor = pickLeaf(rng, false)
    const blobGeom = new THREE.IcosahedronGeometry(r, 1)
    jitterGeom(blobGeom, r * 0.1, rng)
    const blob = new THREE.Mesh(
      blobGeom,
      new THREE.MeshStandardMaterial({
        color: blobColor,
        roughness: 0.85,
        flatShading: true,
      }),
    )
    blob.castShadow = true
    blob.position.set(dx, dy, dz)
    blob.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI)
    clusterGroup.add(blob)
  }

  // ===== BLOSSOMS — bloom in mid maturity, fade as fruit takes over =====
  const bloom = flowerAmount(g)
  if (bloom > 0) {
    const flowerCount = Math.round(lerp(1, 6, bloom) * (0.6 + rng() * 0.8))
    for (let i = 0; i < flowerCount; i++) {
      const dx = (rng() - 0.5) * baseR * 1.7
      const dy = (rng() - 0.5) * baseR * 1.3
      const dz = (rng() - 0.5) * baseR * 1.7
      addFlower(clusterGroup, dx, dy, dz, rng)
    }
  }

  // ===== FRUITS — start green, ripen yellow then red as the tree matures =====
  if (g > FRUIT_START) {
    // Overall fruit progress: 0 at FRUIT_START, 1 at full growth.
    const fruitProgress = (g - FRUIT_START) / (1 - FRUIT_START)
    const fruitCount = Math.round(lerp(1, 5, fruitProgress) * (0.7 + rng() * 0.7))
    for (let i = 0; i < fruitCount; i++) {
      // Per-fruit lag so the cluster ripens unevenly (more lifelike)
      const lag = rng() * 0.45
      const ripeness = clamp01((fruitProgress - lag * (1 - fruitProgress)) / Math.max(0.1, 1 - lag))
      const color = fruitColor(ripeness)
      const radius = lerp(0.038, 0.092, 0.4 + 0.6 * ripeness)
      const fruitMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.34,
        metalness: 0.05,
        emissive: color,
        emissiveIntensity: 0.08 + ripeness * 0.12,
      })
      const dx = (rng() - 0.5) * baseR * 1.4
      const dy = (rng() - 0.5) * baseR * 0.7 - baseR * 0.32
      const dz = (rng() - 0.5) * baseR * 1.4
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), fruitMat)
      fruit.position.set(dx, dy, dz)
      fruit.castShadow = true
      clusterGroup.add(fruit)
      // Stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.05, 4),
        new THREE.MeshStandardMaterial({ color: 0x4d2a12, roughness: 0.9 }),
      )
      stem.position.set(dx, dy + radius + 0.022, dz)
      clusterGroup.add(stem)
      // Tiny leaf next to ripe fruit (small green flick)
      if (ripeness > 0.65) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.022, 6, 4),
          new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7, flatShading: true }),
        )
        leaf.scale.set(1.8, 0.4, 0.9)
        leaf.position.set(dx + 0.024, dy + radius + 0.012, dz)
        leaf.rotation.z = -0.6
        clusterGroup.add(leaf)
      }
    }
  }

  clusters.push({ group: clusterGroup, phase: rng() * Math.PI * 2, amp: 0.7 + rng() * 0.6 })
}

function pickLeaf(rng: () => number, isMain: boolean): number {
  // Main blob biases toward mid-green; satellites can be lighter/darker; rare warm tint.
  if (!isMain && rng() < 0.07) return LEAF_HIGHLIGHT[Math.floor(rng() * LEAF_HIGHLIGHT.length)]
  if (isMain) {
    // Mid range of the palette
    return LEAF_PALETTE[3 + Math.floor(rng() * 4)]
  }
  return LEAF_PALETTE[Math.floor(rng() * LEAF_PALETTE.length)]
}

/** Blossom density curve: 0 below 0.32, peaks ~0.55, fades out by 0.88. */
function flowerAmount(g: number): number {
  if (g < 0.32 || g > 0.88) return 0
  if (g <= 0.55) return (g - 0.32) / (0.55 - 0.32)
  return Math.max(0, 1 - (g - 0.55) / (0.88 - 0.55))
}

/** Map ripeness 0..1 → green → yellow → red */
function fruitColor(ripeness: number): THREE.Color {
  const c = new THREE.Color()
  const t = clamp01(ripeness)
  if (t < 0.5) c.lerpColors(FRUIT_GREEN, FRUIT_YELLOW, t * 2)
  else c.lerpColors(FRUIT_YELLOW, FRUIT_RED, (t - 0.5) * 2)
  return c
}

function addFlower(parent: THREE.Group, x: number, y: number, z: number, rng: () => number) {
  const pink = rng() < 0.55
  const petalColor = pink ? 0xffc1dd : 0xfff5fb
  const petalMat = new THREE.MeshStandardMaterial({
    color: petalColor,
    roughness: 0.55,
    emissive: petalColor,
    emissiveIntensity: 0.1,
    flatShading: true,
  })
  const flower = new THREE.Group()
  flower.position.set(x, y, z)
  const petalR = 0.038
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2
    const petal = new THREE.Mesh(new THREE.SphereGeometry(petalR, 6, 5), petalMat)
    petal.scale.set(1.5, 0.5, 1)
    petal.position.set(Math.cos(a) * petalR * 1.25, 0, Math.sin(a) * petalR * 1.25)
    petal.rotation.y = a
    flower.add(petal)
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(petalR * 0.65, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.2 }),
  )
  flower.add(center)
  flower.rotation.x = -Math.PI / 2 + (rng() - 0.5) * 1.4
  flower.rotation.z = rng() * Math.PI * 2
  parent.add(flower)
}
