import type { ContextFill, Step } from '../types'

// The two cards drawn as SVG on the surfaces that draw it (desktop, VS Code,
// the mobile app): the plan as a path of steps, the context as a weather.

export const CARD_WIDTH = 360
export const COMPACT_AT = 75

const INK = '#ece4dd'
const DIM = '#8d827a'
const FAINT = '#4a3f39'
const ORANGE = '#f47b3c'
const GLOW = '#ffad6e'
const RED = '#e5484d'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

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

const frame = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">` +
  '<defs>' +
  '<linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#2a1d16"/><stop offset="1" stop-color="#141010"/></linearGradient>' +
  `<linearGradient id="fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GLOW}"/><stop offset="1" stop-color="${ORANGE}"/></linearGradient>` +
  `<radialGradient id="halo"><stop offset="0.55" stop-color="${ORANGE}" stop-opacity="0.35"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="corner" cx="0" cy="0" r="1"><stop offset="0" stop-color="${ORANGE}" stop-opacity="0.16"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>` +
  `<linearGradient id="hot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GLOW}"/><stop offset="0.7" stop-color="${ORANGE}"/><stop offset="1" stop-color="${RED}"/></linearGradient>` +
  `<linearGradient id="puff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9dcd2"/><stop offset="1" stop-color="#a8968a"/></linearGradient>` +
  `<linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e7d72"/><stop offset="1" stop-color="#55463e"/></linearGradient>` +
  '</defs>' +
  `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="20" fill="url(#bg)"/>` +
  `<rect x="1" y="1" width="${width - 2}" height="${Math.min(height - 2, 220)}" rx="20" fill="url(#corner)"/>` +
  `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="20" fill="none" stroke="${ORANGE}" stroke-opacity="0.3"/>` +
  `<line x1="28" y1="1.5" x2="${width - 28}" y2="1.5" stroke="#ffffff" stroke-opacity="0.14"/>` +
  body +
  '</svg>'

const header = (left: string, right: string | undefined, width: number) =>
  `<text x="24" y="34" fill="${INK}" font-size="11" font-weight="700" letter-spacing="2.2">${esc(left)}</text>` +
  (right === undefined
    ? ''
    : `<text x="${width - 24}" y="34" text-anchor="end" fill="${ORANGE}" font-size="11" font-weight="800" letter-spacing="2.2">${esc(right)}</text>`)

// A rounded track, filled to `ratio`, with a knob at the fill's end.
const bar = (y: number, ratio: number, width: number, ticks: number, paint = 'fill') => {
  const x = 24
  const span = width - 48
  const end = x + span * Math.max(0, Math.min(1, ratio))
  const marks = Array.from({ length: Math.max(0, ticks - 1) }, (_, i) => {
    const tx = x + (span * (i + 1)) / ticks

    return `<line x1="${tx}" y1="${y - 3}" x2="${tx}" y2="${y + 3}" stroke="#ffffff" stroke-opacity="0.12"/>`
  }).join('')

  return (
    `<rect x="${x}" y="${y - 4}" width="${span}" height="8" rx="4" fill="#ffffff" fill-opacity="0.07"/>` +
    marks +
    (ratio > 0 ? `<rect x="${x}" y="${y - 4}" width="${end - x}" height="8" rx="4" fill="url(#${paint})"/>` : '') +
    `<circle cx="${end}" cy="${y}" r="10" fill="${ORANGE}" fill-opacity="0.18"/>` +
    `<circle cx="${end}" cy="${y}" r="6.5" fill="#efe5dd" stroke="#2a1d16" stroke-width="2"/>`
  )
}

const check = (cx: number, cy: number) =>
  `<circle cx="${cx}" cy="${cy}" r="11" fill="${ORANGE}"/>` +
  `<path d="M${cx - 5} ${cy} l3.5 3.6 l6.5 -7" fill="none" stroke="#1a1310" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`

