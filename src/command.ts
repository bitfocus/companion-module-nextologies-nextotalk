export enum SocketCommandType {
	Request = 'request',
	Response = 'response',
	Event = 'event',
}

export enum SocketCommandActionType {
	Welcome = 'welcome',
	Join = 'join',
	Reset = 'reset',
	ClientDisconnected = 'client_disconnected',
	GetMicControllerKeys = 'get_mic_controller_keys',
	GetStreamDeckDevices = 'get_sd_devices',
	StreamDeckKeyAppear = 'sd_key_appear',
	StreamDeckKeyDisappear = 'sd_key_disappear',
	StreamDeckGlobalSettings = 'sd_global_settings',
	MapMeetingRoomToKey = 'map_meeting_room_to_key',
	MapSDKeyToRoom = 'map_sdkey_to_room',
	UpdateMicStatus = 'update_mic_status',
	ActionUpdated = 'action_updated',
	ToggleMic = 'toggle_mic',
	ActionRemoved = 'action_removed',
	ReleaseKey = 'release_key',
	UpdateRoomName = 'update_room_name',
	PersistedRoomMeta = 'persisted_room_meta',
	NextoTalkRooms = 'nextotalk_rooms',
	ParticipantAudioMuted = 'participant_audio_muted',
	ParticipantAudioUnmuted = 'participant_audio_unmuted',
	ParticipantBusyStatus = 'participant_busy_status',
	RoomActivityIndicatorEnabledStatus = 'room_activity_indicator_enabled_status',
	AllocateRoom = 'allocate_room',
	RoomAllocated = 'room_allocated',
}

export type RoomMeta = {
	roomName?: string
	roomNumber: number
	sdKeyId: string
}

interface MapSDKeyToRoomData {
	meetingId?: string | number | null
	sdKeyId: string
	coordinates?: { row: number; column: number }
}

interface MapMeetingRoomToKeyData {
	meetingId: string | number
	sdKeyId: string
	roomNumber?: number | string | null
	roomName?: string
	silentMap?: boolean
	isMuted?: unknown
	isBusy?: unknown
	isParticipantSpeaking?: unknown
}

interface RoomAllocatedData {
	meetingId: string | number
	serialNumber: number
	roomName?: string
	suggestedSDKey?: { id: string; deviceId?: string; coordinates?: { row: number; column: number }; visible?: boolean }
}

interface UpdateMicStatusData {
	meetingId: string | number
	sdKeyId?: string
	roomName?: string
	isMuted?: unknown
	isBusy?: unknown
	isParticipantSpeaking?: unknown
	/** Room-name font size, 1-10 scale. PER MEETING — not a global setting. Applied to
	 *  this meeting's button title via the `mic_status` feedback. */
	roomNameFontSize?: number
}

interface ParticipantStatusData {
	meetingId: string | number
	isMuted?: unknown
	isBusy?: unknown
	isParticipantSpeaking?: unknown
}

interface NextoTalkRoomEntry {
	meetingId: string | number
	isMuted?: unknown
	isBusy?: unknown
	isParticipantSpeaking?: unknown
}

interface UpdateRoomNameData {
	meetingId: string | number
	roomName: string
}

interface ReleaseKeyData {
	meetingId?: string | number
	sdKeyId?: string
	instant?: boolean
}

export type SocketCommand =
	| { type: SocketCommandType; action: SocketCommandActionType.Join; client?: string; data?: unknown }
	| { type: SocketCommandType; action: SocketCommandActionType.Reset; data?: unknown }
	| { type: SocketCommandType; action: SocketCommandActionType.MapSDKeyToRoom; data: MapSDKeyToRoomData }
	| { type: SocketCommandType; action: SocketCommandActionType.MapMeetingRoomToKey; data: MapMeetingRoomToKeyData }
	| { type: SocketCommandType; action: SocketCommandActionType.GetStreamDeckDevices; data?: unknown }
	| { type: SocketCommandType; action: SocketCommandActionType.GetMicControllerKeys; data?: unknown }
	| { type: SocketCommandType; action: SocketCommandActionType.PersistedRoomMeta; data?: unknown }
	| { type: SocketCommandType; action: SocketCommandActionType.RoomAllocated; data: RoomAllocatedData }
	| { type: SocketCommandType; action: SocketCommandActionType.UpdateMicStatus; data: UpdateMicStatusData }
	| { type: SocketCommandType; action: SocketCommandActionType.ParticipantAudioMuted; data: ParticipantStatusData }
	| { type: SocketCommandType; action: SocketCommandActionType.ParticipantAudioUnmuted; data: ParticipantStatusData }
	| { type: SocketCommandType; action: SocketCommandActionType.ParticipantBusyStatus; data: ParticipantStatusData }
	| {
			type: SocketCommandType
			action: SocketCommandActionType.NextoTalkRooms
			rooms?: NextoTalkRoomEntry[]
			data?: unknown
	  }
	| { type: SocketCommandType; action: SocketCommandActionType.UpdateRoomName; data: UpdateRoomNameData }
	| { type: SocketCommandType; action: SocketCommandActionType.ReleaseKey; data: ReleaseKeyData }
	| {
			type: SocketCommandType
			action: Exclude<
				SocketCommandActionType,
				| SocketCommandActionType.Join
				| SocketCommandActionType.Reset
				| SocketCommandActionType.MapSDKeyToRoom
				| SocketCommandActionType.MapMeetingRoomToKey
				| SocketCommandActionType.GetStreamDeckDevices
				| SocketCommandActionType.GetMicControllerKeys
				| SocketCommandActionType.PersistedRoomMeta
				| SocketCommandActionType.RoomAllocated
				| SocketCommandActionType.UpdateMicStatus
				| SocketCommandActionType.ParticipantAudioMuted
				| SocketCommandActionType.ParticipantAudioUnmuted
				| SocketCommandActionType.ParticipantBusyStatus
				| SocketCommandActionType.NextoTalkRooms
				| SocketCommandActionType.UpdateRoomName
				| SocketCommandActionType.ReleaseKey
			>
			data?: unknown
			client?: string
			rooms?: unknown[]
	  }
