import { describe, expect, it, vi } from 'vitest'
import { SocketCommandActionType, SocketCommandType } from '../command.js'

// main.ts's own top-level `runEntrypoint(ModuleInstance, UpgradeScripts)` call runs the moment
// this module is imported — outside the real Companion runtime it can't find MODULE_MANIFEST
// and calls process.exit(1), which Vitest reports as an unhandled rejection. That's a property
// of importing this file at all, unrelated to what we're testing, so neutralize process.exit
// before importing rather than letting it fail the whole test run.
vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
const { ModuleInstance } = await import('../main.js')

// handleMessage is a private instance method with no interesting dependency on the rest of
// ModuleInstance's construction for this specific case (it only calls this.log/this.broadcast
// before reaching the switch) — invoke it via .call() against a minimal fake `this` instead of
// constructing a real ModuleInstance (which needs the full Companion runtime).
function callHandleMessage(
	fakeThis: { log: ReturnType<typeof vi.fn>; broadcast: ReturnType<typeof vi.fn> },
	ws: unknown,
	command: unknown,
) {
	;(
		ModuleInstance.prototype as unknown as { handleMessage: (ws: unknown, command: unknown) => void }
	).handleMessage.call(fakeThis, ws, command)
}

describe('handleMessage — hid_button_pressed', () => {
	it('relays the command to other clients via broadcast, excluding the sender', () => {
		const fakeThis = { log: vi.fn(), broadcast: vi.fn() }
		const fakeWs = { id: 'sender' }
		const command = {
			type: SocketCommandType.Event,
			action: SocketCommandActionType.HidButtonPressed,
			data: { meetingId: 'multiviewer-1', keyId: 'k1', deviceId: 'd1', roomType: 'multiviewer', tabId: null },
		}

		callHandleMessage(fakeThis, fakeWs, command)

		expect(fakeThis.broadcast).toHaveBeenCalledTimes(1)
		expect(fakeThis.broadcast).toHaveBeenCalledWith(command, fakeWs)
	})

	it('does not fall through to the "Unhandled WS action" default case', () => {
		const fakeThis = { log: vi.fn(), broadcast: vi.fn() }
		const command = {
			type: SocketCommandType.Event,
			action: SocketCommandActionType.HidButtonPressed,
			data: {},
		}

		callHandleMessage(fakeThis, {}, command)

		expect(fakeThis.log).not.toHaveBeenCalledWith('warn', expect.stringContaining('Unhandled WS action'))
	})
})
