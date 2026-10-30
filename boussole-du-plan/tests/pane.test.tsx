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

test('le panneau montre l’étape en cours et la météo', async ($, on) => {
  on('command.register', () => ({ value: { command: 'plan-meteo' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 160000, percent: 80 }, rateLimits: [] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Lire le code', status: 'completed', activeForm: 'Lecture du code' },
      { content: 'Écrire le mod', status: 'in_progress', activeForm: 'Écriture du mod' },
      { content: 'Tester', status: 'pending', activeForm: 'Test' },
    ],
  })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Étape 2 sur 3/ }))?.text).toBe('Étape 2 sur 3')
    expect((await ui.find({ type: 'Text', text: /Écriture du mod/ }))?.text).toBe('▶ 2. Écriture du mod')
    expect((await ui.find({ type: 'Text', text: /Averses/ }))?.text).toBe('🌧️ Averses · 80%')
    await ui.unmount()
  }
})
