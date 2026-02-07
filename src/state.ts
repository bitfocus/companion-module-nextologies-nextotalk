export interface MeetingInfo {
	meetingId: string
	roomType: string
	isMuted: boolean
	tabId?: string
	sdKeyId?: string
	instant?: boolean
	serialNumber?: number
	roomName?: string
}

export class ModuleState {
	public meetingRoomNumberMap: Record<string, number> = {}
	public meetingIdSDKeyMap: Record<string, string> = {}
	public meetingIdTitleMap: Record<string, string> = {}
	public meetingMicStatusMap: Record<string, boolean> = {}
	private maximumMeetingsAllowed = 100

	public getSerialNumberForMeeting(meetingId: string): number | null {
		const existingSerialNumber = this.meetingRoomNumberMap[meetingId]
		if (existingSerialNumber) return existingSerialNumber

		const nextSerialNumber = Object.values(this.meetingRoomNumberMap).length + 1
		if (nextSerialNumber <= this.maximumMeetingsAllowed) {
			this.meetingRoomNumberMap[meetingId] = nextSerialNumber
			return nextSerialNumber
		}
		return null
	}

	public updateRoomName(meetingId: string, name: string): void {
		this.meetingIdTitleMap[meetingId] = name
	}

	public updateMicStatus(meetingId: string, isMuted: boolean): void {
		this.meetingMicStatusMap[meetingId] = isMuted
	}

	public getRoomByNumber(roomNumber: number): { meetingId: string; name: string; isMuted: boolean } | null {
		for (const [meetingId, num] of Object.entries(this.meetingRoomNumberMap)) {
			if (num === roomNumber) {
				return {
					meetingId,
					name: this.meetingIdTitleMap[meetingId] || meetingId,
					isMuted: this.meetingMicStatusMap[meetingId] ?? true,
				}
			}
		}
		return null
	}

	public reset(): void {
		this.meetingRoomNumberMap = {}
		this.meetingIdSDKeyMap = {}
		this.meetingIdTitleMap = {}
		this.meetingMicStatusMap = {}
	}
}
