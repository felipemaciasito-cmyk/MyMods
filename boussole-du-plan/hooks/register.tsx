import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ContextFill, Step, StepStatus } from '../types'
import { CARD_WIDTH, COMPACT_AT, planCard, weatherCard, weatherOf } from './cards'

const PANE = 'boussole-du-plan'
const TITLE = 'Plan & météo'
// Change the tag when a value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const steps = atom({ plugin: 'boussole-du-plan', key: 'steps' } as const, [], {
  shape: 'steps-2',
})
const context = atom(
  { plugin: 'boussole-du-plan', key: 'context' } as const,
  { window: 0 },
  { shape: 'context-2' },
)
const topic = atom({ plugin: 'boussole-du-plan', key: 'topic' } as const, {}, { shape: 'topic-1' })

const MARK: Record<StepStatus, string> = {
  completed: '✓',
  in_progress: '▶',
  pending: '○',
}

const kilo = (n: number) => `${Math.round(n / 1000)}k`

const gauge = (percent: number, width: number) => {
  const full = Math.round((Math.min(100, percent) / 100) * width)

  return '█'.repeat(full) + '░'.repeat(width - full)
}

// The weather as one short line beside the prompt, redrawn on each measure.
const showWeather = ($: EngineInterface, fill: ContextFill) => {
  const weather = weatherOf(fill.percent)
  $.ui.status(weather === undefined ? undefined : `${weather.icon} ${fill.percent}% · ${weather.label}`)
}

// Keeps a new fill, and the last ones for the trend bars.
const measure = async ($: EngineInterface, fill: ContextFill) => {
  await update($, context, old => {
    const history = old.history ?? []
    const percent = fill.percent

    return {
      ...fill,
      history:
        percent === undefined || history[history.length - 1] === percent
          ? history
          : [...history, percent].slice(-8),
    }
  })
  showWeather($, fill)
}

