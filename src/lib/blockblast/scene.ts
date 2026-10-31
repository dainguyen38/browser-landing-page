import { BLOCK_STYLES, ENVIRONMENTS } from './styles'
import {
  ACESFilmicToneMapping, Color, DirectionalLight, DynamicDrawUsage, HemisphereLight,
  InstancedMesh, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, Matrix4,
  OrthographicCamera, PCFShadowMap, Scene, WebGLRenderer, BoxGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { BOARD_SCALE, BOARD_TILT, DEFAULT_VIEW } from './projection'
import type { blastLayout } from './layout'
import { MAX_DEBRIS, type Debris } from './effects'

export type RenderBlock = { x: number; y: number; size: number; color: string; alpha: number; space?: 'board' | 'screen' }
export type BlastScene = ReturnType<typeof createBlastScene>

export function createBlastScene(canvas: HTMLCanvasElement, onLost: () => void) {
  const mobile = window.matchMedia('(pointer: coarse)').matches
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'default' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 3000)
  camera.position.z = 1500
  scene.add(new HemisphereLight(0xdfeeff, 0x35305d, 2.2))
  const sun = new DirectionalLight(0xffffff, 3.4)
  sun.position.set(-300, 500, 800)
  sun.castShadow = true
  sun.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024)
  sun.shadow.camera.near = .1; sun.shadow.camera.far = 2500
  sun.shadow.normalBias = .3; sun.shadow.bias = -.00015
  scene.add(sun)
  const rim = new DirectionalLight(0xada7ff, 2)
  rim.position.set(350, -200, 250)
  scene.add(rim)
  const geometry = new RoundedBoxGeometry(1, 1, 1, 2, .12)
  const styleGeometries = BLOCK_STYLES.map((style) => style.radius
    ? new RoundedBoxGeometry(1,1,1,2,style.radius) : new BoxGeometry(1,1,1))
  const debrisGeometry = new BoxGeometry(1, 1, 1)
  const material = new MeshPhysicalMaterial({ color: 0xffffff, roughness: .25, metalness: .18, clearcoat: .8, clearcoatRoughness: .2 })
  const styleUniform = { value: 0 }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.blastStyle = styleUniform
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 blastLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nblastLocal = position;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float blastStyle; varying vec3 blastLocal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (blastStyle > 2.5 && blastStyle < 3.5) {
          float grain = .9 + .1 * sin((blastLocal.x + .04 * sin(blastLocal.y * 20.)) * 90.);
          diffuseColor.rgb *= vec3(1., .82, .58) * grain;
        } else if (blastStyle > 1.5 && blastStyle < 2.5) {
          float edge = max(abs(blastLocal.x), abs(blastLocal.y));
          diffuseColor.rgb *= mix(.4, 1.7, smoothstep(.32, .46, edge));
        } else if (blastStyle > 4.5) {
          diffuseColor.rgb *= .9 + .1 * sin(blastLocal.y * 240.);
        }
      `)
  }
  const previewMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .35, transparent: true, opacity: .45, depthWrite: false })
  const debrisMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .32, metalness: .15 })
  const floorMaterial = new MeshStandardMaterial({ color: 0x111c35, roughness: .7, metalness: .2 })
  const socketMaterial = new MeshStandardMaterial({ color: 0x202d48, roughness: .65 })
  const plate = new Mesh(geometry, floorMaterial)
  plate.receiveShadow = true
  scene.add(plate)
  const makeBatch = (count: number, mat: MeshStandardMaterial, geo = geometry) => {
    const batch = new InstancedMesh(geo, mat, count)
    batch.instanceMatrix.setUsage(DynamicDrawUsage)
    batch.count = 0
    // The batches span the whole screen and change every frame, including airborne debris.
    batch.frustumCulled = false
    scene.add(batch)
    return batch
  }
  const solids = makeBatch(128, material)
  solids.castShadow = true; solids.receiveShadow = true
  const previews = makeBatch(64, previewMaterial)
  const debris = makeBatch(MAX_DEBRIS, debrisMaterial, debrisGeometry)
  const sockets = makeBatch(64, socketMaterial)
  sockets.receiveShadow = true
  const dummy = new Object3D(), color = new Color()
  const map = new Matrix4(), mapRotation = new Matrix4()
  const mapBase = new Matrix4().makeRotationX(-BOARD_TILT)
    .multiply(new Matrix4().makeRotationZ(DEFAULT_VIEW.yaw))
    .multiply(new Matrix4().makeScale(BOARD_SCALE, BOARD_SCALE, BOARD_SCALE))
  let previousStyle = -1, previousEnvironment = -1
  plate.matrixAutoUpdate = false
  let width = 0, height = 0, disposed = false
  const lost = (event: Event) => { event.preventDefault(); onLost() }
  canvas.addEventListener('webglcontextlost', lost)

  return {
    draw(layout: ReturnType<typeof blastLayout>, blocks: RenderBlock[], particles: Debris[], styleIndex = 0, environmentIndex = 0) {
      if (disposed || !layout.width || !layout.height) return
      if (width !== layout.width || height !== layout.height) {
        width = layout.width; height = layout.height
        renderer.setSize(width, height, false)
        camera.left = -width / 2; camera.right = width / 2
        camera.top = height / 2; camera.bottom = -height / 2
        camera.position.z = Math.max(width,height)*4
        camera.far = camera.position.z*2
        camera.updateProjectionMatrix()
        sun.position.set(-width*.4,height*.7,Math.max(width,height)*1.6)
        const shadowCamera = sun.shadow.camera
        shadowCamera.far = Math.max(width,height)*8
        shadowCamera.left = -width; shadowCamera.right = width
        shadowCamera.top = height; shadowCamera.bottom = -height
        shadowCamera.updateProjectionMatrix()
      }
      const profile = BLOCK_STYLES[styleIndex] ?? BLOCK_STYLES[0]
      if (previousStyle !== styleIndex) {
        solids.geometry = styleGeometries[styleIndex] ?? styleGeometries[0]
        previews.geometry = solids.geometry
        material.roughness = profile.roughness; material.metalness = profile.metalness
        material.clearcoat = profile.coat; material.emissive.set('#899dff'); material.emissiveIntensity = profile.emissive
        previewMaterial.roughness = profile.roughness; previewMaterial.metalness = profile.metalness
        styleUniform.value = styleIndex
        material.needsUpdate = true
        previousStyle = styleIndex
      }
      if (previousEnvironment !== environmentIndex) {
        const environment = ENVIRONMENTS[environmentIndex] ?? ENVIRONMENTS[0]
        floorMaterial.color.set(environment.floor); socketMaterial.color.set(environment.socket)
        rim.color.set(environment.light)
        previousEnvironment = environmentIndex
      }
      const cx = layout.x + layout.cell * 4, cy = layout.y + layout.cell * 4
      mapRotation.makeRotationZ(layout.yaw-DEFAULT_VIEW.yaw).multiply(mapBase)
      map.copy(mapRotation).setPosition(cx - width / 2, height / 2 - cy, 0)
      const set = (batch: InstancedMesh, i: number, x: number, y: number, z: number, w: number, h: number, depth: number, hex?: string, rotation = 0, board = false) => {
        dummy.position.set(board ? x - cx : x - width / 2, board ? cy - y : height / 2 - y, z)
        dummy.rotation.set(rotation * .7, rotation * .5, rotation)
        dummy.scale.set(w, h, depth)
        dummy.updateMatrix()
        if (board) dummy.matrix.premultiply(map)
        batch.setMatrixAt(i, dummy.matrix)
        if (hex) batch.setColorAt(i, color.set(hex))
      }
      const cell = layout.cell
      dummy.position.set(0, 0, -cell * .2)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(cell * 8 + 16, cell * 8 + 16, Math.max(4, cell * .3))
      dummy.updateMatrix()
      plate.matrix.multiplyMatrices(map, dummy.matrix)
      plate.matrixWorldNeedsUpdate = true
      let socketIndex = 0
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        set(sockets, socketIndex++, layout.x + (x + .5) * cell, layout.y + (y + .5) * cell, -cell * .04, cell * .93, cell * .93, cell * .08, undefined, 0, true)
      }
      sockets.count = socketIndex
      let solidIndex = 0, previewIndex = 0
      for (const b of blocks) {
        const preview = b.alpha < .9
        const batch = preview ? previews : solids
        const i = preview ? previewIndex++ : solidIndex++
        const lifted = b.alpha === .9
        set(batch, i, b.x + b.size / 2, b.y + b.size / 2, b.size * (lifted ? .8 : profile.depth/2+.02), b.size * .88, b.size * .88, b.size * profile.depth, b.color, 0, b.space === 'board')
      }
      solids.count = solidIndex; previews.count = previewIndex
      const count = Math.min(particles.length, MAX_DEBRIS)
      for (let i = 0; i < count; i++) {
        const p = particles[i]
        const size = p.size * Math.min(1, Math.max(0, p.life) / .25)
        set(debris, i, p.x, p.y, p.z, size, size, size, p.color, p.angle, true)
      }
      debris.count = count
      for (const batch of [solids, previews, debris, sockets]) {
        batch.instanceMatrix.needsUpdate = true
        if (batch.instanceColor) batch.instanceColor.needsUpdate = true
      }
      renderer.render(scene, camera)
    },
    dispose() {
      if (disposed) return
      disposed = true
      canvas.removeEventListener('webglcontextlost', lost)
      for (const batch of [solids, previews, debris, sockets]) batch.dispose()
      geometry.dispose(); debrisGeometry.dispose()
      for (const geo of styleGeometries) geo.dispose()
      for (const mat of [material, previewMaterial, debrisMaterial, floorMaterial, socketMaterial]) mat.dispose()
      sun.shadow.dispose()
      scene.clear()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
