import { type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	port: number
	host: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'number',
			id: 'port',
			label: 'WebSocket Port',
			width: 4,
			min: 1,
			max: 65535,
			default: 7005,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Host / Bind Address',
			description:
				'The network interface the WebSocket server listens on. Leave as 127.0.0.1 unless the Chrome extension runs on a different machine — anything on the same network can send commands to this module once it is reachable, so only widen this (e.g. to 0.0.0.0) if you understand the exposure.',
			width: 4,
			default: '127.0.0.1',
		},
	]
}
