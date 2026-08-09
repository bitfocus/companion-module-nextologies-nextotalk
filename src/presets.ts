import type { ModuleInstance } from './main.js'
import { CompanionPresetDefinitions, combineRgb } from '@companion-module/base'

import { EMPTY_KEY_PNG } from './assets.js'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	presets['toggle_mic'] = {
		type: 'button',
		category: 'Meetings',
		name: 'Toggle Mic (Custom)',
		style: {
			text: '',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
			png64: EMPTY_KEY_PNG,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_mic',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'mic_status',
				headline: 'Auto room (by grid position)',
				options: {
					roomNumber: 0,
				},
			},
		],
	}

	presets['toggle_mic_fixed_room'] = {
		type: 'button',
		category: 'Meetings',
		name: 'Toggle Mic (Fixed Room 1)',
		style: {
			text: '',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
			png64: EMPTY_KEY_PNG,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_mic',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'mic_status',
				headline: 'Room 1 (fixed, ignores grid position)',
				options: {
					roomNumber: 1,
				},
			},
		],
	}

	self.setPresetDefinitions(presets)
}
