import type { ContextFill, Step } from '../types'

// The two cards drawn as SVG on the surfaces that draw it (desktop, VS Code,
// the mobile app): the plan as a path of steps, the context as a weather.
//
// A sober graphite base; colour only says something: the weather goes from
// green to red as the context fills, the plan is blue where it is and green
// where it is done.

export const CARD_WIDTH = 360
export const COMPACT_AT = 75

const BASE = '#151517'
const LINE = '#2a2a2f'
const TRACK = '#232327'
const INK = '#ededee'
const SOFT = '#b4b4ba'
const DIM = '#7c7c84'
const NOW = '#60a5fa'
const DONE = '#4ade80'
const FONT = "-apple-system, 'SF Pro Text', 'Inter', 'Segoe UI', system-ui, sans-serif"

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Breaks a line into rows of about `width` characters, at spaces when it can;
// the last row kept ends with … when the text runs past `rows`.
const wrap = (text: string, width: number, rows: number) => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line === '' ? word : `${line} ${word}`
    if (next.length <= width) line = next
    else {
      if (line !== '') lines.push(line)
      line = word.length > width ? `${word.slice(0, width - 1)}…` : word
    }
  }
  if (line !== '') lines.push(line)
  if (lines.length > rows) {
    lines.length = rows
    lines[rows - 1] = `${lines[rows - 1]!.slice(0, width - 1).trimEnd()}…`
  }

  return lines
}

const tspans = (lines: string[], x: number, step: number) =>
  lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : step}">${esc(line)}</tspan>`).join('')

// The weather the context window is in, from clear sky to storm, each with
// the colour of its level.
export const WEATHER = [
  { upTo: 40, icon: '☀️', label: 'Grand soleil', note: 'Plein de place', color: 'success', hue: '#4ade80', sky: 'sun' },
  { upTo: 60, icon: '🌤️', label: 'Éclaircies', note: 'Tout va bien', color: 'success', hue: '#a3e635', sky: 'sunCloud' },
  { upTo: 75, icon: '⛅', label: 'Nuageux', note: 'Ça se remplit', color: 'warning', hue: '#facc15', sky: 'cloud' },
  { upTo: 85, icon: '🌧️', label: 'Averses', note: 'Penser à résumer bientôt', color: 'warning', hue: '#fb923c', sky: 'rain' },
  { upTo: 95, icon: '⛈️', label: 'Orage', note: 'Compaction proche', color: 'error', hue: '#f87171', sky: 'storm' },
  { upTo: 101, icon: '🌪️', label: 'Tempête', note: 'Compaction imminente', color: 'error', hue: '#f43f5e', sky: 'tornado' },
] as const

export type Weather = (typeof WEATHER)[number]

export const weatherOf = (percent: number | undefined): Weather | undefined =>
  percent === undefined ? undefined : WEATHER.find(w => percent < w.upTo)

// The whole scale, laid along a track: a fill reveals as much of it as it covers.
const SCALE = WEATHER.map((w, i) => {
  const from = i === 0 ? 0 : WEATHER[i - 1]!.upTo
  const mid = Math.min(100, (from + Math.min(100, w.upTo)) / 2)

  return `<stop offset="${(mid / 100).toFixed(3)}" stop-color="${w.hue}"/>`
}).join('')

