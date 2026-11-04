import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
})

export default [
	{ ignores: ['src/generated/**'] },
	...baseConfig,
	{
		// Test files import vitest (a devDependency, correctly not shipped in the built
		// plugin) — scoped here rather than disabled globally, unlike this repo's old
		// blanket n/no-unpublished-import override.
		files: ['src/__tests__/**/*.ts', 'vitest.config.ts'],
		rules: {
			'n/no-unpublished-import': 'off',
		},
	},
	{
		// Imports src/generated/render-assets.ts — generated at build time (gitignored) and
		// bundled into the package by webpack, so "unpublished" doesn't apply.
		files: ['src/key-art.ts'],
		rules: {
			'n/no-unpublished-import': 'off',
		},
	},
]
