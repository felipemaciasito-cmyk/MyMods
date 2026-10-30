import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ContextFill, Step, StepStatus } from '../types'

const PANE = 'boussole-du-plan'
const TITLE = 'Plan & météo'
// Change the tag when a value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const steps = atom({ plugin: 'boussole-du-plan', key: 'steps' } as const, [], {
  shape: 'steps-1',
})
const context = atom(
  { plugin: 'boussole-du-plan', key: 'context' } as const,
  { window: 0 },
  { shape: 'context-1' },
)

// The weather the context window is in, from clear sky to storm.
const WEATHER = [
  { upTo: 40, icon: '☀️', label: 'Grand soleil', note: 'Plein de place', color: 'success' },
  { upTo: 60, icon: '🌤️', label: 'Éclaircies', note: 'Tout va bien', color: 'success' },
  { upTo: 75, icon: '⛅', label: 'Nuageux', note: 'Ça se remplit', color: 'warning' },
  { upTo: 85, icon: '🌧️', label: 'Averses', note: 'Penser à résumer bientôt', color: 'warning' },
  { upTo: 95, icon: '⛈️', label: 'Orage', note: 'Compaction proche', color: 'error' },
  { upTo: 101, icon: '🌪️', label: 'Tempête', note: 'Compaction imminente', color: 'error' },
] as const

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'plan-meteo',
      description: 'Ouvre le panneau du plan et de la météo du contexte',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    const ran = await next(e)
    const usage = await $.session.usage()
    await update($, context, () => usage.context)

    return ran
  })

  on('command.run', { command: 'plan-meteo' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Panneau « Plan & météo » ouvert.' }
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      const { percent, tokens, window } = e.context
      await update($, context, () => ({ percent, tokens, window }))
    }

    return next(e)
  })

  // The plan as a todo list: each write carries the whole list.
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await update($, steps, () =>
        e.todos.map((todo, i) => ({
          id: String(i),
          label: todo.status === 'in_progress' ? todo.activeForm : todo.content,
          status: todo.status,
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
      const step: Step = { id, label: e.subject, status: 'pending' }
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
                  }
                : one,
            ),
      )
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, steps)
    const fill: ContextFill = await read($, context)
    const done = list.filter(one => one.status === 'completed').length
    const current = list.findIndex(one => one.status === 'in_progress')
    const width = Math.max(10, Math.min(30, (e.props?.bodyColumns ?? 34) - 6))
    const percent = fill.percent
    const weather =
      percent === undefined ? undefined : WEATHER.find(w => percent < w.upTo)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>🧭 Où on en est dans le plan</Text>
          {list.length === 0 ? (
            <Text dimColor>Pas encore de plan pour cette tâche.</Text>
          ) : (
            <Box flexDirection="column">
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
                  {MARK[step.status]} {i + 1}. {step.label}
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
