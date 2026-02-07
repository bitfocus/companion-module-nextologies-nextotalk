import { SocketCommandActionType, SocketCommandType } from './command.js'
import type { ModuleInstance } from './main.js'

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		toggle_mic: {
			name: 'Toggle Microphone',
			options: [
				{
					id: 'roomNumber',
					type: 'number',
					label: 'Room Number',
					default: 1,
					min: 1,
					max: 100,
				},
			],
			callback: async (event) => {
				self.broadcast({
					type: SocketCommandType.Request,
					action: SocketCommandActionType.ToggleMic,
					data: {
						roomNumber: event.options.roomNumber,
					},
				})
			},
		},
	})
}
