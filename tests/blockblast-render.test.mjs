import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { Matrix4, Vector3 } from 'three'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const temp = mkdtempSync(join(root, '.blast-render-tests-'))
after(() => rmSync(temp, { recursive: true, force: true }))
const output = join(temp, 'scene.mjs')
await build({
  stdin: { contents: "export * from './src/lib/blockblast/scene'; export * from './src/lib/blockblast/layout'; export * from './src/lib/blockblast/effects'; export * from './src/lib/blockblast/projection'; export * from './src/lib/blockblast/styles'", resolveDir: root, loader: 'ts' },
  outfile: output, bundle: true, packages: 'external', platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'gpu-boundary', setup(build) {
    build.onLoad({ filter: /blockblast\/scene\.ts$/ }, ({ path }) => ({
      contents: readFileSync(path, 'utf8').replace('new WebGLRenderer(', 'new globalThis.MockBlastRenderer('), loader: 'ts',
    }))
  } }],
})
const { createBlastScene, blastLayout, makeDebris, advanceDebris, MAX_DEBRIS, boardToScreen, screenToBoard, boardCanvasMatrix, DEFAULT_VIEW, BLOCK_STYLES, ENVIRONMENTS } = await import(pathToFileURL(output).href)
let rendered
class MockRenderer {
  shadowMap = {}
  sizes = []
  constructor() { rendered = this }
  setPixelRatio(ratio) { this.ratio = ratio }
  setClearColor() {}
  setSize(...args) { this.sizes.push(args) }
  render(scene, camera) { this.scene = scene; this.camera = camera }
  dispose() { this.disposed = true }
  forceContextLoss() { this.released = true }
}
globalThis.MockBlastRenderer = MockRenderer
globalThis.window = { devicePixelRatio: 3, matchMedia: () => ({ matches: true }) }
after(() => { delete globalThis.MockBlastRenderer; delete globalThis.window })
function canvas() {
  const listeners = new Map()
  return { listeners, addEventListener: (key, fn) => listeners.set(key,fn), removeEventListener: (key) => listeners.delete(key) }
}

test('3D blocks project onto the exact logical cells after portrait and landscape resize', () => {
  const host = canvas()
  const scene = createBlastScene(host, () => {})
  assert.equal(rendered.ratio, 1.5)
  for (const [width,height] of [[351,625],[780,337],[1400,900]]) {
    const layout = blastLayout(width,height)
    const blocks = [{ x: layout.x + layout.cell*2, y: layout.y + layout.cell*3, size: layout.cell, color:'#52a8ff', alpha:1, space:'board' }]
    scene.draw(layout, blocks, [])
    const mesh = rendered.scene.children.find((child) => child.isInstancedMesh && child.material.isMeshPhysicalMaterial)
    assert.equal(mesh.count,1)
    const matrix = new Matrix4()
    mesh.getMatrixAt(0,matrix)
    rendered.camera.updateMatrixWorld()
    const pixel = new Vector3().setFromMatrixPosition(matrix).project(rendered.camera)
    const expected = boardToScreen(layout, blocks[0].x+layout.cell/2, blocks[0].y+layout.cell/2, layout.cell*.23)
    assert.ok(Math.abs((pixel.x+1)*width/2 - expected.x) < 1e-4)
    assert.ok(Math.abs((1-pixel.y)*height/2 - expected.y) < 1e-4)
    assert.ok(Math.abs(matrix.elements[1]) > .1, 'board must be diagonal, not front facing')
    assert.ok(new Vector3().setFromMatrixScale(matrix).z > 0)
  }
  assert.equal(rendered.sizes.length,3)
  scene.dispose()
})

