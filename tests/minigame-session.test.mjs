import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Exercise the real widget's callbacks and portal lifecycle without a browser or extra dependencies.
const source = readFileSync(new URL('../src/components/widgets/MinigameWidget.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('widget.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const imports = ast.statements.filter(ts.isImportDeclaration)
const names = imports.flatMap((node) => node.importClause?.namedBindings?.elements?.map((entry) => entry.name.text) ?? [])
const body = source.slice(imports.at(-1).end)
const { outputText } = ts.transpileModule(
  `const React = globalThis.__gameHarness.React; const { ${names.join(', ')} } = globalThis.__gameHarness; ${body}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } },
)

function element(type, props, ...children) { return { type, props: { ...props, children } } }
function fakeNode() {
  return {
    parent: null, children: [], inert: false, focus() {},
    appendChild(child) {
      if (child.parent) child.parent.children = child.parent.children.filter((item) => item !== child)
      child.parent = this
      this.children.push(child)
    },
  }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}

test('Esc pauses then closes; all seven games retain the same portal and session on reopening', async () => {
  const slots = []
  let cursor = 0
  let effects = []
  const mocks = Object.fromEntries(names.map((name) => [name, name]))
  Object.assign(mocks, {
    React: { createElement: element },
    useT: () => ({ t: (key) => key }),
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) {
      const i = cursor++
      return slots[i] ??= { current: initial }
    },
    useLayoutEffect(callback, deps) {
      const i = cursor++
      if (!slots[i] || deps.some((value, index) => value !== slots[i][index])) effects.push(callback)
      slots[i] = deps
    },
    GameSessionContext: { Provider: 'Provider' },
    createPortal: (children, container, key) => ({ type: 'portal', props: { children, container, key } }),
  })
  globalThis.__gameHarness = mocks
  globalThis.document = { createElement: fakeNode, getElementById: () => null }
  const { MinigameWidget } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
  let tree
  function render() {
    cursor = 0
    effects = []
    tree = MinigameWidget()
    function mount(node, visible = true) {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { node.forEach((entry) => mount(entry, visible)); return }
      if (node.type === mocks.Dialog) visible &&= node.props.open
      if (node.props?.ref) {
        node.props.ref.current = visible ? node.props.ref.current ?? fakeNode() : null
      }
      mount(node.props?.children, visible)
    }
    mount(tree)
    effects.forEach((effect) => effect())
  }
  const find = (predicate) => nodes(tree).find(predicate)
  const dialog = () => find((node) => node.type === mocks.Dialog)
  const content = () => find((node) => node.type === mocks.DialogContent)
  const portal = (key) => find((node) => node.type === 'portal' && node.props.key === key)
  function open(key) {
    find((node) => node.props?.def?.key === key).props.onPlay()
    render()
  }
  function escape(repeat = false) {
    let prevented = false
    content().props.onEscapeKeyDown({ repeat, preventDefault: () => { prevented = true } })
    if (!prevented) dialog().props.onOpenChange(false)
    render()
    return prevented
  }
  render()
  const keys = ['snake', 'flappy', 'tetris', 'sudoku', 'goldminer', 'dino', 'g2048']
  const saved = new Map()
  for (const key of keys) {
    open(key)
    const target = portal(key).props.container
    const control = portal(key).props.children.props.value
    saved.set(key, { target, control })
    assert.equal(control.paused, false)
    assert.equal(control.visible, true)
    const visibleHost = target.parent
    assert.equal(escape(), true)
    assert.equal(control.paused, true)
    assert.equal(dialog().props.open, true)
    assert.equal(target.parent, visibleHost)
    assert.equal(visibleHost.inert, true)
    assert.equal(escape(true), true, 'Holding Esc must not close the popup')
    assert.equal(dialog().props.open, true)
    assert.equal(escape(), false)
    assert.equal(dialog().props.open, false)
    assert.equal(control.visible, false)
    assert.notEqual(target.parent, visibleHost)
  }
  for (const key of keys) {
    open(key)
    const { target, control } = saved.get(key)
    assert.equal(portal(key).props.container, target)
    assert.equal(portal(key).props.children.props.value, control)
    assert.equal(control.paused, true)
    find((node) => node.type === mocks.Button && nodes(node).some((child) => child.props?.children?.includes('minigame.resume'))).props.onClick()
    render()
    assert.equal(control.paused, false)
    assert.equal(target.parent.inert, false)
    for (const [other, session] of saved) {
      if (other !== key) {
        assert.equal(session.control.paused, true)
        assert.equal(session.control.visible, false)
      }
    }
    dialog().props.onOpenChange(false)
    render()
    assert.equal(control.paused, true, 'Closing with X must pause too')
  }
  delete globalThis.__gameHarness
  delete globalThis.document
})
