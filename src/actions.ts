import { SocketCommandActionType, SocketCommandType } from './command.js'
import type { ModuleInstance } from './main.js'

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		toggle_mic: {
			name: 'Toggle Microphone',
			description:
				'Toggles the mic of the room mapped to this button at runtime. This action has no options — the extension binds a button to a room by grid position, not by manual configuration.',
			options: [],
			callback: async (event) => {
				const meetingId = self.state.getMeetingIdForAction(event.id)
				const roomInfo = meetingId ? self.state.getRoomInfoForMeeting(meetingId) : null

				if (!meetingId || !roomInfo) {
					self.log('warn', `Action ${event.id} is not mapped to any room.`)
					return
				}

				if (!self.hasConnectedClients) {
					self.log('warn', `Toggle for ${meetingId} ignored — no client connected to deliver it to.`)
					return
				}

				// Optimistically toggle the local status first for instant feedback
				const newMutedState = !roomInfo.isMuted
				self.state.updateMicStatus(meetingId, newMutedState)
				self.checkFeedbacks('mic_status')

				self.log('debug', `Toggling mic for ${meetingId} (New state: ${newMutedState ? 'Muted' : 'Unmuted'})`)
				self.broadcast({
					type: SocketCommandType.Request,
					action: SocketCommandActionType.ToggleMic,
					data: {
						roomNumber: roomInfo.roomNumber,
						meetingId: meetingId,
					},
				})
			},
			subscribe: async (action, context) => {
				self.log('debug', `Action Subscribe: ${JSON.stringify(action)}`)
				// Discover coordinates immediately so sd_key_appear can be broadcast
				// without waiting for the feedback callback to run (which only happens
				// while the button is being rendered somewhere).
				await self.discoverActionCoordinates(action.controlId, context)
				self.onActionAppearance(action, true)
			},
			unsubscribe: (action) => {
				self.log('debug', `Action Unsubscribe: ${JSON.stringify(action)}`)
				self.onActionAppearance(action, false)
			},
		},
	})
}
