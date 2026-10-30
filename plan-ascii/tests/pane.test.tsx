import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'plan-ascii',
  component: 'Pane',
  requestId: 'plan-ascii',
  props: {
    title: 'Plan ASCII',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const TODOS = [
  { content: 'Lire le code', status: 'completed', activeForm: 'Lecture du code' },
  { content: 'Écrire le mod', status: 'in_progress', activeForm: 'Écriture du mod' },
  { content: 'Tester', status: 'pending', activeForm: 'Test' },
] as { content: string; status: 'pending' | 'in_progress' | 'completed'; activeForm: string }[]

type Body = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>

const start = async ($: Parameters<Body>[0], on: Parameters<Body>[1], isPlaced: boolean) => {
  on('command.register', () => ({ value: { command: 'plan-ascii' } }))
  on('ui.open', () => ({ value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'pas de panneau ici' } }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 160000, percent: 80 }, rateLimits: [] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'Refaire le panneau', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
}

const run = (args: string) => ({
  command: 'plan-ascii',
  args,
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
}) as const

test('le panneau montre l’étape en cours puis le contexte, sur chaque surface', async ($, on) => {
  await start($, on, true)

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /PEGASE/ }))?.text).toContain('2. PEGASE')
    expect((await ui.find({ type: 'Text', text: /ETAPE 2 \/ 3/ }))?.text).toContain('ETAPE 2 / 3')
    expect((await ui.find({ type: 'Text', text: /Écrire le mod/ }))?.text).toContain('[>] 2. Écrire le mod')
    expect((await ui.find({ type: 'Text', text: /Averses/ }))?.text).toContain('80 %')
    await ui.unmount()
  }
})

test('/plan-ascii 3 demo dessine le démon avec le plan d’exemple, sur mobile', async ($, on) => {
  await start($, on, false)
  const ran = await $.command.run(run('3 demo'))
  expect(ran.text).toContain('Style 3. Demon')
  expect(ran.text).toContain('Tester sur l iPad')
  expect(ran.text).toContain('```')

  const row = await $.ui.mount({
    plugin: 'plan-ascii',
    component: 'CommandOutput',
    surface: 'mobile',
    props: { command: 'plan-ascii', args: '3 demo', text: ran.text ?? '', isErrored: false },
  })
  expect((await row.find({ type: 'Text', text: /Nuageux, 63 %/ }))?.text).toContain('Nuageux')
  await row.unmount()
})

test('chaque style se dessine, plan d’abord, contexte dessous', async ($, on) => {
  await start($, on, false)
  for (const style of ['1', '2', '3', '4', '5']) {
    const ran = await $.command.run(run(style))
    const text = ran.text ?? ''
    expect(text).toContain('2.')
    expect(text.indexOf('Écri')).toBeLessThan(text.lastIndexOf('160k / 200k'))
  }
})

test('/plan-ascii demo garde Pégase, pas le démon', async ($, on) => {
  await start($, on, false)
  const ran = await $.command.run(run('demo'))
  expect(ran.text).toContain('Style 2. Pegase')
  expect(ran.text).toContain('Tester sur l iPad')
  expect((await $.command.run(run(''))).text).toContain('Style 2. Pegase')
})
