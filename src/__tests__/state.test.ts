import { describe, expect, it } from 'vitest'
import { ModuleState } from '../state.js'

describe('ModuleState.updateMicStatus', () => {
	it('leaves the mic state unknown when no mute value is given, so a mapped room renders neutral', () => {
		const state = new ModuleState()
		state.mapActionToMeeting('action-1', 'abc-defg-hij')
		state.updateMicStatus('abc-defg-hij', undefined, true, undefined)

		const info = state.getRoomInfoForMeeting('abc-defg-hij')
		expect(info).not.toBeNull()
		expect(info?.hasMicStatus).toBe(false)
		expect(info?.isBusy).toBe(true)
	})

	it('records the mute state when one is given', () => {
		const state = new ModuleState()
		state.mapActionToMeeting('action-1', 'abc-defg-hij')
		state.updateMicStatus('abc-defg-hij', false)

		const info = state.getRoomInfoForMeeting('abc-defg-hij')
		expect(info?.hasMicStatus).toBe(true)
		expect(info?.isMuted).toBe(false)
	})
})
