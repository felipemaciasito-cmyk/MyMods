import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, ResolveInput } from 'claude-code'

import type { Step } from '../types'
import { asText, DEMO, STYLES } from './styles'
import type { Line, Model } from './styles'

const PANE = 'plan-ascii'
const TITLE = 'Plan ASCII'
// Change the tag when a value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const steps = atom({ plugin: 'plan-ascii', key: 'steps' } as const, [], { shape: 'steps-1' })
const context = atom({ plugin: 'plan-ascii', key: 'context' } as const, { window: 0 }, { shape: 'context-1' })
const topic = atom({ plugin: 'plan-ascii', key: 'topic' } as const, {}, { shape: 'topic-1' })
const view = atom({ plugin: 'plan-ascii', key: 'view' } as const, { style: 2, demo: false }, { shape: 'view-3' })

const styleOf = (id: number) => STYLES.find(one => one.id === id) ?? STYLES[1]

// What is drawn: the session's plan and context, or the sample plan.
const model = async ($: EngineInterface): Promise<{ model: Model; style: number; demo: boolean }> => {
  const { style, demo } = await read($, view)
  if (demo) return { model: DEMO, style, demo }
  const fill = await read($, context)
  const { title } = await read($, topic)

  return { model: { steps: await read($, steps), title, ...fill }, style, demo }
}

// "3 demo", "tour", "reel": a style by number or name, and the sample plan on or off.
const parse = (args: string) => {
  const words = args.toLowerCase().split(/\s+/).filter(Boolean)
  const demo = words.includes('demo') || words.includes('démo')
  // "demo" is also how "Demon" begins: it never names a style.
  const style = words
    .filter(word => word !== 'demo' && word !== 'démo')
    .map(word => STYLES.find(one => String(one.id) === word || one.name.toLowerCase().startsWith(word))?.id)
    .find(id => id !== undefined)

  return { style, demo }
}

// A plan starting: name it after what the person last asked.
const nameThePlan = async ($: EngineInterface, before: readonly Step[]) => {
  if (before.length > 0) return
  await update($, topic, old => ({ ...old, title: old.lastPrompt }))
}

// The lines, one monospaced Text each, then a button per style.
const drawing = async ($: EngineInterface, e: ResolveInput): Promise<RenderElement> => {
  const { Box, Text, Button } = $.ui.resolve(e)
  const { model: m, style, demo } = await model($)
  const lines: Line[] = styleOf(style).draw(m)

  return (
    <Box flexDirection="column">
      <Text dimColor mono>
        {`-- ${styleOf(style).id}. ${styleOf(style).name.toUpperCase()}${demo ? ' (demo)' : ''} --`}
      </Text>
      {lines.map(line => (
        <Text mono wrap="truncate-end">
          {line.length === 0 || line.every(run => run.text === '')
            ? ' '
            : line.map(run => (
                <Text color={run.color} dimColor={run.dim} bold={run.bold} italic={run.italic}>
                  {run.text}
                </Text>
              ))}
        </Text>
      ))}
      <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
        <Button
          key="demo"
          label={demo ? 'Plan reel' : 'Demo'}
          dimColor
          onPress={() => void update($, view, old => ({ ...old, demo: !old.demo }))}
        />
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'plan-ascii',
      description: 'Le plan et la fenêtre de contexte en art ASCII (Pégase ; 1-5 pour les autres styles)',
      argumentHint: '[1-5|console|pegase|demon|matrice|tour] [demo]',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    const ran = await next(e)
    const usage = await $.session.usage()
    await update($, context, () => usage.context)

    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    const line = e.text.trim().split('\n')[0]?.trim() ?? ''
    if (e.command === undefined && e.isMeta === undefined && line !== '') {
      await update($, topic, old => ({ ...old, lastPrompt: line.slice(0, 80) }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'plan-ascii' }, async ($, e) => {
    const asked = parse(e.args)
    await update($, view, old => ({ style: asked.style ?? old.style, demo: asked.demo }))
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    const { model: m, style } = await model($)
    const name = `${style}. ${styleOf(style).name}`

    if (opened.isPlaced) return { text: `Panneau « ${TITLE} » ouvert, style ${name}.` }

    // No pane here (the mobile app): the drawing goes in this row, and this
    // text, in a code block so it stays monospaced, is what the model reads
    // and what shows where nothing redraws the row.
    return { text: `Style ${name}\n\n\`\`\`\n${asText(styleOf(style).draw(m))}\n\`\`\`` }
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

  // Where there is no pane, /plan-ascii's row draws the same thing and keeps
  // it up to date.
  on('ui.render', { component: 'CommandOutput', props: { command: 'plan-ascii' } }, async ($, e, next) => {
    if (e.props.isErrored || e.props.text.startsWith('Panneau')) return next(e)

    return drawing($, e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => drawing($, e))
}
