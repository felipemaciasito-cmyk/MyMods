import type { Step } from '../types'

// Five ways to draw where the plan is and how full the context window is,
// in characters only: every style is a list of lines, each line a list of
// runs of text with an optional colour. The plan comes first, the context
// below it.

export type Run = { text: string; color?: string; dim?: boolean; bold?: boolean; italic?: boolean }
export type Line = Run[]
export type Model = {
  steps: readonly Step[]
  title?: string
  percent?: number
  tokens?: number
  window: number
}

// The width every style is drawn at, in characters: it fits a phone held
// upright as well as the side pane.
export const W = 36
export const COMPACT_AT = 75

export const STYLES = [
  { id: 1, name: 'Console', draw: (m: Model) => consoleStyle(m) },
  { id: 2, name: 'Pegase', draw: (m: Model) => pegasusStyle(m) },
  { id: 3, name: 'Demon', draw: (m: Model) => daemonStyle(m) },
  { id: 4, name: 'Matrice', draw: (m: Model) => noiseStyle(m) },
  { id: 5, name: 'Tour', draw: (m: Model) => towerStyle(m) },
] as const

// The weather of the context window, with its sky in characters and the
// daemon's face for it.
const WEATHER = [
  {
    upTo: 40,
    label: 'Grand soleil',
    note: 'Plein de place',
    color: 'success',
    eyes: 'O  O',
    mouth: '\\__/',
    sky: ['   \\ | /   ', '  -- O --  ', '   / | \\   '],
  },
  {
    upTo: 60,
    label: 'Eclaircies',
    note: 'Tout va bien',
    color: 'success',
    eyes: 'o  o',
    mouth: '\\__/',
    sky: [' \\ / .--.  ', '-- O(    ). ', ' / (___.__)'],
  },
  {
    upTo: 75,
    label: 'Nuageux',
    note: 'Ca se remplit',
    color: 'warning',
    eyes: '-  -',
    mouth: '----',
    sky: ['    .--.   ', ' .-(    ). ', '(___.__)__)'],
  },
  {
    upTo: 85,
    label: 'Averses',
    note: 'Penser a resumer',
    color: 'warning',
    eyes: ';  ;',
    mouth: '/~~\\',
    sky: [' .-(    ). ', '(___.__)__)', " ' ' ' ' ' "],
  },
  {
    upTo: 95,
    label: 'Orage',
    note: 'Compaction proche',
    color: 'error',
    eyes: '@  @',
    mouth: '/^^\\',
    sky: [' .-(    ). ', '(___.__)__)', "  /_  /_ ' "],
  },
  {
    upTo: 101,
    label: 'Tempete',
    note: 'Compaction imminente',
    color: 'error',
    eyes: 'x  x',
    mouth: '/##\\',
    sky: ['(~~~~~~~~) ', '  (~~~~~)  ', '    (~)    '],
  },
] as const

const WAITING = {
  label: 'En attente',
  note: 'Apres 1re reponse',
  color: 'subtle',
  eyes: '.  .',
  mouth: '----',
  sky: ['           ', '   . . .   ', '           '],
}

const weatherOf = (percent: number | undefined) =>
  percent === undefined ? WAITING : (WEATHER.find(w => percent < w.upTo) ?? WEATHER[WEATHER.length - 1]!)

const NOW = 'claude'
const DONE = 'success'

// ---------------------------------------------------------------- helpers

const kilo = (n: number) => `${Math.round(n / 1000)}k`

// A text cut or padded to exactly `n` characters; a cut ends with ~.
const fit = (text: string, n: number) => {
  const flat = text.normalize('NFC').replace(/\s+/g, ' ').trim()

  return flat.length <= n ? flat.padEnd(n) : `${flat.slice(0, n - 1)}~`
}

const width = (line: Line) => line.reduce((sum, run) => sum + run.text.length, 0)

// A line padded with spaces to `n` characters.
const pad = (line: Line, n: number): Line => {
  const missing = n - width(line)

  return missing > 0 ? [...line, { text: ' '.repeat(missing) }] : line
}

const plain = (text: string, style: Omit<Run, 'text'> = {}): Line => [{ text, ...style }]

// A line inside a frame: `left`, the line padded to `inner`, `right`.
const framed = (line: Line, inner: number, left = '| ', right = ' |'): Line => [
  { text: left, dim: true },
  ...pad(line, inner),
  { text: right, dim: true },
]

// A gauge of `n` cells filled to `percent`, the compaction mark at 75 %.
const gauge = (percent: number, n: number, fill = '#', empty = '.') => {
  const full = Math.round((Math.min(100, Math.max(0, percent)) / 100) * n)
  const mark = Math.round((COMPACT_AT / 100) * n)

  return Array.from({ length: n }, (_, i) => (i < full ? fill : i === mark ? '|' : empty)).join('')
}

const where = (m: Model) => {
  const total = m.steps.length
  const done = m.steps.filter(step => step.status === 'completed').length
  const current = m.steps.findIndex(step => step.status === 'in_progress')

  return { total, done, current, ratio: total === 0 ? 0 : (done + (current >= 0 ? 0.5 : 0)) / total }
}

// "ETAPE 2 / 5", or how the plan ended.
const stage = (m: Model) => {
  const { total, done, current } = where(m)
  if (total === 0) return 'PAS ENCORE DE PLAN'
  if (current >= 0) return `ETAPE ${current + 1} / ${total}`

  return done === total ? `PLAN BOUCLE (${done}/${total})` : `${done} / ${total} FAITES`
}

// The steps as a checklist: [x] done, [>] here, [ ] to come; the step under
// way also says what is being done.
const checklist = (m: Model, n: number): Line[] => {
  if (m.steps.length === 0) return [plain(fit('Le plan apparait des que Claude en fait un.', n), { dim: true })]

  return m.steps.flatMap((step, i): Line[] => {
    const label = `${i + 1}. ${step.label}`
    if (step.status === 'completed') return [[{ text: '[x] ', color: DONE }, { text: fit(label, n - 4), dim: true }]]
    if (step.status === 'pending') return [[{ text: '[ ] ', dim: true }, { text: fit(label, n - 4) }]]

    const here: Line = [
      { text: '[>] ', color: NOW, bold: true },
      { text: fit(label, n - 8), color: NOW, bold: true },
      { text: ' <--', color: NOW },
    ]

    return step.detail === undefined || step.detail === step.label
      ? [here]
      : [here, [{ text: '    > ', color: NOW }, { text: fit(step.detail, n - 6), italic: true }]]
  })
}

// The plan's progress as boxes: [x][x][>][ ][ ].
const boxes = (m: Model, n: number) => {
  const marks = m.steps.map(step => (step.status === 'completed' ? '[x]' : step.status === 'in_progress' ? '[>]' : '[ ]'))
  const room = Math.floor(n / 3)

  return marks.length <= room ? marks.join('') : `${marks.slice(0, room - 1).join('')}...`
}

const tokens = (m: Model) =>
  m.percent === undefined ? 'jetons : en attente' : `${kilo(m.tokens ?? 0)} / ${kilo(m.window)} jetons`

