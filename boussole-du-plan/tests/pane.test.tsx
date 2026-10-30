import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'boussole-du-plan',
  component: 'Pane',
  requestId: 'boussole-du-plan',
  props: {
    title: 'Plan & météo',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
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
  on('command.register', () => ({ value: { command: 'plan-meteo' } }))
  on('ui.open', () => ({ value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'pas de panneau ici' } }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 160000, percent: 80 }, rateLimits: [] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'Refaire le panneau en plus joli', wait: false, origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
}

test('le panneau montre l’étape en cours et la météo', async ($, on) => {
  await start($, on, true)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Étape 2 sur 3/ }))?.text).toBe('Étape 2 sur 3')
  expect((await ui.find({ type: 'Text', text: /Écriture du mod/ }))?.text).toBe('▶ 2. Écriture du mod')
  expect((await ui.find({ type: 'Text', text: /Averses/ }))?.text).toBe('🌧️ Averses · 80%')
  await ui.unmount()

  for (const surface of ['desktop', 'mobile'] as const) {
    const drawn = await $.ui.mount({ ...PANE, surface })
    const [plan, meteo] = await drawn.findAll({ type: 'Svg' })
    expect(plan?.props.alt).toBe('Parcours du plan : 1 sur 3 faites, étape 2 en cours : Écrire le mod.')
    expect(String(plan?.props.source)).toContain('ÉTAPE 2 / 3')
    expect(String(plan?.props.source)).toContain('Refaire le panneau en plus')
    expect(String(plan?.props.source)).toContain('Écriture du mod')
    expect(String(meteo?.props.source)).toContain('AVERSES')
    expect(String(meteo?.props.source)).toContain('160k / 200k jetons')
    await drawn.unmount()
  }
})

test('sur mobile, /plan-meteo dessine les cartes dans sa sortie', async ($, on) => {
  await start($, on, false)
  const ran = await $.command.run({
    command: 'plan-meteo',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(ran.text).toContain('▶ 2. Écrire le mod')

  const row = await $.ui.mount({
    plugin: 'boussole-du-plan',
    component: 'CommandOutput',
    surface: 'mobile',
    props: { command: 'plan-meteo', args: '', text: ran.text ?? '', isErrored: false },
  })
  const [plan, meteo] = await row.findAll({ type: 'Svg' })
  expect(String(plan?.props.source)).toContain('ÉTAPE 2 / 3')
  expect(String(meteo?.props.source)).toContain('AVERSES')
  await row.unmount()
})
