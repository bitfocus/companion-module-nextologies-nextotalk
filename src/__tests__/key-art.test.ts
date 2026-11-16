import { describe, expect, it } from 'vitest'
import { fitFontPx, fontPx, renderKeyPng64, wrapRoomName } from '../key-art.js'

describe('wrapRoomName', () => {
	it('puts one word per line, keeping hyphens and underscores at the end of a line', () => {
		expect(wrapRoomName('Control Room One')).toBe('Control\nRoom\nOne')
		expect(wrapRoomName('abc-defg-hij')).toBe('abc-\ndefg-\nhij')
		expect(wrapRoomName('studio_a')).toBe('studio_\na')
	})

	it('is idempotent, so names that were already broken are unchanged', () => {
		const once = wrapRoomName('Control Room abc-defg-hij')
		expect(wrapRoomName(once)).toBe(once)
	})

	it('returns an empty string for an empty name', () => {
		expect(wrapRoomName('')).toBe('')
	})
})

describe('fitFontPx', () => {
	it('keeps the level font size when every line fits', async () => {
		await renderKeyPng64('empty', 'Room 1', 5) // initialises the renderer
		expect(fitFontPx(['Room', '1'], 5)).toBe(fontPx(5))
	})

	it('shrinks the font so a single wide word fits inside the key', async () => {
		await renderKeyPng64('empty', 'x', 5)
		const shrunk = fitFontPx(['Conference'], 5)
		expect(shrunk).toBeLessThan(fontPx(5))
		expect(shrunk).toBeGreaterThanOrEqual(10)
		// A larger level still gets shrunk to the same width, so it lands on the same size.
		expect(fitFontPx(['Conference'], 10)).toBe(shrunk)
	})
})

describe('renderKeyPng64', () => {
	it('renders a PNG for an unbroken name (the meeting-id fallback) and for an empty name', async () => {
		const png = await renderKeyPng64('muted', 'abc-defg-hij', 5)
		expect(Buffer.from(png, 'base64').subarray(1, 4).toString()).toBe('PNG')
		const empty = await renderKeyPng64('empty', '', 5)
		expect(Buffer.from(empty, 'base64').subarray(1, 4).toString()).toBe('PNG')
	})

	it('returns the same image for the same inputs (cached) and a different one for a different name', async () => {
		const a = await renderKeyPng64('unmuted', 'Team Sync', 5)
		const b = await renderKeyPng64('unmuted', 'Team Sync', 5)
		const c = await renderKeyPng64('unmuted', 'Team Stand-up', 5)
		expect(a).toBe(b)
		expect(c).not.toBe(a)
	})
})