const numbered = (cx: number, cy: number, n: number, isCurrent: boolean) =>
  (isCurrent ? `<circle cx="${cx}" cy="${cy}" r="16" fill="url(#halo)"/>` : '') +
  `<circle cx="${cx}" cy="${cy}" r="11" fill="#1a1310" stroke="${isCurrent ? ORANGE : DIM}" stroke-width="${isCurrent ? 2 : 1.4}"/>` +
  `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${isCurrent ? INK : DIM}" font-size="11" font-weight="700">${n}</text>`

/** The plan card: its name, how far along, and each step on a path. */
export const planCard = (steps: readonly Step[], title: string | undefined, width = CARD_WIDTH) => {
  if (steps.length === 0) {
    return frame(
      width,
      132,
      header('PARCOURS DU PLAN', undefined, width) +
        `<text x="24" y="76" fill="${ORANGE}" font-size="24" font-weight="800" font-style="italic">Pas de plan en cours</text>` +
        `<text x="24" y="104" fill="${INK}" fill-opacity="0.8" font-size="12.5">${tspans(
          wrap('Il s’affiche dès que Claude découpe la tâche en étapes.', 44, 2),
          24,
          16,
        )}</text>`,
    )
  }

  const total = steps.length
  const done = steps.filter(one => one.status === 'completed').length
  const current = steps.findIndex(one => one.status === 'in_progress')
  const isDone = done === total
  const titleLines = wrap(title ?? 'Plan de la tâche', 26, 2)
  let y = 74
  let body = header(
    'PARCOURS DU PLAN',
    isDone ? 'TERMINÉ' : current >= 0 ? `ÉTAPE ${current + 1} / ${total}` : `${done} / ${total}`,
    width,
  )
  body += `<text x="24" y="${y}" fill="${ORANGE}" font-size="23" font-weight="800" font-style="italic">${tspans(titleLines, 24, 28)}</text>`
  y += (titleLines.length - 1) * 28 + 32
  body += bar(y, done / total, width, total)
  y += 26
  body += `<text x="${width - 24}" y="${y}" text-anchor="end" fill="${INK}" fill-opacity="0.85" font-size="12.5">${done} / ${total} faites</text>`
  y += 22

  const rows: string[] = []
  const centers: number[] = []
  for (const [i, step] of steps.entries()) {
    const isCurrent = i === current
    const lines = wrap(step.label, isCurrent ? 30 : 34, 3)
    const detail = isCurrent && step.detail !== undefined && step.detail !== step.label ? wrap(step.detail, 34, 2) : []
    const textHeight = lines.length * 19 + (detail.length > 0 ? 8 + detail.length * 17 : 0)
    const rowHeight = Math.max(30, textHeight) + (isCurrent ? 26 : 18)
    const top = y
    const cy = top + (isCurrent ? 13 : 9) + 11
    centers.push(cy)

    let row = ''
    if (isCurrent) {
      row += `<rect x="16" y="${top}" width="${width - 32}" height="${rowHeight - 6}" rx="14" fill="${ORANGE}" fill-opacity="0.08" stroke="${ORANGE}" stroke-opacity="0.55"/>`
    }
    row += step.status === 'completed' ? check(46, cy) : numbered(46, cy, i + 1, isCurrent)
    const textY = cy + 5
    row += `<text x="74" y="${textY}" fill="${step.status === 'completed' ? INK : INK}" fill-opacity="${
      step.status === 'completed' ? 0.62 : isCurrent ? 1 : 0.9
    }" font-size="${isCurrent ? 15.5 : 14.5}" font-weight="${isCurrent ? 800 : 400}">${tspans(lines, 74, 19)}</text>`
    if (detail.length > 0) {
      row += `<text x="74" y="${textY + lines.length * 19 + 6}" fill="${GLOW}" font-size="12.5" font-style="italic">${tspans(detail, 74, 17)}</text>`
    }
    rows.push(row)
    y += rowHeight
  }
  // The path joining the steps, drawn under them, lit as far as the plan went.
  const reached = current >= 0 ? current : done - 1
  const path =
    centers.length > 1
      ? `<line x1="46" y1="${centers[0]}" x2="46" y2="${centers[centers.length - 1]}" stroke="${FAINT}" stroke-width="1.5"/>` +
        (reached > 0
          ? `<line x1="46" y1="${centers[0]}" x2="46" y2="${centers[Math.min(reached, centers.length - 1)]}" stroke="${ORANGE}" stroke-opacity="0.7" stroke-width="2"/>`
          : '')
      : ''
  body += path + rows.join('')

  if (isDone) {
    const mid = width / 2
    body +=
      `<line x1="40" y1="${y + 10}" x2="${mid - 70}" y2="${y + 10}" stroke="${ORANGE}" stroke-opacity="0.35"/>` +
      `<line x1="${mid + 70}" y1="${y + 10}" x2="${width - 40}" y2="${y + 10}" stroke="${ORANGE}" stroke-opacity="0.35"/>` +
      `<text x="${mid}" y="${y + 17}" text-anchor="middle" fill="${ORANGE}" font-size="19" font-weight="800" font-style="italic">Plan bouclé</text>` +
      [[-84, -4], [86, 2], [-76, 10], [78, -8]]
        .map(([dx, dy], i) => `<circle cx="${mid + dx!}" cy="${y + 6 + dy!}" r="${i % 2 === 0 ? 1.6 : 1.1}" fill="${GLOW}"/>`)
        .join('')
    y += 34
  }

  return frame(width, y + 18, body)
}