// A plan starting: name it after what the person last asked.
const nameThePlan = async ($: EngineInterface, before: readonly Step[]) => {
  if (before.length > 0) return
  await update($, topic, old => ({ ...old, title: old.lastPrompt }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'plan-meteo',
      description: 'Ouvre le panneau du plan et de la météo du contexte',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    const ran = await next(e)
    const usage = await $.session.usage()
    await measure($, usage.context)

    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    const line = e.text.trim().split('\n')[0]?.trim() ?? ''
    if (e.command === undefined && e.isMeta === undefined && line !== '') {
      await update($, topic, old => ({ ...old, lastPrompt: line.slice(0, 80) }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'plan-meteo' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })

    if (opened.isPlaced) return { text: 'Panneau « Plan & météo » ouvert.' }

    // No pane here (the mobile app): the cards draw in this row where the
    // surface draws SVG, and this text is what the others, and the model, read.
    const list = await read($, steps)
    const fill: ContextFill = await read($, context)
    const percent = fill.percent
    const weather = weatherOf(percent)
    const plan =
      list.length === 0
        ? 'Pas encore de plan pour cette tâche.'
        : list.map((step, i) => `${MARK[step.status]} ${i + 1}. ${step.label}`).join('\n')
    const sky =
      weather === undefined || percent === undefined
        ? 'En attente de la première réponse…'
        : `${weather.icon} ${weather.label} · ${percent}% ${gauge(percent, 20)}\n` +
          `${kilo(fill.tokens ?? 0)} / ${kilo(fill.window)} tokens · ${weather.note}`

    return { text: `🧭 Plan\n${plan}\n\nMétéo du contexte\n${sky}` }
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      const { percent, tokens, window } = e.context
      await measure($, { percent, tokens, window })
    }

    return next(e)
  })

  // The plan as a todo list: each write carries the whole list.
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await nameThePlan($, await read($, steps))
      await update($, steps, () =>
        e.todos.map((todo, i) => ({
          id: String(i),
          label: todo.content,
          status: todo.status,
          detail: todo.status === 'in_progress' ? todo.activeForm : undefined,
        })),
      )
    }

    return ran
  }).catch(($, e, next) => next(e))

  // The plan as tasks: one created or changed at a time.
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    const id = (ran.result as { task?: { id?: string } } | undefined)?.task?.id
    if (ran.deny === undefined && !ran.isError && id !== undefined) {
      await nameThePlan($, await read($, steps))
      const step: Step = { id, label: e.subject, status: 'pending', detail: e.activeForm }
      await update($, steps, list => [...list.filter(one => one.id !== id), step])
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    const status = e.status
    if (ran.deny === undefined && !ran.isError) {
      await update($, steps, list =>
        status === 'deleted'
          ? list.filter(one => one.id !== e.taskId)
          : list.map(one =>
              one.id === e.taskId
                ? {
                    ...one,
                    label: e.subject ?? one.label,
                    status: status ?? one.status,
                    detail: e.activeForm ?? one.detail,
                  }
                : one,
            ),
      )
    }

    return ran
  }).catch(($, e, next) => next(e))

  // Where the surface draws SVG, /plan-meteo's row shows the two cards, kept
  // up to date; the terminal keeps the text.
  on('ui.render', { component: 'CommandOutput', props: { command: 'plan-meteo' } }, async ($, e, next) => {
    if (e.surface === 'terminal' || e.props.isErrored || e.props.text.startsWith('Panneau')) return next(e)
    const { Box, Svg } = $.ui.resolve(e)
    const list = await read($, steps)
    const fill: ContextFill = await read($, context)
    const { title } = await read($, topic)

    return (
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        <Svg key="plan" source={planCard(list, title)} alt={planAlt(list)} width={CARD_WIDTH} />
        <Svg key="meteo" source={weatherCard(fill)} alt={weatherAlt(fill)} width={CARD_WIDTH} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, steps)
    const fill: ContextFill = await read($, context)
    const { title } = await read($, topic)
    const columns = e.props?.bodyColumns ?? 34

    if (e.surface !== 'terminal') {
      const { Box, Svg } = $.ui.resolve(e)
      // The pane's width, in pixels, from its columns of the code font.
      const width = Math.max(280, Math.min(420, Math.round(columns * 8.4)))

      return (
        <Box flexDirection="column" gap={1}>
          <Svg key="plan" source={planCard(list, title, width)} alt={planAlt(list)} width={width} />
          <Svg key="meteo" source={weatherCard(fill, width)} alt={weatherAlt(fill)} width={width} />
        </Box>
      )
    }

    const { Box, Text } = $.ui.resolve(e)
    const done = list.filter(one => one.status === 'completed').length
    const current = list.findIndex(one => one.status === 'in_progress')
    const width = Math.max(10, Math.min(30, columns - 6))
    const percent = fill.percent
    const weather = weatherOf(percent)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>🧭 Où on en est dans le plan</Text>
          {list.length === 0 ? (
            <Text dimColor>Pas encore de plan pour cette tâche.</Text>
          ) : (
            <Box flexDirection="column">
              {title === undefined ? null : <Text color="claude" bold>{title}</Text>}
              <Text color="claude">
                {current >= 0
                  ? `Étape ${current + 1} sur ${list.length}`
                  : done === list.length
                    ? `Plan terminé (${done}/${list.length})`
                    : `${done} sur ${list.length} terminées`}
              </Text>
              <Text dimColor>{gauge((done / list.length) * 100, width)}</Text>
              {list.map((step, i) => (
                <Text
                  bold={step.status === 'in_progress'}
                  dimColor={step.status === 'completed'}
                  color={step.status === 'in_progress' ? 'claude' : undefined}
                >
                  {MARK[step.status]} {i + 1}. {step.status === 'in_progress' ? (step.detail ?? step.label) : step.label}
                </Text>
              ))}
            </Box>
          )}
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor={weather?.color ?? 'subtle'} paddingX={1}>
          <Text bold>Météo du contexte</Text>
          {weather === undefined || percent === undefined ? (
            <Text dimColor>En attente de la première réponse…</Text>
          ) : (
            <Box flexDirection="column">
              <Text color={weather.color} bold>
                {weather.icon} {weather.label} · {percent}%
              </Text>
              <Text color={weather.color}>{gauge(percent, width)}</Text>
              <Text dimColor>
                {kilo(fill.tokens ?? 0)} / {kilo(fill.window)} tokens · {weather.note}
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    )
  })
}

const planAlt = (list: readonly Step[]) => {
  if (list.length === 0) return 'Parcours du plan : pas de plan en cours.'
  const done = list.filter(one => one.status === 'completed').length
  const current = list.findIndex(one => one.status === 'in_progress')

  return (
    `Parcours du plan : ${done} sur ${list.length} faites` +
    (current >= 0 ? `, étape ${current + 1} en cours : ${list[current]!.label}.` : '.')
  )
}

const weatherAlt = (fill: ContextFill) => {
  const weather = weatherOf(fill.percent)

  return weather === undefined
    ? 'Météo du contexte : en attente de la première réponse.'
    : `Météo du contexte : ${weather.label}, ${fill.percent} %, compaction conseillée à ${COMPACT_AT} %.`
}
