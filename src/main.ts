import {
	InstanceBase,
	runEntrypoint,
	InstanceStatus,
	type SomeCompanionConfigField,
	type CompanionActionInfo,
} from '@companion-module/base'
import { createRequire } from 'node:module'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { WebSocketServer, WebSocket } from 'ws'
import { SocketCommandActionType, SocketCommandType, type RoomMeta, type SocketCommand } from './command.js'
import { ModuleState } from './state.js'

const require = createRequire(import.meta.url)
// Single source of truth for the running version — read from package.json at runtime so it
// can never drift from the published module version.
const MODULE_VERSION: string = (require('../package.json') as { version: string }).version

const MAX_CLIENTS = 5
const KEEPALIVE_INTERVAL_MS = 30_000
const PRUNE_INTERVAL_MS = 60 * 60 * 1000 // hourly
const STALE_MEETING_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig
	private wss: WebSocketServer | undefined
	private clients: Set<WebSocket> = new Set()
	private isAliveMap: WeakMap<WebSocket, boolean> = new WeakMap()
	private keepaliveInterval: ReturnType<typeof setInterval> | undefined
	private pruneInterval: ReturnType<typeof setInterval> | undefined
	public state: ModuleState = new ModuleState()
	private activeActions: Map<string, CompanionActionInfo> = new Map()
	public controlIdToActionId: Map<string, string> = new Map()
	private lastReportedLocation: Map<string, string> = new Map()

	constructor(internal: unknown) {
		super(internal)
	}

	public get hasConnectedClients(): boolean {
		return this.clients.size > 0
	}

	async init(config: ModuleConfig): Promise<void> {
		this.log('info', `Initializing Nextotalk Module v${MODULE_VERSION}`)
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)
		this.initWebSocketServer()
		this.startPruneInterval()
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.setVariableValues({ module_version: MODULE_VERSION, connected_clients: 0 })
	}

	async destroy(): Promise<void> {
		if (this.wss) this.wss.close()
		if (this.keepaliveInterval) clearInterval(this.keepaliveInterval)
		if (this.pruneInterval) clearInterval(this.pruneInterval)
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		const oldPort = this.config.port
		const oldHost = this.config.host
		this.config = config
		if (oldPort !== this.config.port || oldHost !== this.config.host) {
			if (this.wss) this.wss.close()
			if (this.keepaliveInterval) clearInterval(this.keepaliveInterval)
			this.initWebSocketServer()
		}
	}

	private toBool(val: unknown): boolean {
		if (typeof val === 'boolean') return val
		if (val === 'true' || val === 1 || val === '1') return true
		if (val === 'false' || val === 0 || val === '0' || val === undefined || val === null) return false
		this.log('warn', `Unrecognized boolean-like value ${JSON.stringify(val)} — treating as false`)
		return false
	}

	private startPruneInterval(): void {
		this.pruneInterval = setInterval(() => {
			const pruned = this.state.pruneStale(STALE_MEETING_MAX_AGE_MS)
			if (pruned > 0) {
				this.log('info', `Pruned ${pruned} stale meeting(s) inactive for over 24h`)
				this.checkFeedbacks('mic_status')
			}
		}, PRUNE_INTERVAL_MS)
	}

	private initWebSocketServer(): void {
		const port = this.config.port || 7005
		const host = this.config.host || '127.0.0.1'
		this.updateStatus(InstanceStatus.Connecting, `Starting on ${host}:${port}…`)

		this.wss = new WebSocketServer({ port, host, maxPayload: 1024 * 1024 })

		this.wss.on('listening', () => {
			this.updateStatus(InstanceStatus.Ok, `v${MODULE_VERSION} · ${host}:${port}`)
			this.log('info', `WebSocket Server started on ${host}:${port}`)
		})

		this.wss.on('connection', (ws) => {
			if (this.clients.size >= MAX_CLIENTS) {
				this.log('warn', `Rejecting connection — max clients (${MAX_CLIENTS}) already connected`)
				ws.close(1013, 'Too many connections')
				return
			}

			this.clients.add(ws)
			this.isAliveMap.set(ws, true)
			this.setVariableValues({ connected_clients: this.clients.size })
			this.log('info', 'Client Connected to WebSocket Server')

			const welcomePayload: SocketCommand = {
				type: SocketCommandType.Event,
				action: SocketCommandActionType.Welcome,
				data: { version: MODULE_VERSION, pluginType: 'bitfocus' },
			}
			ws.send(JSON.stringify(welcomePayload))

			ws.on('pong', () => {
				this.isAliveMap.set(ws, true)
			})

			ws.on('message', (message, isBinary) => {
				if (isBinary) {
					this.log('warn', 'Ignoring unexpected binary WebSocket frame')
					return
				}

				let command: SocketCommand
				try {
					command = JSON.parse((message as Buffer).toString())
				} catch (e) {
					this.log('error', `WS Parse Error: ${e}`)
					return
				}

				try {
					this.handleMessage(ws, command)
				} catch (e) {
					this.log('error', `WS Handler Error (${command.action}): ${e}`)
				}
			})

			ws.on('error', (err) => {
				this.log('error', `Client socket error: ${err.message}`)
				this.clients.delete(ws)
				this.setVariableValues({ connected_clients: this.clients.size })
				ws.terminate()
			})

			ws.on('close', () => {
				this.clients.delete(ws)
				this.setVariableValues({ connected_clients: this.clients.size })
				this.log('info', 'Client Disconnected')
			})
		})

		this.wss.on('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE') {
				this.log('error', `Port ${port} already in use`)
				this.updateStatus(InstanceStatus.ConnectionFailure, `Port ${port} in use?`)
			} else {
				this.log('error', `WebSocket Server Error: ${err.message}`)
				this.updateStatus(InstanceStatus.ConnectionFailure, `WS Error: ${err.message}`)
			}
		})

		this.keepaliveInterval = setInterval(() => {
			for (const ws of this.clients) {
				if (this.isAliveMap.get(ws) === false) {
					this.log('warn', 'Terminating unresponsive client (missed keepalive pong)')
					this.clients.delete(ws)
					ws.terminate()
					continue
				}
				this.isAliveMap.set(ws, false)
				ws.ping()
			}
			this.setVariableValues({ connected_clients: this.clients.size })
		}, KEEPALIVE_INTERVAL_MS)
	}

	private handleMessage(ws: WebSocket, command: SocketCommand): void {
		this.log('debug', `Received message: ${command.action}`)
		switch (command.action) {
			case SocketCommandActionType.Join:
				this.streamAvailableActions(ws)
				break
			case SocketCommandActionType.Reset:
				this.log('info', 'Resetting all module state')
				this.state.reset()
				this.lastReportedLocation.clear()
				this.checkFeedbacks('mic_status')

				// Send acknowledgment response
				if (command.type === SocketCommandType.Request) {
					ws.send(
						JSON.stringify({
							type: SocketCommandType.Response,
							action: SocketCommandActionType.Reset,
							data: { success: true },
						}),
					)
				}
				break
			case SocketCommandActionType.MapSDKeyToRoom: {
				const { sdKeyId, coordinates } = command.data
				let meetingId = command.data.meetingId

				if (!sdKeyId) {
					this.log('warn', 'map_sdkey_to_room: missing sdKeyId, ignoring')
					break
				}

				if (meetingId !== undefined && meetingId !== null) {
					meetingId = String(meetingId)
					this.state.mapActionToMeeting(sdKeyId, meetingId)
				}
				if (coordinates) {
					// sdKeyId is the action id; the location cache is keyed by controlId
					// everywhere it's read (getCoordinatesFromAction), so translate first.
					const controlId = this.activeActions.get(sdKeyId)?.controlId
					if (controlId) {
						this.state.setControlLocation(controlId, coordinates.row, coordinates.column)
						this.checkActionPositionUpdate(controlId)
					} else {
						this.log('debug', `map_sdkey_to_room: no active action found for sdKeyId ${sdKeyId} yet`)
					}
				}
				break
			}
			case SocketCommandActionType.MapMeetingRoomToKey: {
				const { sdKeyId, roomNumber, roomName, silentMap, isMuted, isBusy, isParticipantSpeaking } = command.data
				let meetingId = command.data.meetingId

				if (meetingId === undefined || meetingId === null || !sdKeyId) {
					this.log('warn', 'map_meeting_room_to_key: missing meetingId or sdKeyId, ignoring')
					break
				}
				meetingId = String(meetingId)

				// Assignment is handled by mapActionToMeeting
				this.state.mapActionToMeeting(sdKeyId, meetingId)

				if (silentMap) {
					break
				}

				this.log('debug', `Mapping meeting ${meetingId} to action ${sdKeyId}`)

				if (roomNumber !== undefined && roomNumber !== null && Number(roomNumber) > 0) {
					this.state.meetingRoomNumberMap[meetingId] = Number(roomNumber)
				}

				this.state.setMeetingActive(meetingId, true)

				// Update memory state
				this.state.updateMicStatus(
					meetingId,
					isMuted !== undefined ? this.toBool(isMuted) : (this.state.meetingMicStatusMap[meetingId] ?? true),
					isBusy !== undefined ? this.toBool(isBusy) : (this.state.meetingBusyStatusMap[meetingId] ?? false),
					isParticipantSpeaking !== undefined
						? this.toBool(isParticipantSpeaking)
						: (this.state.meetingSpeakingStatusMap[meetingId] ?? false),
				)

				const meetingTitle = roomName ?? meetingId
				if (meetingTitle) {
					this.state.updateRoomName(meetingId, this.lineBreakedMeetingTitle(meetingTitle))
				}

				this.log(
					'debug',
					`State after mapping: roomNumber=${this.state.meetingRoomNumberMap[meetingId]}, name=${this.state.meetingIdTitleMap[meetingId]}`,
				)

				this.notifyServerAboutSettingsChange(sdKeyId, meetingId)
				this.checkFeedbacks('mic_status')
				break
			}
			case SocketCommandActionType.GetStreamDeckDevices:
				ws.send(
					JSON.stringify({
						type: SocketCommandType.Response,
						action: SocketCommandActionType.GetStreamDeckDevices,
						// No fixed size: Companion grid size is user-configurable and can span
						// multiple surfaces, so we can't meaningfully report one here.
						data: [{ id: 'companion-surface', name: 'Companion Panel' }],
					}),
				)
				break
			case SocketCommandActionType.GetMicControllerKeys:
				this.streamAvailableActions(ws)
				break
			case SocketCommandActionType.PersistedRoomMeta: {
				// Build the persisted room metadata response
				const roomMetaMap: Record<string, RoomMeta> = {}

				// Iterate through all meetings and build the metadata
				for (const [meetingId, roomNumber] of Object.entries(this.state.meetingRoomNumberMap)) {
					const actionId = this.state.meetingIdActionIdMap[meetingId]
					const roomName = this.state.meetingIdTitleMap[meetingId]

					if (actionId) {
						roomMetaMap[meetingId] = {
							roomNumber,
							sdKeyId: actionId,
							roomName,
						}
					}
				}

				ws.send(
					JSON.stringify({
						type: SocketCommandType.Response,
						action: SocketCommandActionType.PersistedRoomMeta,
						data: roomMetaMap,
					}),
				)

				this.log('info', `Sent persisted room metadata for ${Object.keys(roomMetaMap).length} meetings`)
				break
			}
			case SocketCommandActionType.RoomAllocated: {
				// The central brain (Chrome Extension) just told us a room was allocated.
				// We just need to ensure our local state is updated to reflect this.
				const data = command.data
				const meetingId = String(data.meetingId)

				this.state.meetingRoomNumberMap[meetingId] = data.serialNumber
				if (data.roomName) {
					this.state.updateRoomName(meetingId, this.lineBreakedMeetingTitle(data.roomName))
				}

				if (data.suggestedSDKey) {
					this.state.mapActionToMeeting(data.suggestedSDKey.id, meetingId)
				}

				this.state.setMeetingActive(meetingId, true)
				this.checkFeedbacks('mic_status')

				// Broadcast this allocation to other potential clients (like the Dashboard) —
				// excluding the sender, which already knows.
				this.broadcast(command, ws)
				break
			}
			case SocketCommandActionType.UpdateMicStatus: {
				let meetingId = command.data.meetingId
				if (meetingId === undefined || meetingId === null) {
					this.log('warn', 'update_mic_status: missing meetingId, ignoring')
					break
				}
				meetingId = String(meetingId)
				const { isMuted, isBusy, isParticipantSpeaking, roomName, sdKeyId, roomNameFontSize } = command.data

				if (roomNameFontSize !== undefined) {
					this.state.updateRoomFontSize(meetingId, roomNameFontSize)
				}

				// Establish the action↔meeting mapping from the live status itself. The extension
				// includes the sdKeyId (= our action id) with every update_mic_status, so the surface
				// learns/refreshes which button drives which room — no auto-allocation needed, and it
				// self-heals after a Companion restart (the app keeps streaming status).
				if (sdKeyId) {
					this.state.mapActionToMeeting(sdKeyId, meetingId)
				}

				if (roomName) {
					this.state.updateRoomName(meetingId, this.lineBreakedMeetingTitle(roomName))
				}

				if (isMuted === undefined) {
					// No mic info available (e.g. the browser tab/meeting was closed) -
					// treat the key as neutral/inactive instead of defaulting to "unmuted" (green).
					this.log('debug', `UpdateMicStatus for ${meetingId}: isMuted undefined -> marking inactive (neutral)`)
					this.state.setMeetingActive(meetingId, false)
				} else {
					this.log(
						'debug',
						`UpdateMicStatus for ${meetingId}: muted=${JSON.stringify(isMuted)}, busy=${JSON.stringify(isBusy)}, speaking=${JSON.stringify(isParticipantSpeaking)}`,
					)
					// A defined mic status means the room is live → mark it active so the key renders
					// its colour. The NextoTalk app sends this for every online room it owns.
					this.state.setMeetingActive(meetingId, true)
					this.state.updateMicStatus(
						meetingId,
						this.toBool(isMuted),
						this.toBool(isBusy),
						this.toBool(isParticipantSpeaking),
					)
				}
				this.checkFeedbacks('mic_status')
				break
			}
			case SocketCommandActionType.ParticipantAudioMuted:
			case SocketCommandActionType.ParticipantAudioUnmuted:
			case SocketCommandActionType.ParticipantBusyStatus: {
				let meetingId = command.data.meetingId
				if (meetingId === undefined || meetingId === null) {
					this.log('warn', `${command.action}: missing meetingId, ignoring`)
					break
				}
				meetingId = String(meetingId)
				const { isMuted, isBusy, isParticipantSpeaking } = command.data
				this.log(
					'debug',
					`Participant Status Event for ${meetingId}: muted=${JSON.stringify(isMuted)}, busy=${JSON.stringify(isBusy)}, speaking=${JSON.stringify(isParticipantSpeaking)}`,
				)
				this.state.updateMicStatus(
					meetingId,
					this.toBool(isMuted),
					this.toBool(isBusy),
					this.toBool(isParticipantSpeaking),
				)
				this.checkFeedbacks('mic_status')
				break
			}
			case SocketCommandActionType.NextoTalkRooms: {
				if (Array.isArray(command.rooms)) {
					for (const room of command.rooms) {
						let meetingId = room.meetingId
						if (meetingId !== undefined && meetingId !== null) {
							meetingId = String(meetingId)
						}

						if (meetingId) {
							this.state.setMeetingActive(meetingId, true)
							this.state.updateMicStatus(
								meetingId,
								this.toBool(room.isMuted),
								this.toBool(room.isBusy),
								this.toBool(room.isParticipantSpeaking),
							)
						}
					}
					this.checkFeedbacks('mic_status')
				}
				break
			}
			case SocketCommandActionType.UpdateRoomName: {
				let meetingId = command.data.meetingId
				const { roomName } = command.data
				if (meetingId === undefined || meetingId === null || !roomName) {
					this.log('warn', 'update_room_name: missing meetingId or roomName, ignoring')
					break
				}
				meetingId = String(meetingId)
				this.state.updateRoomName(meetingId, roomName)
				this.log('debug', `Updated room name for ${meetingId}: ${roomName}`)
				this.checkFeedbacks('mic_status')

				// Send acknowledgment response if it was a request
				if (command.type === SocketCommandType.Request) {
					ws.send(
						JSON.stringify({
							type: SocketCommandType.Response,
							action: SocketCommandActionType.UpdateRoomName,
							data: { meetingId, roomName, success: true },
						}),
					)
				}
				break
			}
			case SocketCommandActionType.ReleaseKey: {
				let meetingId = command.data.meetingId
				if (meetingId !== undefined && meetingId !== null) {
					meetingId = String(meetingId)
				}
				const sdKeyId = command.data.sdKeyId

				if (!sdKeyId && !meetingId) {
					this.log('warn', 'release_key: missing both sdKeyId and meetingId, ignoring')
					break
				}

				// Clear the action↔meeting mapping and the meeting state — not just mark it inactive
				// — otherwise the button keeps the room name and pressing it still toggles the room
				// (false negative). After this the key goes fully blank.
				if (sdKeyId) this.state.mapActionToMeeting(sdKeyId, null)
				if (meetingId) this.state.removeMeeting(meetingId)

				this.log('debug', `Released key ${sdKeyId} from meeting ${meetingId}`)
				this.checkFeedbacks('mic_status')

				// Send acknowledgment response if it was a request
				if (command.type === SocketCommandType.Request) {
					ws.send(
						JSON.stringify({
							type: SocketCommandType.Response,
							action: SocketCommandActionType.ReleaseKey,
							data: { meetingId, success: true },
						}),
					)
				}
				break
			}
			default:
				this.log('warn', `Unhandled WS action: ${command.action}`)
				break
		}
	}

	public onActionAppearance(action: CompanionActionInfo, isAppearing: boolean): void {
		if (isAppearing) {
			this.log('debug', `Action Appearing - ID: ${action.id}, Control: ${action.controlId}`)
			this.activeActions.set(action.id, action)
			this.controlIdToActionId.set(action.controlId, action.id)
			if (action.actionId === 'toggle_mic') this.sendActionAppear(action)
		} else {
			this.log('debug', `Action Disappearing - ID: ${action.id}`)
			this.activeActions.delete(action.id)
			this.controlIdToActionId.delete(action.controlId)
			this.lastReportedLocation.delete(action.id)
			// No action remains mapped to this control — drop its cached location too, otherwise
			// the map grows slowly as buttons are created and destroyed over time.
			this.state.deleteControlLocation(action.controlId)
			if (action.actionId === 'toggle_mic') this.sendActionDisappear(action)
		}
	}

	public async discoverActionCoordinates(
		controlId: string,
		context: { parseVariablesInString(text: string): Promise<string> },
	): Promise<void> {
		try {
			// We ask Companion to resolve $(this:row/column) for this specific button instance
			const rowStr = await context.parseVariablesInString('$(this:row)')
			const colStr = await context.parseVariablesInString('$(this:column)')

			const dRow = parseInt(rowStr)
			const dCol = parseInt(colStr)

			if (!isNaN(dRow) && !isNaN(dCol)) {
				const current = this.state.getControlLocation(controlId)
				if (!current || current.row !== dRow || current.column !== dCol) {
					this.log('debug', `Coordinate discovered for ${controlId}: row=${dRow}, col=${dCol}`)
					this.state.setControlLocation(controlId, dRow, dCol)
					this.checkActionPositionUpdate(controlId)
				}
			} else {
				this.log('debug', `Invalid coordinates parsed for ${controlId}: row=${rowStr}, col=${colStr}`)
			}
		} catch (e) {
			this.log('debug', `Coordinate discovery failed for ${controlId}: ${e}`)
		}
	}

	public checkActionPositionUpdate(controlId: string): void {
		const actionId = this.controlIdToActionId.get(controlId)
		if (actionId) {
			const action = this.activeActions.get(actionId)
			if (action && action.actionId === 'toggle_mic') {
				this.sendActionAppear(action, true) // Force update
			}
		}
	}

	private sendActionAppear(action: CompanionActionInfo, force = false): void {
		const coords = this.getCoordinatesFromAction(action)

		// CRITICAL: Previously we were defaulting to 0,0.
		// Now we wait for the feedback to discover the REAL coordinates.
		if (!coords) {
			this.log('debug', `Delaying appearance for ${action.controlId} until coordinates are discovered...`)
			return
		}

		const locKey = `${coords.row},${coords.column}`

		if (!force && this.lastReportedLocation.get(action.id) === locKey) {
			return
		}

		this.lastReportedLocation.set(action.id, locKey)
		this.log('debug', `Reporting Action at: ${coords.row},${coords.column} for ${action.controlId}`)

		this.broadcast({
			type: SocketCommandType.Event,
			action: SocketCommandActionType.StreamDeckKeyAppear,
			data: {
				id: action.id,
				deviceId: 'companion-surface',
				coordinates: coords,
				settings: action.options,
				visible: true,
			},
		})
	}

	private sendActionDisappear(action: CompanionActionInfo): void {
		const coords = this.getCoordinatesFromAction(action) || { row: 0, column: 0 }
		this.broadcast({
			type: SocketCommandType.Event,
			action: SocketCommandActionType.StreamDeckKeyDisappear,
			data: {
				id: action.id,
				deviceId: 'companion-surface',
				coordinates: coords,
				settings: action.options,
				visible: false,
			},
		})
	}

	private getCoordinatesFromAction(action: CompanionActionInfo): { row: number; column: number } | null {
		// Rely solely on resolved coordinates (via discoverActionCoordinates / map_sdkey_to_row) —
		// no regex fallback, since Companion 3/4 control IDs are opaque and page grid size is
		// user-configurable, so any hardcoded-grid guess would either never match or be wrong.
		return this.state.getControlLocation(action.controlId)
	}

	private streamAvailableActions(ws: WebSocket): void {
		this.log('debug', `Streaming active actions to client...`)
		for (const action of this.activeActions.values()) {
			if (action.actionId === 'toggle_mic') {
				const coords = this.getCoordinatesFromAction(action)
				if (coords) {
					ws.send(
						JSON.stringify({
							type: SocketCommandType.Event,
							action: SocketCommandActionType.StreamDeckKeyAppear,
							data: {
								id: action.id,
								deviceId: 'companion-surface',
								coordinates: coords,
								settings: action.options,
								visible: true,
							},
						}),
					)
				}
			}
		}
	}

	// Breaks on whitespace, hyphens, AND underscores (not just spaces) — a name like
	// "Control-Room-One" or "Studio_A" has no spaces at all, so a space-only split would
	// never wrap it. The capturing group keeps each delimiter attached to whichever line
	// it lands on. Mirrors offscreen.js's wrapText() in the extension.
	private lineBreakedMeetingTitle(title: string): string {
		if (!title) return ''
		const maxCharsPerLine = 9
		const tokens = title.split(/([\s_-])/)
		let line = ''
		let wrapped = ''
		for (const token of tokens) {
			if ((line + token).length > maxCharsPerLine) {
				wrapped += `${line.trim()}\n`
				line = ''
			}
			line += token
		}
		wrapped += line.trim()
		return wrapped
	}

	private notifyServerAboutSettingsChange(sdKeyId: string, meetingId: string): void {
		const info = this.state.getRoomInfoForMeeting(meetingId)
		if (!info) return

		const settings = {
			isEnabled: true,
			isMuted: info.isMuted,
			meetingId: meetingId,
			roomNumber: info.roomNumber,
			isUserBusy: info.isBusy,
			isParticipantSpeaking: info.isSpeaking,
			title: info.name,
		}

		this.broadcast({
			type: SocketCommandType.Event,
			action: SocketCommandActionType.ActionUpdated,
			data: {
				sdkey: sdKeyId,
				settings: settings,
			},
		})
	}

	public broadcast(command: SocketCommand, exclude?: WebSocket): void {
		const msg = JSON.stringify(command)
		for (const client of this.clients) {
			if (client === exclude) continue
			if (client.readyState === WebSocket.OPEN) client.send(msg)
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}
	updateActions(): void {
		UpdateActions(this)
	}
	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}
	updatePresets(): void {
		UpdatePresets(this)
	}
	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