// The weather the context window is in, from clear sky to storm.
export const WEATHER = [
  { upTo: 40, icon: '☀️', label: 'Grand soleil', note: 'Plein de place', color: 'success', sky: 'sun' },
  { upTo: 60, icon: '🌤️', label: 'Éclaircies', note: 'Tout va bien', color: 'success', sky: 'sunCloud' },
  { upTo: 75, icon: '⛅', label: 'Nuageux', note: 'Ça se remplit', color: 'warning', sky: 'cloud' },
  { upTo: 85, icon: '🌧️', label: 'Averses', note: 'Penser à résumer bientôt', color: 'warning', sky: 'rain' },
  { upTo: 95, icon: '⛈️', label: 'Orage', note: 'Compaction proche', color: 'error', sky: 'storm' },
  { upTo: 101, icon: '🌪️', label: 'Tempête', note: 'Compaction imminente', color: 'error', sky: 'tornado' },
] as const

export type Weather = (typeof WEATHER)[number]

export const weatherOf = (percent: number | undefined): Weather | undefined =>
  percent === undefined ? undefined : WEATHER.find(w => percent < w.upTo)

const cloud = (x: number, y: number, s: number, color: string) =>
  `<path transform="translate(${x} ${y}) scale(${s})" fill="${color}" d="M-22 10 a12 12 0 0 1 4 -23 a17 17 0 0 1 32 -4 a13 13 0 0 1 10 27 z"/>`

const sun = (x: number, y: number, r: number) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = x + Math.cos(a) * (r + 5)
    const y1 = y + Math.sin(a) * (r + 5)
    const x2 = x + Math.cos(a) * (r + 11)
    const y2 = y + Math.sin(a) * (r + 11)

    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${GLOW}" stroke-width="3" stroke-linecap="round"/>`
  }).join('') + `<circle cx="${x}" cy="${y}" r="${r}" fill="${GLOW}"/>`

const drops = (x: number, y: number, color: string) =>
  [0, 1, 2]
    .map(i => `<line x1="${x - 10 + i * 10}" y1="${y}" x2="${x - 14 + i * 10}" y2="${y + 11}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`)
    .join('')

// The sky drawn in the round badge, centred on (x, y).
const sky = (kind: Weather['sky'], x: number, y: number) => {
  switch (kind) {
    case 'sun':
      return sun(x, y, 14)
    case 'sunCloud':
      return sun(x - 7, y - 7, 9) + cloud(x + 3, y + 9, 0.62, 'url(#puff)')
    case 'cloud':
      return cloud(x - 7, y - 3, 0.48, 'url(#dark)') + cloud(x + 3, y + 7, 0.64, 'url(#puff)')
    case 'rain':
      return cloud(x + 1, y - 2, 0.64, 'url(#puff)') + drops(x + 1, y + 13, '#9cc3f0')
    case 'storm':
      return (
        cloud(x + 1, y - 4, 0.64, 'url(#dark)') +
        `<path d="M${x + 1} ${y + 4} l-7 11 h6 l-3 10 l11 -14 h-6 l4 -7 z" fill="${GLOW}"/>`
      )
    case 'tornado':
      return [0, 1, 2, 3, 4]
        .map(i => {
          const w = 32 - i * 6

          return `<line x1="${x - w / 2 + i * 2}" y1="${y - 15 + i * 7.5}" x2="${x + w / 2 + i * 2}" y2="${y - 15 + i * 7.5}" stroke="${i % 2 === 0 ? '#c9b8aa' : DIM}" stroke-width="4" stroke-linecap="round"/>`
        })
        .join('')
  }
}