// A random sequence that comes back the same for the same seed.
const random = (seed: number) => {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------- 1 . Console

// A terminal window: `plan --status`, then `context --meteo`.
const consoleStyle = (m: Model): Line[] => {
  const inner = W - 4
  const row = (...runs: Run[]) => framed(runs, inner)
  const prompt: Run = { text: '~$ ', color: DONE, bold: true }
  const weather = weatherOf(m.percent)
  const p = m.percent
  const info = [
    [{ text: weather.label, color: weather.color, bold: true }, { text: p === undefined ? '' : `  ${p} %` }],
    [{ text: weather.note, dim: true }],
    [{ text: '' }],
  ] as Line[]

  return [
    plain(`.${'-'.repeat(W - 2)}.`, { dim: true }),
    row(
      { text: 'o ', color: 'error' },
      { text: 'o ', color: 'warning' },
      { text: 'o', color: DONE },
      { text: '   claude -- bash -- plan', dim: true },
    ),
    plain(`|${'-'.repeat(W - 2)}|`, { dim: true }),
    row(prompt, { text: 'plan --status' }),
    ...(m.title === undefined ? [] : [row({ text: fit(m.title, inner), bold: true })]),
    row({ text: stage(m), color: NOW, bold: true }),
    ...checklist(m, inner).map(line => framed(line, inner)),
    row(
      { text: '[' },
      { text: gauge(where(m).ratio * 100, inner - 9, '#', '.').replace('|', '.'), color: NOW },
      { text: `] ${String(Math.round(where(m).ratio * 100)).padStart(3)}%` },
    ),
    row(),
    row(prompt, { text: 'context --meteo' }),
    ...weather.sky.map((sky, i) => row({ text: `${sky}  `, color: weather.color }, ...info[i]!)),
    row({ text: '[' }, { text: gauge(p ?? 0, inner - 2), color: weather.color }, { text: ']' }),
    row({ text: fit(`${tokens(m)}   | = ${COMPACT_AT}%`, inner), dim: true }),
    row(prompt, { text: '_', color: DONE }),
    plain(`'${'-'.repeat(W - 2)}'`, { dim: true }),
  ]
}

// ------------------------------------------------------- 2 . Pegase

// A winged horse that lights up from left to right as the plan advances,
// in the colours of a sunset.
const PEGASUS = [
  '             .                  ',
  '            /|        __.---~~~-.',
  "           / |   _.--~ _.--~~~~-'",
  '      ___ /  |.-~  _.-~ __.--~~  ',
  "    ,' o `    .-'_.-~_.-~ __.-'  ",
  '   (_    ,   (_.-~_.-~_.-~~      ',
  "     `--' \\     .-~ .-~          ",
  '           )   (                 ',
  '          /  /\\ \\                ',
  '         (  (  ) )               ',
  '        _/  /  \\ \\_              ',
  '       (__)/    \\(__)            ',
]
const SUNSET = ['#a3e635', '#facc15', '#fbbf24', '#fb923c', '#f97316', '#ef4444', '#ec4899', '#d946ef']

// The context gauge cut into runs of the sunset colours, the empty part dim.
const breath = (percent: number, n: number): Line => {
  const cells = gauge(percent, n, '=', ' ').replace(/=(?=[ |]|$)/, '>')
  const band = Math.ceil(n / SUNSET.length)
  const runs: Line = []
  for (let x = 0; x < n; x += band) {
    const text = cells.slice(x, x + band)
    const lit = text.replace(/[ |].*$/, '')
    if (lit !== '') runs.push({ text: lit, color: SUNSET[Math.floor(x / band)], bold: true })
    if (lit.length < text.length) runs.push({ text: text.slice(lit.length), dim: true })
  }

  return runs
}

const pegasusStyle = (m: Model): Line[] => {
  const art = Math.max(...PEGASUS.map(row => row.length))
  const lit = Math.round(where(m).ratio * art)
  const band = Math.ceil(art / SUNSET.length)
  const weather = weatherOf(m.percent)
  const p = m.percent

  // Each row cut into bands of one colour; what is not lit yet stays dim.
  const figure = PEGASUS.map((row): Line => {
    const runs: Line = []
    for (let x = 0; x < row.length; x += band) {
      const end = Math.min(row.length, x + band)
      if (x >= lit) {
        runs.push({ text: row.slice(x), dim: true })
        break
      }
      const cut = Math.min(end, lit)
      runs.push({ text: row.slice(x, cut), color: SUNSET[Math.floor(x / band)], bold: true })
      if (cut < end) {
        runs.push({ text: row.slice(cut), dim: true })
        break
      }
    }

    return runs
  })

  return [
    ...figure,
    plain(''),
    [{ text: '>> ', color: '#fb923c' }, { text: stage(m), bold: true, color: '#fbbf24' }],
    ...(m.title === undefined ? [] : [plain(fit(m.title, W), { dim: true })]),
    ...checklist(m, W),
    plain(''),
    [{ text: '~~ SOUFFLE DU CONTEXTE ~~', color: weather.color, bold: true }],
    // The breath in the same sunset, as far as the context is full.
    [
      { text: '}=', color: SUNSET[0] },
      ...breath(p ?? 0, W - 5),
      { text: '=-', dim: true },
    ],
    [
      { text: weather.label, color: weather.color, bold: true },
      { text: p === undefined ? '' : ` ${p} % . ${tokens(m)}`, dim: true },
    ],
  ]
}

// ------------------------------------------------------- 3 . Demon

// cowsay's way: the step in a speech bubble, said by a little devil whose
// face follows the weather; its trident is the context gauge.
const daemonStyle = (m: Model): Line[] => {
  const inner = W - 4
  const weather = weatherOf(m.percent)
  const p = m.percent
  const { current } = where(m)
  const now = current >= 0 ? m.steps[current] : undefined
  const said: Line[] = [
    [{ text: fit(`${stage(m)}${now === undefined ? '' : ` : ${now.label}`}`, inner), bold: true }],
    [{ text: fit(boxes(m, inner), inner), color: NOW }],
    [{ text: fit(now?.detail === undefined ? (m.title ?? '') : `> ${now.detail}`, inner), dim: true }],
    [{ text: fit(`${weather.label}${p === undefined ? '' : `, ${p} %`} - ${weather.note}`, inner), color: weather.color }],
  ]
  const edges = ['/ ', '| ', '| ', '\\ ']
  const ends = [' \\', ' |', ' |', ' /']
  const face = (text: string): Line => [{ text, color: weather.color }]

  return [
    plain(` ${'_'.repeat(W - 2)}`, { dim: true }),
    ...said.map((line, i) => framed(line, inner, edges[i], ends[i])),
    plain(` ${'-'.repeat(W - 2)}`, { dim: true }),
    plain('   \\'),
    plain('    \\    (\\_          _/)'),
    plain('     \\    \\ \\  ____  / /'),
    plain('           \\ \\/    \\/ /'),
    face(`            |  ${weather.eyes}  |`),
    plain('            |   /\\   |'),
    face(`             \\ ${weather.mouth} /`),
    plain('          ____\\____/____'),
    plain('         /    |    |    \\'),
    plain('        (     |~~~~|     )'),
    plain('              (_/\\_)'),
    plain(''),
    [{ text: 'E==[', bold: true }, { text: gauge(p ?? 0, W - 9), color: weather.color, bold: true }, { text: ']==-', bold: true }],
    plain(fit(`    ${tokens(m)}   | = ${COMPACT_AT}%`, W), { dim: true }),
    ...checklist(m, W),
  ]
}

// ------------------------------------------------------- 4 . Matrice

// A wall of characters with the plan carved in it; below, a second wall
// that gets denser as the context window fills.
const HEAVY = '@#%&$WM8B'
const MIDDLE = '*+=?!{}[]()/\\|<>'
const LIGHT = ".,:;'`^-~"

const noise = (n: number, density: number, next: () => number) =>
  Array.from({ length: n }, () => {
    if (next() >= density) return ' '
    const kind = next()
    const pick = (set: string) => set[Math.floor(next() * set.length)]!

    return kind < density * 0.6 ? pick(HEAVY) : kind < 0.75 ? pick(MIDDLE) : pick(LIGHT)
  }).join('')

// A row of noise with `text` carved in the middle, a space on each side.
const carved = (text: string, density: number, next: () => number, color: string): Line => {
  const hole = ` ${text} `
  const left = Math.floor((W - hole.length) / 2)

  return [
    { text: noise(left, density, next), color, dim: true },
    { text: hole, bold: true },
    { text: noise(W - left - hole.length, density, next), color, dim: true },
  ]
}

const noiseStyle = (m: Model): Line[] => {
  const { done, total, ratio } = where(m)
  const p = m.percent
  const weather = weatherOf(p)
  const next = random(total * 131 + done * 17 + (p ?? 0) * 7 + 1)
  const wall = 0.55
  const fog = 0.06 + 0.9 * ((p ?? 0) / 100)
  const ink = '#22c55e'
  const { current } = where(m)
  const now = current >= 0 ? m.steps[current] : undefined

  return [
    [{ text: noise(W, wall, next), color: ink, dim: true }],
    carved(stage(m), wall, next, ink),
    ...(now === undefined ? [] : [carved(fit(now.label, Math.min(26, now.label.length)), wall, next, ink)]),
    carved(`[${gauge(ratio * 100, 14, '#', '.').replace('|', '.')}]`, wall, next, ink),
    [{ text: noise(W, wall, next), color: ink, dim: true }],
    ...checklist(m, W),
    plain(''),
    [{ text: noise(W, fog, next), color: weather.color }],
    carved(p === undefined ? 'CONTEXTE : EN ATTENTE' : `CONTEXTE ${p} % - ${weather.label.toUpperCase()}`, fog, next, weather.color),
    [{ text: noise(W, fog, next), color: weather.color }],
    carved(tokens(m), fog, next, weather.color),
    [{ text: noise(W, fog, next), color: weather.color }],
    plain(fit('mur dense = contexte plein', W), { dim: true }),
  ]
}

// ------------------------------------------------------- 5 . Tour

// An engraved tower built from the ground up, one floor per step; below, the
// sky of the context in shades from . to @.
const TOWER = [
  '         |         ',
  '         A         ',
  '        /H\\        ',
  '        |H|        ',
  '        |H|        ',
  '       /XXX\\       ',
  '       |XXX|       ',
  '      /XXXXX\\      ',
  '     =========     ',
  '     |XX/ \\XX|     ',
  '    /XX/   \\XX\\    ',
  '   /XX/     \\XX\\   ',
  '  /XX/       \\XX\\  ',
  ' /XX/         \\XX\\ ',
  '=====         =====',
]
const RAMP = ' .:-=+*#%@'

const towerStyle = (m: Model): Line[] => {
  const rows = TOWER.length
  const total = m.steps.length
  const label = W - TOWER[0]!.length - 1
  const p = m.percent
  const weather = weatherOf(p)
  // Which step each row of the tower belongs to, from the ground up.
  const stepOf = (row: number) => (total === 0 ? -1 : Math.floor(((rows - 1 - row) * total) / rows))
  // The row that names each step: the middle of its floor.
  const naming = new Map<number, number>()
  for (let s = 0; s < total; s++) {
    const floor = TOWER.map((_, r) => r).filter(r => stepOf(r) === s)
    if (floor.length > 0) naming.set(floor[Math.floor(floor.length / 2)]!, s)
  }

  const figure = TOWER.map((row, r): Line => {
    const step = m.steps[stepOf(r)]
    const status = step?.status ?? 'pending'
    const stone =
      status === 'completed'
        ? { text: row.replace(/[XH]/g, '#'), color: 'text', bold: true }
        : status === 'in_progress'
          ? { text: row.replace(/[XH]/g, '%'), color: NOW, bold: true }
          : { text: row.replace(/[^ ]/g, '.'), dim: true }
    const s = naming.get(r)
    if (s === undefined) return [stone]
    const one = m.steps[s]!
    const mark = one.status === 'completed' ? 'x' : one.status === 'in_progress' ? '>' : '.'

    return [
      stone,
      { text: ' ' },
      {
        text: fit(`${mark} ${s + 1}.${one.label}`, label),
        color: one.status === 'in_progress' ? NOW : one.status === 'completed' ? DONE : undefined,
        dim: one.status === 'pending',
        bold: one.status === 'in_progress',
      },
    ]
  })

  // The sky: shades growing to @ as far as the context is full.
  const n = W - 2
  const full = Math.round(((p ?? 0) / 100) * n)
  const mark = Math.round((COMPACT_AT / 100) * n)
  const sky = Array.from({ length: n }, (_, i) =>
    i < full ? RAMP[1 + Math.min(8, Math.floor((i / Math.max(1, full - 1)) * 8.99))] : i === mark ? '|' : ' ',
  ).join('')
  const { current } = where(m)
  const now = current >= 0 ? m.steps[current] : undefined

  return [
    [{ text: stage(m), bold: true, color: NOW }],
    ...(now?.detail === undefined ? [] : [plain(fit(`> ${now.detail}`, W), { italic: true })]),
    ...(m.title === undefined ? [] : [plain(fit(m.title, W), { dim: true })]),
    plain(''),
    ...figure,
    plain('~'.repeat(W), { dim: true }),
    ...weather.sky.map((row, i): Line => [
      { text: `${row}  `, color: weather.color },
      i === 0
        ? { text: 'CIEL DU CONTEXTE', bold: true }
        : i === 1
          ? { text: `${weather.label}${p === undefined ? '' : ` ${p} %`}`, color: weather.color, bold: true }
          : { text: tokens(m), dim: true },
    ]),
    [{ text: '[' }, { text: sky, color: weather.color }, { text: ']' }],
    plain(fit(`${RAMP.trim()}  -> | = compacter a ${COMPACT_AT}%`, W), { dim: true }),
  ]
}

// A style's lines as plain text, for the command's answer and for tests.
export const asText = (lines: readonly Line[]) => lines.map(line => line.map(run => run.text).join('').trimEnd()).join('\n')

export const DEMO: Model = {
  title: 'Refaire le design de la boussole',
  steps: [
    { id: '1', label: 'Lire le mod existant', status: 'completed' },
    { id: '2', label: 'Dessiner les styles retro', status: 'completed' },
    { id: '3', label: 'Tester sur l iPad', status: 'in_progress', detail: 'Test sur l iPad en cours' },
    { id: '4', label: 'Choisir le style', status: 'pending' },
    { id: '5', label: 'Fusionner dans main', status: 'pending' },
  ],
  percent: 63,
  tokens: 630000,
  window: 1000000,
}