test('all rotated and zoomed cells and drag anchors round-trip through the rendered projection', () => {
  const host=canvas(), scene=createBlastScene(host,()=>{})
  for(const [width,height] of [[296,500],[780,337],[2483,915]]) for(const yaw of [-3.5,-.785,0,1.2,2.3]) for(const tilt of [35,55,65]) for(const zoom of [.6,1]) {
    const layout=blastLayout(width,height,{yaw,tilt:tilt*Math.PI/180,zoom})
    for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
      const screen=boardToScreen(layout,layout.x+(x+.5)*layout.cell,layout.y+(y+.5)*layout.cell)
      const picked=screenToBoard(layout,screen.x,screen.y)
      assert.equal(Math.floor((picked.x-layout.x)/layout.cell),x)
      assert.equal(Math.floor((picked.y-layout.y)/layout.cell),y)
      const [a,b,c,d,e,f]=boardCanvasMatrix(layout)
      assert.ok(Math.abs(a*picked.x+c*picked.y+e-screen.x)<1e-8)
      assert.ok(Math.abs(b*picked.x+d*picked.y+f-screen.y)<1e-8)
    }
    for(const [w,h] of [[1,1],[5,1],[1,5],[3,3]]) {
      const x=2,y=1
      const screen=boardToScreen(layout,layout.x+(x+w/2)*layout.cell,layout.y+(y+h/2)*layout.cell)
      const picked=screenToBoard(layout,screen.x,screen.y)
      assert.equal(Math.round((picked.x-layout.x)/layout.cell-w/2),x)
      assert.equal(Math.round((picked.y-layout.y)/layout.cell-h/2),y)
    }
    const block={x:layout.x+2*layout.cell,y:layout.y+3*layout.cell,size:layout.cell,color:'#52a8ff',alpha:1,space:'board'}
    scene.draw(layout,[block],[])
    const mesh=rendered.scene.children.find(child=>child.isInstancedMesh && child.material.isMeshPhysicalMaterial)
    const matrix=new Matrix4(); mesh.getMatrixAt(0,matrix); rendered.camera.updateMatrixWorld()
    const pixel=new Vector3().setFromMatrixPosition(matrix).project(rendered.camera)
    const expected=boardToScreen(layout,block.x+layout.cell/2,block.y+layout.cell/2,layout.cell*.23)
    assert.ok(Math.abs((pixel.x+1)*width/2-expected.x)<.001)
    assert.ok(Math.abs((1-pixel.y)*height/2-expected.y)<.001)
  }
  scene.dispose()
})
test('orbit keeps projected cell lengths, angles, area and center unchanged for a full revolution', () => {
  const layout=blastLayout(1200,800)
  const points=[[0,0],[1,0],[0,1],[8,8],[0,8],[8,0]]
  const reference=points.map(([x,y])=>boardToScreen(layout,layout.x+x*layout.cell,layout.y+y*layout.cell))
  const cx=layout.x+4*layout.cell,cy=layout.y+4*layout.cell
  const host=canvas(),scene=createBlastScene(host,()=>{})
  for(let angle=-Math.PI*1.25;angle<=Math.PI*.75;angle+=Math.PI/36) {
    const rotated=blastLayout(1200,800,{...DEFAULT_VIEW,yaw:angle})
    assert.equal(rotated.cell,layout.cell)
    assert.deepEqual(boardToScreen(rotated,cx,cy),{x:cx,y:cy})
    const pixels=points.map(([x,y])=>boardToScreen(rotated,rotated.x+x*rotated.cell,rotated.y+y*rotated.cell))
    for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
      const expected=Math.hypot(reference[i].x-reference[j].x,reference[i].y-reference[j].y)
      const actual=Math.hypot(pixels[i].x-pixels[j].x,pixels[i].y-pixels[j].y)
      assert.ok(Math.abs(actual-expected)<1e-8,'rigid rotation must preserve every projected distance')
    }
    const [a,b,c,d]=boardCanvasMatrix(rotated),[ra,rb,rc,rd]=boardCanvasMatrix(layout)
    assert.ok(Math.abs((a*d-b*c)-(ra*rd-rb*rc))<1e-12,'grid area must not compress or stretch')
    scene.draw(rotated,[{x:rotated.x,y:rotated.y,size:rotated.cell,color:'#52a8ff',alpha:1,space:'board'}],[])
    const mesh=rendered.scene.children.find(child=>child.isInstancedMesh && child.material.isMeshPhysicalMaterial)
    const matrix=new Matrix4(); mesh.getMatrixAt(0,matrix)
    const scale=new Vector3().setFromMatrixScale(matrix)
    assert.ok(Math.abs(scale.x-scale.y)<1e-4,'3D square faces retain equal sides')
  }
  scene.dispose()
})

