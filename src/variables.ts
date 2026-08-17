import type { CompanionVariableDefinition } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const variables: CompanionVariableDefinition[] = [
		{ variableId: 'module_version', name: 'Module Version' },
		{ variableId: 'connected_clients', name: 'Connected Clients' },
	]
	self.setVariableDefinitions(variables)
}
