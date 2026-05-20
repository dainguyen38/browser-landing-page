import { useEffect, useRef } from 'react'
import * as THREE from 'three'

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

const GREEN_PALETTE = [0x86efac, 0x4ade80, 0x22c55e, 0x16a34a, 0x15803d, 0x14532d]
const AUTUMN_PALETTE = [0xfde68a, 0xfca5a5, 0xfdba74, 0xf87171] // for fruits / accents

interface SceneRefs {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  treeGroup: THREE.Group
  branchHub: THREE.Group
  canopyGroup: THREE.Group
  ambient: THREE.AmbientLight
  hemi: THREE.HemisphereLight
  sun: THREE.DirectionalLight
  fill: THREE.PointLight
  stars: THREE.Points
  sun3d: THREE.Mesh
  moon3d: THREE.Mesh
  ground: THREE.Mesh
  grassTufts: THREE.Group
  // Per-cluster refs for wind sway
  clusters: { group: THREE.Group; phase: number; amp: number }[]
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
    scene.fog = new THREE.Fog(0x0a0a18, 9, 20)

    const camera = new THREE.PerspectiveCamera(35, w0 / h0, 0.1, 100)
    camera.position.set(0, 2.6, 6.8)
    camera.lookAt(0, 1.5, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w0, h0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // === Lighting ===
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a6741, 0.7)
    scene.add(hemi)
    const ambient = new THREE.AmbientLight(0xffffff, 0.25)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfffbeb, 1.3)
    sun.position.set(4, 7, 3)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -3
    sun.shadow.camera.right = 3
    sun.shadow.camera.top = 3
    sun.shadow.camera.bottom = -3
    sun.shadow.bias = -0.0008
    scene.add(sun)
    const fill = new THREE.PointLight(0x88aaff, 0.35, 14)
    fill.position.set(-3.5, 2.5, -2)
    scene.add(fill)

    // === Ground disc + soft shadow plate ===
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 48),
      new THREE.MeshStandardMaterial({ color: 0x4d7c2f, roughness: 0.95 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    scene.add(ground)
    // subtle darker patch under pot
    const shadowPatch = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }),
    )
    shadowPatch.rotation.x = -Math.PI / 2
    shadowPatch.position.y = 0.001
    scene.add(shadowPatch)

    // === Grass tufts around pot ===
    const grassTufts = new THREE.Group()
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      flatShading: true,
      side: THREE.DoubleSide,
      roughness: 0.9,
    })
    const tuftRng = seededRng(7)
    for (let i = 0; i < 22; i++) {
      const angle = tuftRng() * Math.PI * 2
      const r = 0.9 + tuftRng() * 1.4
      const h = 0.08 + tuftRng() * 0.12
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.05 + tuftRng() * 0.03, h, 4),
        grassMat,
      )
      tuft.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r)
      tuft.rotation.y = tuftRng() * Math.PI
      tuft.rotation.z = (tuftRng() - 0.5) * 0.25
      tuft.castShadow = true
      grassTufts.add(tuft)
    }
    scene.add(grassTufts)

    // === Pot (carved lathe shape for organic look) ===
    const potHeight = 0.6
    const potPoints: THREE.Vector2[] = []
    const potProfile = [
      [0.0, 0.0, 0.36],
      [0.0, 0.12, 0.5],
      [0.0, 0.45, 0.62],
      [0.0, 0.55, 0.66],
      [0.0, 0.6, 0.62],
    ]
    for (const [, y, r] of potProfile) {
      potPoints.push(new THREE.Vector2(r, y * potHeight))
    }
    const potGeom = new THREE.LatheGeometry(potPoints, 32)
    const potMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: false,
    })
    const pot = new THREE.Mesh(potGeom, potMat)
    pot.castShadow = true
    pot.receiveShadow = true
    scene.add(pot)
    // Inner rim shadow
    const innerShadow = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.62, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    )
    innerShadow.rotation.x = -Math.PI / 2
    innerShadow.position.y = potHeight - 0.02
    scene.add(innerShadow)
    // Soil top
    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 1 }),
    )
    soil.rotation.x = -Math.PI / 2
    soil.position.y = potHeight - 0.01
    scene.add(soil)

    // === Tree anchor groups ===
    const treeGroup = new THREE.Group()
    treeGroup.position.y = potHeight - 0.02
    scene.add(treeGroup)

    const branchHub = new THREE.Group() // contains trunk + branches; child of treeGroup
    treeGroup.add(branchHub)

    const canopyGroup = new THREE.Group() // contains foliage clusters; child of treeGroup
    treeGroup.add(canopyGroup)

    // === Stars (night) ===
    const starCount = 220
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 14 + Math.random() * 6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.5 + 0.05
      starPos[i * 3] = Math.cos(theta) * Math.sin(phi) * r
      starPos[i * 3 + 1] = Math.cos(phi) * r * 0.6 + 3.5
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
      new THREE.SphereGeometry(0.45, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xfde68a }),
    )
    sun3d.position.set(5.5, 5.5, -7)
    scene.add(sun3d)

    const moon3d = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xe5e7eb }),
    )
    moon3d.position.set(-5.5, 5, -7)
    scene.add(moon3d)

    // === Loop ===
    const clusters: SceneRefs['clusters'] = []
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
          (Math.sin(elapsed * 0.9 + c.phase) * 0.005 - (c.group.position.y - c.group.userData.baseY)) *
          0.1
      }

      // Trunk sway (very subtle)
      branchHub.rotation.z = Math.sin(elapsed * 0.35) * 0.012
      branchHub.rotation.x = Math.sin(elapsed * 0.27 + 1) * 0.008

      // Chop animation
      const chopT = chopRef.current
      if (chopT) {
        const since = (Date.now() - chopT) / 1000
        chopAnim = Math.min(1, since / 1.1)
        const angle = -Math.PI / 2 * easeInQuad(chopAnim)
        treeGroup.rotation.z = angle
        treeGroup.position.x = (1 - Math.cos(angle)) * 0.4
      } else if (chopAnim > 0) {
        chopAnim = Math.max(0, chopAnim - dt * 4)
        treeGroup.rotation.z = -Math.PI / 2 * easeInQuad(chopAnim)
        if (chopAnim === 0) {
          treeGroup.rotation.z = 0
          treeGroup.position.x = 0
        }
      }

      // Slow camera orbit
      const camA = elapsed * 0.07
      camera.position.x = Math.sin(camA) * 0.6
      camera.position.z = 6.8 + Math.cos(camA) * 0.25
      camera.lookAt(0, 1.5, 0)

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
      ambient,
      hemi,
      sun,
      fill,
      stars,
      sun3d,
      moon3d,
      ground,
      grassTufts,
      clusters,
      cleanup: () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
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
    buildTree(r.branchHub, r.canopyGroup, r.clusters, growth)
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
    r.ambient.intensity = 0.3
    r.hemi.intensity = 0.85
    r.hemi.color.setHex(0x9bd9ee)
    r.hemi.groundColor.setHex(0x4a6741)
    r.sun.intensity = 1.4
    r.sun.color.setHex(0xfffbeb)
    r.fill.intensity = 0.3
    r.fill.color.setHex(0xfde68a)
    ;(r.stars.material as THREE.PointsMaterial).opacity = 0
    r.sun3d.visible = true
    r.moon3d.visible = false
    ;(r.ground.material as THREE.MeshStandardMaterial).color.setHex(0x4d7c2f)
  } else {
    r.scene.background = new THREE.Color(0x0b1437)
    if (r.scene.fog instanceof THREE.Fog) r.scene.fog.color.setHex(0x05081a)
    r.ambient.intensity = 0.18
    r.hemi.intensity = 0.4
    r.hemi.color.setHex(0x4a6cff)
    r.hemi.groundColor.setHex(0x111827)
    r.sun.intensity = 0.55
    r.sun.color.setHex(0xb6c2ff)
    r.fill.intensity = 0.5
    r.fill.color.setHex(0x6366f1)
    ;(r.stars.material as THREE.PointsMaterial).opacity = 0.9
    r.sun3d.visible = false
    r.moon3d.visible = true
    ;(r.ground.material as THREE.MeshStandardMaterial).color.setHex(0x1a2e1f)
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

function buildTree(
  branchHub: THREE.Group,
  canopyGroup: THREE.Group,
  clusters: SceneRefs['clusters'],
  growth: number,
) {
  clearGroup(branchHub)
  clearGroup(canopyGroup)
  clusters.length = 0

  const g = Math.max(0, Math.min(1, growth))
  const rng = seededRng(13)

  // ===== SPROUT — special tiny render =====
  if (g < 0.05) {
    const t = g / 0.05
    const stemH = 0.18 + 0.2 * t
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.025, stemH, 6),
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
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09 + 0.04 * t, 12, 8), leafMat)
      leaf.scale.set(1.6, 0.4, 0.95)
      leaf.position.set(side * 0.12, stemH * 0.85, 0)
      leaf.rotation.z = side * 0.6
      leaf.castShadow = true
      branchHub.add(leaf)
    }
    return
  }

  // ===== TRUNK =====
  const trunkH = lerp(0.5, 2.8, g)
  const trunkRBottom = lerp(0.07, 0.3, g)
  const trunkRTop = trunkRBottom * 0.55

  const trunkGeom = new THREE.CylinderGeometry(trunkRTop, trunkRBottom, trunkH, 12, 6)
  // Subtle bend + bark roughness via vertex displacement
  const pos = trunkGeom.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const tNorm = (y + trunkH / 2) / trunkH
    // gentle S-curve bend
    const bend = Math.sin(tNorm * 1.6) * 0.06 * g
    // bark noise
    const r = Math.hypot(x, z)
    const noise = (Math.sin(y * 20) * Math.cos(Math.atan2(z, x) * 5) * 0.018) * (0.4 + g * 0.6)
    pos.setX(i, x + (x / (r || 1)) * noise + bend)
    pos.setZ(i, z + (z / (r || 1)) * noise)
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
    flatShading: false,
  })
  const trunk = new THREE.Mesh(trunkGeom, trunkMat)
  trunk.position.y = trunkH / 2
  trunk.castShadow = true
  trunk.receiveShadow = true
  branchHub.add(trunk)

  // ===== BRANCHES (recursive procedural) =====
  // Each terminal recursion point spawns a foliage cluster.
  const branchMat = trunkMat.clone()

  const branchEnds: { pos: THREE.Vector3; size: number }[] = []
  const branchOrigin = new THREE.Vector3(0, trunkH, 0)
  const upDir = new THREE.Vector3(0, 1, 0)

  // Number of main branches scales with growth
  const mainBranchCount = g < 0.15 ? 1 : g < 0.35 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(g * 4)
  const maxDepth = g < 0.35 ? 1 : g < 0.7 ? 2 : 3

  // Top-of-trunk also has a foliage cluster
  branchEnds.push({ pos: branchOrigin.clone().add(new THREE.Vector3(0, lerp(0.1, 0.4, g), 0)), size: 1 })

  for (let i = 0; i < mainBranchCount; i++) {
    const yaw = (i / mainBranchCount) * Math.PI * 2 + rng() * 0.35
    const pitch = lerp(0.45, 0.95, rng()) // from vertical
    const dir = new THREE.Vector3(
      Math.sin(pitch) * Math.cos(yaw),
      Math.cos(pitch),
      Math.sin(pitch) * Math.sin(yaw),
    )
    const length = lerp(0.3, 1.0, g) * (0.8 + rng() * 0.4)
    const radius = trunkRTop * (0.45 + rng() * 0.15)
    growBranch(branchHub, branchMat, branchOrigin, dir, length, radius, 0, maxDepth, rng, branchEnds, g)
  }

  // ===== FOLIAGE CLUSTERS at branch tips =====
  for (const end of branchEnds) {
    addFoliageCluster(canopyGroup, end.pos, end.size, g, rng, clusters)
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
  branchEnds: { pos: THREE.Vector3; size: number }[],
  g: number,
) {
  const end = origin.clone().add(dir.clone().multiplyScalar(length))

  // Branch mesh aligned with direction
  const geom = new THREE.CylinderGeometry(radius * 0.55, radius, length, 7)
  geom.translate(0, length / 2, 0) // base at origin going up Y
  const branch = new THREE.Mesh(geom, branchMat)
  branch.castShadow = true
  // orient Y axis to dir
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  )
  branch.quaternion.copy(q)
  branch.position.copy(origin)
  parent.add(branch)

  if (depth >= maxDepth || length < 0.18) {
    branchEnds.push({ pos: end, size: lerp(0.55, 1, length / 1.2) })
    return
  }

  // Spawn 2 sub-branches diverging from the tip
  const childCount = depth === 0 ? 2 : 1 + Math.floor(rng() * 2)
  for (let i = 0; i < childCount; i++) {
    // Build local frame: dir is "up"; pick perpendicular axes
    const upRef =
      Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const sideA = new THREE.Vector3().crossVectors(dir, upRef).normalize()
    const sideB = new THREE.Vector3().crossVectors(dir, sideA).normalize()

    const yawA = ((i + 0.5) / childCount) * Math.PI * 2 + rng() * 0.4
    const splay = lerp(0.4, 0.65, rng()) // deviation from parent direction
    const childDir = dir
      .clone()
      .multiplyScalar(Math.cos(splay))
      .add(sideA.multiplyScalar(Math.sin(splay) * Math.cos(yawA)))
      .add(sideB.multiplyScalar(Math.sin(splay) * Math.sin(yawA)))
      .normalize()

    const childLen = length * lerp(0.55, 0.85, rng())
    const childR = radius * lerp(0.55, 0.7, rng())
    growBranch(parent, branchMat, end, childDir, childLen, childR, depth + 1, maxDepth, rng, branchEnds, g)
  }
}