test('all six block styles and environments change live without rebuilding the renderer', () => {
  const host=canvas(), scene=createBlastScene(host,()=>{}), layout=blastLayout(1200,800)
  const renderer=rendered
  assert.ok(BLOCK_STYLES.length>=5 && ENVIRONMENTS.length>=5)
  const geometries=new Set(), surfaces=new Set()
  for(let i=0;i<BLOCK_STYLES.length;i++) {
    scene.draw(layout,[{x:layout.x,y:layout.y,size:layout.cell,color:'#52a8ff',alpha:1,space:'board'}],[],i,i)
    const mesh=rendered.scene.children.find(child=>child.isInstancedMesh && child.material.isMeshPhysicalMaterial)
    geometries.add(mesh.geometry)
    surfaces.add([mesh.material.roughness,mesh.material.metalness,mesh.material.clearcoat,mesh.material.emissiveIntensity].join(','))
    const plate=rendered.scene.children.find(child=>child.isMesh && !child.isInstancedMesh)
    assert.equal(plate.material.color.getHexString(),ENVIRONMENTS[i].floor.slice(1))
    assert.equal(rendered,renderer)
  }
  assert.equal(geometries.size,BLOCK_STYLES.length)
  assert.equal(surfaces.size,BLOCK_STYLES.length)
  scene.dispose()
})

test('bounded 3D debris rises, falls and expires while zero delta keeps paused effects unchanged', () => {
  const cells = Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),color:1}))
  const before = structuredClone(cells)
  let particles = makeDebris(cells,{x:20,y:120,cell:40},['#52a8ff'],()=>.5)
  assert.ok(particles.length<=MAX_DEBRIS)
  assert.deepEqual(cells,before)
  const snapshot = structuredClone(particles)
  particles = advanceDebris(particles,0,40)
  assert.deepEqual(particles,snapshot)
  const startZ=particles[0].z
  particles=advanceDebris(particles,.04,40)
  assert.ok(particles[0].z>startZ)
  for(let i=0;i<30;i++) particles=advanceDebris(particles,.04,40)
  assert.equal(particles.length,0)
})

test('context loss selects fallback, and teardown releases shared GPU resources once', () => {
  const host=canvas()
  let fallback=0, prevented=false
  const scene=createBlastScene(host,()=>fallback++)
  scene.draw(blastLayout(351,625),[],[])
  const meshes=rendered.scene.children.filter((child)=>child.isMesh)
  const geometries=new Set(meshes.map((mesh)=>mesh.geometry))
  const materials=new Set(meshes.map((mesh)=>mesh.material))
  let releasedGeometry=0, releasedMaterial=0
  for(const geometry of geometries) geometry.addEventListener('dispose',()=>releasedGeometry++)
  for(const material of materials) material.addEventListener('dispose',()=>releasedMaterial++)
  host.listeners.get('webglcontextlost')({preventDefault(){prevented=true}})
  assert.equal(fallback,1); assert.equal(prevented,true)
  scene.dispose(); scene.dispose()
  assert.equal(releasedGeometry,geometries.size)
  assert.equal(releasedMaterial,materials.size)
  assert.equal(rendered.disposed,true); assert.equal(rendered.released,true)
  assert.equal(host.listeners.size,0)
})