// A card: the graphite base, a hairline border, and the faintest wash of the
// card's colour from the top.
const frame = (width: number, height: number, tint: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">` +
  '<defs>' +
  `<linearGradient id="wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint}" stop-opacity="0.07"/><stop offset="0.6" stop-color="${tint}" stop-opacity="0"/></linearGradient>` +
  `<linearGradient id="scale" gradientUnits="userSpaceOnUse" x1="24" y1="0" x2="${width - 24}" y2="0">${SCALE}</linearGradient>` +
  `<linearGradient id="now" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${NOW}" stop-opacity="0.75"/><stop offset="1" stop-color="${NOW}"/></linearGradient>` +
  `<linearGradient id="done" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${DONE}" stop-opacity="0.75"/><stop offset="1" stop-color="${DONE}"/></linearGradient>` +
  '<linearGradient id="puff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e4e7"/><stop offset="1" stop-color="#a1a1aa"/></linearGradient>' +
  '<linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#71717a"/><stop offset="1" stop-color="#3f3f46"/></linearGradient>' +
  '</defs>' +
  `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="18" fill="${BASE}"/>` +
  `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="18" fill="url(#wash)"/>` +
  `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="18" fill="none" stroke="${LINE}"/>` +
  body +
  '</svg>'

const header = (left: string, right: string | undefined, color: string, width: number) =>
  `<text x="24" y="34" fill="${DIM}" font-size="10.5" font-weight="600" letter-spacing="1.8">${esc(left)}</text>` +
  (right === undefined
    ? ''
    : `<text x="${width - 24}" y="34" text-anchor="end" fill="${color}" font-size="10.5" font-weight="700" letter-spacing="1.8">${esc(right)}</text>`)

// A thin track filled to `ratio` with `paint`, ending on a small knob.
const bar = (y: number, ratio: number, width: number, ticks: number, paint: string, knob: string) => {
  const x = 24
  const span = width - 48
  const end = x + span * Math.max(0, Math.min(1, ratio))
  const marks = Array.from({ length: Math.max(0, ticks - 1) }, (_, i) => {
    const tx = x + (span * (i + 1)) / ticks

    return `<rect x="${tx - 1}" y="${y - 3}" width="2" height="6" fill="${BASE}"/>`
  }).join('')

  return (
    `<rect x="${x}" y="${y - 3}" width="${span}" height="6" rx="3" fill="${TRACK}"/>` +
    (ratio > 0 ? `<rect x="${x}" y="${y - 3}" width="${Math.max(6, end - x)}" height="6" rx="3" fill="url(#${paint})"/>` : '') +
    marks +
    `<circle cx="${end}" cy="${y}" r="9" fill="${knob}" fill-opacity="0.16"/>` +
    `<circle cx="${end}" cy="${y}" r="5" fill="${INK}" stroke="${BASE}" stroke-width="2"/>`
  )
}

const check = (cx: number, cy: number) =>
  `<circle cx="${cx}" cy="${cy}" r="10" fill="${DONE}" fill-opacity="0.14" stroke="${DONE}" stroke-opacity="0.6"/>` +
  `<path d="M${cx - 4.5} ${cy + 0.2} l3 3.1 l6 -6.4" fill="none" stroke="${DONE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`

const numbered = (cx: number, cy: number, n: number, isCurrent: boolean) =>
  (isCurrent ? `<circle cx="${cx}" cy="${cy}" r="15" fill="${NOW}" fill-opacity="0.12"/>` : '') +
  `<circle cx="${cx}" cy="${cy}" r="10" fill="${isCurrent ? NOW : BASE}" stroke="${isCurrent ? NOW : '#3a3a41'}" stroke-width="1.4"/>` +
  `<text x="${cx}" y="${cy + 3.8}" text-anchor="middle" fill="${isCurrent ? '#0b1220' : DIM}" font-size="10.5" font-weight="700">${n}</text>`

/** The plan card: its name, how far along, and each step on a path. */
export const planCard = (steps: readonly Step[], title: string | undefined, width = CARD_WIDTH) => {
  if (steps.length === 0) {
    return frame(
      width,
      124,
      '#a1a1aa',
      header('PARCOURS DU PLAN', undefined, DIM, width) +
        `<text x="24" y="70" fill="${INK}" font-size="20" font-weight="650">Pas de plan en cours</text>` +
        `<text x="24" y="96" fill="${DIM}" font-size="12.5">${tspans(
          wrap('Il s’affiche dès que Claude découpe la tâche en étapes.', 46, 2),
          24,
          16,
        )}</text>`,
    )
  }

  const total = steps.length
  const done = steps.filter(one => one.status === 'completed').length
  const current = steps.findIndex(one => one.status === 'in_progress')
  const isDone = done === total
  const accent = isDone ? DONE : NOW
  const titleLines = wrap(title ?? 'Plan de la tâche', 28, 2)
  let y = 68
  let body = header(
    'PARCOURS DU PLAN',
    isDone ? 'TERMINÉ' : current >= 0 ? `ÉTAPE ${current + 1} / ${total}` : `${done} / ${total}`,
    accent,
    width,
  )
  body += `<text x="24" y="${y}" fill="${INK}" font-size="20" font-weight="650" letter-spacing="-0.2">${tspans(titleLines, 24, 25)}</text>`
  y += (titleLines.length - 1) * 25 + 28
  body += bar(y, done / total, width, total, isDone ? 'done' : 'now', accent)
  y += 24
  body +=
    `<text x="24" y="${y}" fill="${DIM}" font-size="12">${Math.round((done / total) * 100)} %</text>` +
    `<text x="${width - 24}" y="${y}" text-anchor="end" fill="${SOFT}" font-size="12">${done} / ${total} faites</text>`
  y += 20

  const rows: string[] = []
  const centers: number[] = []
  for (const [i, step] of steps.entries()) {
    const isCurrent = i === current
    const lines = wrap(step.label, isCurrent ? 32 : 36, 3)
    const detail = isCurrent && step.detail !== undefined && step.detail !== step.label ? wrap(step.detail, 38, 2) : []
    const textHeight = lines.length * 18 + (detail.length > 0 ? 6 + detail.length * 16 : 0)
    const rowHeight = Math.max(28, textHeight) + (isCurrent ? 26 : 16)
    const top = y
    const cy = top + (isCurrent ? 13 : 8) + 10
    centers.push(cy)

    let row = ''
    if (isCurrent) {
      row += `<rect x="14" y="${top}" width="${width - 28}" height="${rowHeight - 6}" rx="12" fill="${NOW}" fill-opacity="0.07" stroke="${NOW}" stroke-opacity="0.35"/>`
    }
    row += step.status === 'completed' ? check(44, cy) : numbered(44, cy, i + 1, isCurrent)
    const textY = cy + 4.5
    const ink = step.status === 'completed' ? DIM : isCurrent ? INK : SOFT
    row += `<text x="70" y="${textY}" fill="${ink}" font-size="${isCurrent ? 14.5 : 14}" font-weight="${isCurrent ? 650 : 400}">${tspans(lines, 70, 18)}</text>`
    if (detail.length > 0) {
      row += `<text x="70" y="${textY + lines.length * 18 + 4}" fill="${NOW}" font-size="12.5">${tspans(detail, 70, 16)}</text>`
    }
    rows.push(row)
    y += rowHeight
  }
  // The path joining the steps, drawn under them, green as far as it is done.
  const reached = Math.min(current >= 0 ? current : done - 1, centers.length - 1)
  if (centers.length > 1) {
    body += `<line x1="44" y1="${centers[0]}" x2="44" y2="${centers[centers.length - 1]}" stroke="${LINE}" stroke-width="1.5"/>`
    if (reached > 0) {
      body += `<line x1="44" y1="${centers[0]}" x2="44" y2="${centers[reached]}" stroke="${DONE}" stroke-opacity="0.45" stroke-width="1.5"/>`
    }
  }
  body += rows.join('')

  if (isDone) {
    const mid = width / 2
    body +=
      `<line x1="40" y1="${y + 8}" x2="${mid - 60}" y2="${y + 8}" stroke="${DONE}" stroke-opacity="0.3"/>` +
      `<line x1="${mid + 60}" y1="${y + 8}" x2="${width - 40}" y2="${y + 8}" stroke="${DONE}" stroke-opacity="0.3"/>` +
      `<text x="${mid}" y="${y + 13}" text-anchor="middle" fill="${DONE}" font-size="14" font-weight="650" letter-spacing="0.4">Plan bouclé</text>`
    y += 28
  }

  return frame(width, y + 16, accent, body)
}

const cloud = (x: number, y: number, s: number, color: string) =>
  `<path transform="translate(${x} ${y}) scale(${s})" fill="${color}" d="M-22 10 a12 12 0 0 1 4 -23 a17 17 0 0 1 32 -4 a13 13 0 0 1 10 27 z"/>`

const sun = (x: number, y: number, r: number) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = x + Math.cos(a) * (r + 4)
    const y1 = y + Math.sin(a) * (r + 4)
    const x2 = x + Math.cos(a) * (r + 9)
    const y2 = y + Math.sin(a) * (r + 9)

    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#facc15" stroke-width="2.4" stroke-linecap="round"/>`
  }).join('') + `<circle cx="${x}" cy="${y}" r="${r}" fill="#facc15"/>`