function addFoliageCluster(
  canopyGroup: THREE.Group,
  center: THREE.Vector3,
  sizeMul: number,
  g: number,
  rng: () => number,
  clusters: SceneRefs['clusters'],
) {
  const clusterGroup = new THREE.Group()
  clusterGroup.position.copy(center)
  clusterGroup.userData.baseY = center.y
  canopyGroup.add(clusterGroup)

  const baseR = lerp(0.18, 0.6, g) * sizeMul

  // Main blob — large icosahedron
  const mainColor = GREEN_PALETTE[Math.floor(rng() * GREEN_PALETTE.length)]
  const main = new THREE.Mesh(
    new THREE.IcosahedronGeometry(baseR, 1),
    new THREE.MeshStandardMaterial({
      color: mainColor,
      roughness: 0.82,
      flatShading: true,
    }),
  )
  main.castShadow = true
  clusterGroup.add(main)

  // 3–5 satellite blobs
  const satCount = 3 + Math.floor(rng() * 3)
  for (let i = 0; i < satCount; i++) {
    const dx = (rng() - 0.5) * baseR * 1.6
    const dy = (rng() - 0.5) * baseR * 1.2
    const dz = (rng() - 0.5) * baseR * 1.6
    const r = baseR * lerp(0.5, 0.85, rng())
    const blobColor = GREEN_PALETTE[Math.floor(rng() * GREEN_PALETTE.length)]
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 0),
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

  // Fruits / blossoms on mature trees
  if (g > 0.65 && rng() < 0.7) {
    const fruitColor = AUTUMN_PALETTE[Math.floor(rng() * AUTUMN_PALETTE.length)]
    const fruitMat = new THREE.MeshStandardMaterial({
      color: fruitColor,
      roughness: 0.5,
      metalness: 0.1,
    })
    const fruitCount = 1 + Math.floor(rng() * 3)
    for (let i = 0; i < fruitCount; i++) {
      const dx = (rng() - 0.5) * baseR * 1.2
      const dy = (rng() - 0.5) * baseR * 0.6 - baseR * 0.3
      const dz = (rng() - 0.5) * baseR * 1.2
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), fruitMat)
      fruit.position.set(dx, dy, dz)
      fruit.castShadow = true
      clusterGroup.add(fruit)
    }
  }

  clusters.push({ group: clusterGroup, phase: rng() * Math.PI * 2, amp: 0.7 + rng() * 0.6 })
}