const kilo = (n: number) => `${Math.round(n / 1000)}k`

/** The weather card: the fill as a sky, a gauge with the line to compact at, and the recent trend. */
export const weatherCard = (fill: ContextFill, width = CARD_WIDTH) => {
  const percent = fill.percent
  const weather = weatherOf(percent)
  let body = header('MÉTÉO DU CONTEXTE', undefined, width)

  if (weather === undefined || percent === undefined) {
    body +=
      `<text x="24" y="80" fill="${ORANGE}" font-size="22" font-weight="800" font-style="italic">En attente…</text>` +
      `<text x="24" y="106" fill="${INK}" fill-opacity="0.8" font-size="12.5">La météo arrive après la première réponse de Claude.</text>`

    return frame(width, 132, body)
  }

  const cx = 76
  const cy = 112
  body +=
    `<circle cx="${cx}" cy="${cy}" r="46" fill="url(#halo)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="34" fill="#1d1512" stroke="${ORANGE}" stroke-width="2"/>` +
    sky(weather.sky, cx, cy) +
    `<text x="142" y="92" fill="${ORANGE}" font-size="26" font-weight="800" font-style="italic">${esc(weather.label)}</text>` +
    `<text x="142" y="128" fill="${INK}" font-size="32" font-weight="800" font-style="italic">${percent}<tspan font-size="17" dx="4">%</tspan></text>` +
    `<text x="142" y="149" fill="${INK}" fill-opacity="0.85" font-size="12.5">${kilo(fill.tokens ?? 0)} / ${kilo(fill.window)} jetons</text>` +
    `<text x="142" y="166" fill="${GLOW}" fill-opacity="0.9" font-size="12" font-style="italic">${esc(weather.note)}</text>`

  const gaugeY = 204
  const redX = 24 + ((width - 48) * COMPACT_AT) / 100
  body +=
    `<text x="${redX}" y="${gaugeY - 15}" text-anchor="middle" fill="${RED}" font-size="10" font-weight="700">${COMPACT_AT} %</text>` +
    `<line x1="${redX}" y1="${gaugeY - 11}" x2="${redX}" y2="${gaugeY + 11}" stroke="${RED}" stroke-width="2" stroke-dasharray="3 2.5"/>` +
    bar(gaugeY, percent / 100, width, 4, percent >= COMPACT_AT ? 'hot' : 'fill')

  // The last fills, oldest first, as small bars growing with the fill.
  const history = (fill.history ?? [percent]).slice(-8)
  const barsRight = width - 24
  const base = 258
  body += `<text x="24" y="${base - 4}" fill="${DIM}" font-size="10.5" font-weight="700" letter-spacing="1.6">TENDANCE</text>`
  body += history
    .map((one, i) => {
      const x = barsRight - (history.length - i) * 24 + 4
      const h = 3 + (Math.min(100, one) / 100) * 22
      const isLast = i === history.length - 1

      return `<rect x="${x}" y="${base - h}" width="18" height="${h}" rx="4" fill="${isLast ? GLOW : ORANGE}" fill-opacity="${
        isLast ? 1 : 0.25 + (0.5 * (i + 1)) / history.length
      }"/>`
    })
    .join('')
  body += `<text x="24" y="286" fill="${INK}" fill-opacity="0.75" font-size="11.5">Trait rouge : ${COMPACT_AT} %, le moment de compacter</text>`

  return frame(width, 306, body)
}
