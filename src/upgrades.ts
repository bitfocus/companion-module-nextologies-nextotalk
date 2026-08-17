import type { CompanionStaticUpgradeScript } from '@companion-module/base'
import type { ModuleConfig } from './config.js'

// v1.0.0 is the first public release — no prior installs to migrate from.
export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = []
