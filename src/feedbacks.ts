import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		mic_muted: {
			name: 'Microphone Muted',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
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
			callback: (feedback) => {
				const room = self.state.getRoomByNumber(Number(feedback.options.roomNumber))
				return room ? room.isMuted : true
			},
		},
	})
}
