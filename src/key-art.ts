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

let wasmReady: Promise<void> | undefined
async function ensureRenderer(): Promise<void> {
	wasmReady ??= initWasm(Buffer.from(RESVG_WASM_BASE64, 'base64'))
	return wasmReady
}

// Same ratio as the Elgato plugin's fontPx() and the extension's roomNameFontRatio().
function fontPx(level: number): number {
	const clamped = Math.max(1, Math.min(10, Number(level) || 5))
	return Math.floor(KEY_SIZE * (0.125 + clamped * 0.015))
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// `name` is already line-broken by lineBreakedMeetingTitle() in main.ts.
function keySvg(artPng64: string, name: string, level: number): string {
	const lines = name.split('\n').filter((l) => l.length > 0)
	let text = ''
	if (lines.length) {
		const size = fontPx(level)
		const lineHeight = size * 1.2
		const firstY = KEY_SIZE / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.35
		text = lines
			.map(
				(l, i) =>
					`<text x="${KEY_SIZE / 2}" y="${(firstY + i * lineHeight).toFixed(1)}" font-family="${FONT_FAMILY}" font-weight="bold" font-size="${size}" fill="white" text-anchor="middle">${escapeXml(l)}</text>`,
			)
			.join('')
	}
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${KEY_SIZE}" height="${KEY_SIZE}" viewBox="0 0 ${KEY_SIZE} ${KEY_SIZE}">` +
		`<image href="data:image/png;base64,${artPng64}" x="0" y="0" width="${KEY_SIZE}" height="${KEY_SIZE}" preserveAspectRatio="none"/>` +
		text +
		`</svg>`
	)
}

// Feedbacks re-run often with the same inputs; keep recent renders.
const cache = new Map<string, string>()
const CACHE_LIMIT = 200

// Returns the key image (artwork + room name) as base64 PNG for a feedback's `png64`.
export async function renderKeyPng64(art: KeyArt, name: string, level: number): Promise<string> {
	const cacheKey = `${art}|${level}|${name}`
	const cached = cache.get(cacheKey)
	if (cached) return cached

	await ensureRenderer()
	const resvg = new Resvg(keySvg(ART_PNG64[art], name, level), {
		fitTo: { mode: 'width', value: KEY_SIZE },
		font: { fontBuffers: [FONT_BYTES], defaultFontFamily: FONT_FAMILY, loadSystemFonts: false },
	})
	const png64 = Buffer.from(resvg.render().asPng()).toString('base64')

	if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
	cache.set(cacheKey, png64)
	return png64
}
