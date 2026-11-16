import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { RESVG_WASM_BASE64, ROOM_NAME_FONT_BASE64 } from './generated/render-assets.js'
import { EMPTY_KEY_PNG, MUTE_KEY_PNG, UNMUTE_KEY_PNG } from './assets.js'

// Companion's button style can only set the title's size — it always draws it in its own,
// regular-weight font. To look like the Elgato plugin's keys (bold, same size and placement)
// the room name is drawn into the button image here instead, from the same SVG the plugin
// builds (streamdeck-gmeet-controller src/key-art.ts), and the Companion title is left empty.

export type KeyArt = 'empty' | 'muted' | 'unmuted'
export const ART_PNG64: Record<KeyArt, string> = { empty: EMPTY_KEY_PNG, muted: MUTE_KEY_PNG, unmuted: UNMUTE_KEY_PNG }

const KEY_SIZE = 144 // rendered at 2x; Companion scales the image to the button
const FONT_FAMILY = 'Arimo' // metric-compatible with Helvetica/Arial, the plugin's font
const FONT_BYTES = Buffer.from(ROOM_NAME_FONT_BASE64, 'base64')
const FONT_OPTIONS = { fontBuffers: [FONT_BYTES], defaultFontFamily: FONT_FAMILY, loadSystemFonts: false }

// Widest a line may be before the font is shrunk: the key minus a small margin on each side.
const MAX_TEXT_WIDTH = KEY_SIZE - 8
const MIN_FONT_PX = 10

let wasmReady: Promise<void> | undefined
async function ensureRenderer(): Promise<void> {
	wasmReady ??= initWasm(Buffer.from(RESVG_WASM_BASE64, 'base64'))
	return wasmReady
}

// Same ratio as the Elgato plugin's fontPx() and the extension's roomNameFontRatio().
export function fontPx(level: number): number {
	const clamped = Math.max(1, Math.min(10, Number(level) || 5))
	return Math.floor(KEY_SIZE * (0.125 + clamped * 0.015))
}

// One line per word: breaks at every space (dropped), hyphen and underscore (kept at the end of
// the line), whatever the name's length. Mirrors offscreen.js's wrapText() in the extension and
// the Elgato plugin's wrapText(). Idempotent, so names that were already broken are unchanged.
export function wrapRoomName(name: string): string {
	if (!name) return ''
	return name
		.split(/\s+|(?<=[-_])/)
		.filter(Boolean)
		.join('\n')
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function textSvg(lines: string[], size: number): string {
	const lineHeight = size * 1.2
	const firstY = KEY_SIZE / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.35
	return lines
		.map(
			(l, i) =>
				`<text x="${KEY_SIZE / 2}" y="${(firstY + i * lineHeight).toFixed(1)}" font-family="${FONT_FAMILY}" font-weight="bold" font-size="${size}" fill="white" text-anchor="middle">${escapeXml(l)}</text>`,
		)
		.join('')
}

function svgDocument(body: string): string {
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${KEY_SIZE}" height="${KEY_SIZE}" viewBox="0 0 ${KEY_SIZE} ${KEY_SIZE}">` +
		body +
		`</svg>`
	)
}

// Width in px of the widest line when drawn at `size`. Measured by resvg itself with the bundled
// font, so it matches what the final render will do. Each resvg-wasm object lives outside the
// JS heap (only RenderedImage is registered for GC) and must be freed explicitly.
function measureWidestLine(lines: string[], size: number): number {
	const resvg = new Resvg(svgDocument(textSvg(lines, size)), { font: FONT_OPTIONS })
	try {
		const bbox = resvg.getBBox()
		if (!bbox) return 0
		try {
			return bbox.width
		} finally {
			bbox.free()
		}
	} finally {
		resvg.free()
	}
}

// Font size for the room's level, reduced if needed so the widest line fits inside the key.
// Text width scales linearly with the font size, so one measurement is enough. Exported for tests.
export function fitFontPx(lines: string[], level: number): number {
	const size = fontPx(level)
	if (!lines.length) return size
	const width = measureWidestLine(lines, size)
	if (width <= MAX_TEXT_WIDTH) return size
	return Math.max(MIN_FONT_PX, Math.floor((size * MAX_TEXT_WIDTH) / width))
}

function keySvg(artPng64: string, lines: string[], size: number): string {
	return svgDocument(
		`<image href="data:image/png;base64,${artPng64}" x="0" y="0" width="${KEY_SIZE}" height="${KEY_SIZE}" preserveAspectRatio="none"/>` +
			(lines.length ? textSvg(lines, size) : ''),
	)
}

// Feedbacks re-run often with the same inputs; keep recent renders, most recently used last so
// the rooms in daily use are not the ones evicted and redrawn.
const cache = new Map<string, string>()
const CACHE_LIMIT = 200

// Returns the key image (artwork + room name) as base64 PNG for a feedback's `png64`.
export async function renderKeyPng64(art: KeyArt, name: string, level: number): Promise<string> {
	const cacheKey = `${art}|${level}|${name}`
	const cached = cache.get(cacheKey)
	if (cached !== undefined) {
		cache.delete(cacheKey)
		cache.set(cacheKey, cached)
		return cached
	}

	await ensureRenderer()
	const lines = wrapRoomName(name)
		.split('\n')
		.filter((l) => l.length > 0)
	const size = fitFontPx(lines, level)

	const resvg = new Resvg(keySvg(ART_PNG64[art], lines, size), {
		fitTo: { mode: 'width', value: KEY_SIZE },
		font: FONT_OPTIONS,
	})
	let png64: string
	try {
		const img = resvg.render()
		try {
			png64 = Buffer.from(img.asPng()).toString('base64')
		} finally {
			img.free()
		}
	} finally {
		resvg.free()
	}

	if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
	cache.set(cacheKey, png64)
	return png64
}