const drops = (x: number, y: number) =>
  [0, 1, 2]
    .map(i => `<line x1="${x - 9 + i * 9}" y1="${y}" x2="${x - 12 + i * 9}" y2="${y + 9}" stroke="#60a5fa" stroke-width="2.2" stroke-linecap="round"/>`)
    .join('')

// The sky drawn in the round badge, centred on (x, y).
const sky = (kind: Weather['sky'], x: number, y: number) => {
  switch (kind) {
    case 'sun':
      return sun(x, y, 11)
    case 'sunCloud':
      return sun(x - 6, y - 6, 8) + cloud(x + 3, y + 8, 0.56, 'url(#puff)')
    case 'cloud':
      return cloud(x - 6, y - 3, 0.44, 'url(#dark)') + cloud(x + 3, y + 7, 0.58, 'url(#puff)')
    case 'rain':
      return cloud(x + 1, y - 2, 0.58, 'url(#puff)') + drops(x + 1, y + 11)
    case 'storm':
      return (
        cloud(x + 1, y - 4, 0.58, 'url(#dark)') +
        `<path d="M${x + 1} ${y + 3} l-6 10 h5 l-3 9 l10 -13 h-5 l3 -6 z" fill="#facc15"/>`
      )
    case 'tornado':
      return [0, 1, 2, 3, 4]
        .map(i => {
          const w = 28 - i * 5

          return `<line x1="${x - w / 2 + i * 2}" y1="${y - 13 + i * 6.5}" x2="${x + w / 2 + i * 2}" y2="${y - 13 + i * 6.5}" stroke="${i % 2 === 0 ? '#d4d4d8' : '#71717a'}" stroke-width="3.4" stroke-linecap="round"/>`
        })
        .join('')
  }
}

