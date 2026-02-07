import type { ModuleInstance } from './main.js'
import { CompanionPresetDefinitions, combineRgb } from '@companion-module/base'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	for (let i = 1; i <= 5; i++) {
		presets[`room_${i}`] = {
			type: 'button',
			category: 'Rooms',
			name: `Room ${i}`,
			style: {
				text: `$(nextotalk:room_${i}_name)\n$(nextotalk:room_${i}_status)`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'toggle_mic',
							options: { roomNumber: i },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'mic_muted',
					options: { roomNumber: i },
					style: {
						bgcolor: combineRgb(200, 0, 0),
					},
				},
			],
		}
	}

	self.setPresetDefinitions(presets)
}
