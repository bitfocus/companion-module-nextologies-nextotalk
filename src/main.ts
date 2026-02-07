import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { WebSocketServer, WebSocket } from 'ws'
import { SocketCommandActionType, SocketCommandType, type SocketCommand } from './command.js'
import { ModuleState } from './state.js'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()
	private wss: WebSocketServer | undefined
	private clients: Set<WebSocket> = new Set()
	public state: ModuleState = new ModuleState()

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.updateStatus(InstanceStatus.Ok)

		this.initWebSocketServer()

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updatePresets() // export Presets
		this.updateVariableDefinitions() // export variable definitions
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
		if (this.wss) {
			this.wss.close()
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		const oldPort = this.config.port
		this.config = config

		if (oldPort !== this.config.port) {
			if (this.wss) {
				this.wss.close()
			}
			this.initWebSocketServer()
		}
	}

	private initWebSocketServer(): void {
		const port = this.config.port || 7005
		this.wss = new WebSocketServer({ port })

		this.wss.on('connection', (ws) => {
			this.clients.add(ws)
			this.log('info', 'Client connected to WebSocket')

			const welcomePayload: SocketCommand = {
				type: SocketCommandType.Event,
				action: SocketCommandActionType.Welcome,
				data: { version: '1.0.0.0-companion' },
			}
			ws.send(JSON.stringify(welcomePayload))

			ws.on('message', (message) => {
				try {
					const command: SocketCommand = JSON.parse((message as Buffer).toString())
					this.handleMessage(ws, command)
				} catch (e: any) {
					this.log('error', `Failed to parse WebSocket message: ${e?.message ?? 'Unknown error'}`)
				}
			})

			ws.on('close', () => {
				this.clients.delete(ws)
				this.log('info', 'Client disconnected from WebSocket')
			})
		})

		this.log('info', `WebSocket server started on port ${port}`)
	}

	private handleMessage(ws: WebSocket, command: SocketCommand): void {
		this.log('debug', `Received message: ${command.action}`)

		switch (command.action) {
			case SocketCommandActionType.Join: {
				this.log('info', `Client joined: ${command.data?.client ?? 'Unknown'}`)
				break
			}
			case SocketCommandActionType.AllocateRoom: {
				const meetingId = command.data.meetingId
				const serialNumber = this.state.getSerialNumberForMeeting(meetingId)
				if (serialNumber !== null) {
					const response: SocketCommand = {
						type: SocketCommandType.Response,
						action: SocketCommandActionType.RoomAllocated,
						data: {
							...command.data,
							serialNumber,
						},
					}
					ws.send(JSON.stringify(response))

					if (command.data.roomName) {
						this.state.updateRoomName(meetingId, command.data.roomName)
					}
					this.state.updateMicStatus(meetingId, command.data.isMuted ?? true)
				}
				break
			}
			case SocketCommandActionType.UpdateMicStatus: {
				const meetingId = command.data.meetingId
				if (meetingId) {
					this.state.updateMicStatus(meetingId, command.data.isMuted)
				}
				break
			}
			case SocketCommandActionType.UpdateRoomName: {
				const meetingId = command.data.meetingId
				if (meetingId && command.data.roomName) {
					this.state.updateRoomName(meetingId, command.data.roomName)
				}
				break
			}
			case SocketCommandActionType.NextoTalkRooms: {
				if (Array.isArray(command.data.rooms)) {
					for (const room of command.data.rooms) {
						this.state.getSerialNumberForMeeting(room.meetingId)
						this.state.updateRoomName(room.meetingId, room.roomName)
						this.state.updateMicStatus(room.meetingId, room.isMuted)
					}
				}
				break
			}
			default:
				// Broadast to other clients if needed
				this.sendToOtherClients(ws, command)
				break
		}

		this.updateVariables()
		this.checkFeedbacks()
	}

	private updateVariables(): void {
		const values: Record<string, string | number | undefined> = {}
		for (let i = 1; i <= 10; i++) {
			const room = this.state.getRoomByNumber(i)
			if (room) {
				values[`room_${i}_name`] = room.name
				values[`room_${i}_status`] = room.isMuted ? 'Muted' : 'Unmuted'
			} else {
				values[`room_${i}_name`] = 'None'
				values[`room_${i}_status`] = 'N/A'
			}
		}
		this.setVariableValues(values)
	}

	public sendToOtherClients(sender: WebSocket, command: SocketCommand): void {
		const message = JSON.stringify(command)
		for (const client of this.clients) {
			if (client !== sender && client.readyState === WebSocket.OPEN) {
				client.send(message)
			}
		}
	}

	public broadcast(command: SocketCommand): void {
		const message = JSON.stringify(command)
		for (const client of this.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(message)
			}
		}
	}

	// Return config fields for web config
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