const kilo = (n: number) => `${Math.round(n / 1000)}k`

/** The weather card: the fill as a sky, a gauge with the line to compact at, and the recent trend. */
export const weatherCard = (fill: ContextFill, width = CARD_WIDTH) => {
  const percent = fill.percent
  const weather = weatherOf(percent)

  if (weather === undefined || percent === undefined) {
    return frame(
      width,
      124,
      '#a1a1aa',
      header('MÉTÉO DU CONTEXTE', undefined, DIM, width) +
        `<text x="24" y="70" fill="${INK}" font-size="20" font-weight="650">En attente…</text>` +
        `<text x="24" y="96" fill="${DIM}" font-size="12.5">La météo arrive après la première réponse de Claude.</text>`,
    )
  }

  const hue = weather.hue
  const cx = 62
  const cy = 98
  let body = header('MÉTÉO DU CONTEXTE', weather.label.toUpperCase(), hue, width)
  body +=
    `<circle cx="${cx}" cy="${cy}" r="30" fill="${hue}" fill-opacity="0.08" stroke="${hue}" stroke-opacity="0.45" stroke-width="1.5"/>` +
    sky(weather.sky, cx, cy) +
    `<text x="112" y="98" fill="${INK}" font-size="38" font-weight="650" letter-spacing="-1">${percent}<tspan fill="${DIM}" font-size="18" font-weight="500" dx="3">%</tspan></text>` +
    `<text x="112" y="118" fill="${SOFT}" font-size="12.5">${kilo(fill.tokens ?? 0)} / ${kilo(fill.window)} jetons</text>` +
    `<text x="112" y="135" fill="${hue}" font-size="12.5">${esc(weather.note)}</text>`

  const gaugeY = 172
  const redX = 24 + ((width - 48) * COMPACT_AT) / 100
  body +=
    bar(gaugeY, percent / 100, width, 4, 'scale', hue) +
    `<line x1="${redX}" y1="${gaugeY - 9}" x2="${redX}" y2="${gaugeY + 9}" stroke="#f87171" stroke-width="1.5" stroke-dasharray="2.5 2"/>` +
    `<text x="${redX}" y="${gaugeY + 24}" text-anchor="middle" fill="#f87171" fill-opacity="0.85" font-size="10" font-weight="600">${COMPACT_AT} %</text>` +
    `<text x="24" y="${gaugeY + 24}" fill="${DIM}" font-size="10">0</text>` +
    `<text x="${width - 24}" y="${gaugeY + 24}" text-anchor="end" fill="${DIM}" font-size="10">100</text>`

  // The last fills, oldest first, each in its own weather's colour.
  const history = (fill.history ?? [percent]).slice(-10)
  const base = 240
  body += `<text x="24" y="${base}" fill="${DIM}" font-size="10" font-weight="600" letter-spacing="1.6">TENDANCE</text>`
  body += history
    .map((one, i) => {
      const x = width - 24 - (history.length - i) * 16 + 4
      const h = 3 + (Math.min(100, one) / 100) * 20
      const isLast = i === history.length - 1

      return `<rect x="${x}" y="${base - h}" width="12" height="${h}" rx="3" fill="${weatherOf(one)?.hue ?? DIM}" fill-opacity="${
        isLast ? 1 : 0.35 + (0.4 * (i + 1)) / history.length
      }"/>`
    })
    .join('')
  body += `<line x1="24" y1="${base + 14}" x2="${width - 24}" y2="${base + 14}" stroke="${LINE}"/>`
  body += `<text x="24" y="${base + 34}" fill="${DIM}" font-size="11"><tspan fill="#f87171">┊</tspan> Trait rouge à ${COMPACT_AT} % : le bon moment pour compacter</text>`

  return frame(width, base + 52, hue, body)
}
