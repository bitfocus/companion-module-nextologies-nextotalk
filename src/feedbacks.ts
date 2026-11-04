import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { EMPTY_KEY_PNG } from './assets.js'
import { ART_PNG64, renderKeyPng64, type KeyArt } from './key-art.js'

// Fallback only — the room name is normally drawn into the image by renderKeyPng64() so it
// matches the Elgato plugin (bold, same size). Maps the 1-10 level to Companion's title `size`
// with the same ratio, on its 72px button.
function fontSizePxFromLevel(level: number): number {
	return Math.round(72 * (0.125 + level * 0.015))
}

// Key image with the room name drawn in; Companion's own title stays empty. If rendering fails,
// fall back to the plain artwork with the name as a (regular-weight) Companion title.
async function keyStyle(
	self: ModuleInstance,
	art: KeyArt,
	name: string,
	level: number,
): Promise<{ text: string; size: number; png64: string }> {
	try {
		return { text: '', size: fontSizePxFromLevel(level), png64: await renderKeyPng64(art, name, level) }
	} catch (error) {
		self.log('warn', `Key image render failed, using Companion title instead: ${String(error)}`)
		return { text: name, size: fontSizePxFromLevel(level), png64: ART_PNG64[art] }
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.log('info', 'Updating feedback definitions')
	self.setFeedbackDefinitions({
		mic_status: {
			name: 'Microphone Status',
			type: 'advanced',
			options: [
				{
					id: 'roomNumber',
					type: 'number',
					label: 'Room Number (0 for Auto/None)',
					description:
						'0 = auto-map to whichever room the extension assigns to this button’s grid position. A specific number pins the button to that room, regardless of position.',
					default: 0,
					min: 0,
					max: 9999,
				},
			],
			callback: async (feedback, context) => {
				self.log('debug', `Feedback callback triggered for controlId: ${feedback.controlId}`)
				// 1. DYNAMIC COORDINATE DISCOVERY (The "Top Bar" Grabber)
				await self.discoverActionCoordinates(feedback.controlId, context)

				// 2. STATUS RENDERING
				const roomNumberSetting = Number(feedback.options.roomNumber)
				let meetingId: string | null = null

				if (roomNumberSetting > 0) {
					self.log('debug', `Looking up meeting for room number: ${roomNumberSetting}`)
					for (const [id, num] of Object.entries(self.state.meetingRoomNumberMap)) {
						if (num === roomNumberSetting) {
							meetingId = id
							self.log('debug', `Found meetingId ${meetingId} for room number ${roomNumberSetting}`)
							break
						}
					}
					if (!meetingId) {
						self.log('debug', `No meeting found for room number ${roomNumberSetting}`)
					}
				} else {
					const actionId = self.controlIdToActionId.get(feedback.controlId)
					if (actionId) {
						meetingId = self.state.getMeetingIdForAction(actionId)
						self.log('debug', `Auto mode: actionId ${actionId} mapped to meetingId ${meetingId}`)
					} else {
						self.log('debug', `Auto mode: no actionId found for controlId ${feedback.controlId}`)
					}
				}

				if (meetingId) {
					const info = self.state.getRoomInfoForMeeting(meetingId)
					if (info) {
						if (!info.isActive || !info.hasMicStatus) {
							self.log(
								'debug',
								`Meeting ${meetingId} (${info.name}) is ${!info.isActive ? 'inactive' : 'active but has no mic status yet'}`,
							)
							return {
								bgcolor: combineRgb(0, 0, 0),
								color: combineRgb(100, 100, 100),
								...(await keyStyle(self, 'empty', info.name, info.fontSize)),
							}
						}
						self.log(
							'debug',
							`FEEDBACK STATUS [${meetingId}]: Muted=${info.isMuted} (${info.isMuted ? 'RED' : 'GREEN'}), Busy=${info.isBusy}, Speaking=${info.isSpeaking}, Active=${info.isActive}`,
						)

						// Priority: Busy (Orange) > Speaking (Blue) > Muted (Red) > Unmuted (Green)
						let bgcolor = info.isMuted ? combineRgb(255, 0, 0) : combineRgb(0, 200, 0)
						const art: KeyArt = info.isMuted ? 'muted' : 'unmuted'

						if (info.isBusy) {
							bgcolor = combineRgb(255, 166, 0) // Orange
						} else if (info.isSpeaking) {
							bgcolor = combineRgb(17, 65, 211) // Blue
						}

						return {
							bgcolor,
							color: combineRgb(255, 255, 255),
							...(await keyStyle(self, art, info.name, info.fontSize)),
						}
					} else {
						const allAllocated = Object.keys(self.state.meetingRoomNumberMap).join(', ')
						self.log('warn', `No room info found for meetingId [${meetingId}]. Available: ${allAllocated}`)
					}
				}

				self.log('debug', `Returning default feedback for controlId ${feedback.controlId}`)
				return {
					bgcolor: combineRgb(0, 0, 0),
					color: combineRgb(100, 100, 100),
					text: '',
					size: fontSizePxFromLevel(5),
					png64: EMPTY_KEY_PNG,
				}
			},
		},
	})
}
